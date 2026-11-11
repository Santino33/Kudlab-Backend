import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { checkPngEnvelope } from './png-envelope.js';

export type DocumentResult = { kind: 'valid'; mediaType: 'application/pdf' | 'image/png' | 'image/jpeg' }
  | { kind: 'invalid' | 'unsupported' | 'unavailable' };
// This module runs only inside the dedicated, resource-limited worker container.
async function command(program: string, args: string[], maxOutput = 65536) {
  return new Promise<{ code: number | null; output: Buffer; diagnostic: boolean }>((resolve, reject) => {
    const child = spawn(program, args, { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let total = 0, diagnostic = false;
    child.stdout.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxOutput) { child.kill('SIGKILL'); reject(new Error('Output limit')); }
      else chunks.push(chunk);
    });
    child.stderr.on('data', () => { diagnostic = true; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output: Buffer.concat(chunks), diagnostic }));
  });
}
export async function validateDocument(path: string): Promise<DocumentResult> {
  const bytes = await readFile(path);
  if (!bytes.length || bytes.length > 10485760) return { kind: 'invalid' };
  const format = await fileTypeFromBuffer(bytes);
  if (!format || !['application/pdf', 'image/png', 'image/jpeg'].includes(format.mime)) return { kind: 'unsupported' };
  if (format.mime === 'application/pdf') {
    const encrypted = await command('qpdf', ['--requires-password', path]);
    if (encrypted.code === 0) return { kind: 'unsupported' };
    if (encrypted.code !== 2 && encrypted.code !== 3) return { kind: 'unavailable' };
    const structure = await command('qpdf', ['--check', '--suppress-recovery', path]);
    if (structure.code === 2) return { kind: 'invalid' };
    if (structure.code !== 0 || structure.diagnostic) return { kind: 'unavailable' };
    const count = await command('qpdf', ['--show-npages', path]);
    if (count.code !== 0 || count.diagnostic || !/^[1-9][0-9]*\s*$/.test(count.output.toString())) return { kind: 'unavailable' };
    const pages = Number(count.output.toString().trim());
    if (pages > 200) return { kind: 'unsupported' };
    const information = await command('pdfinfo', ['-f', '1', '-l', String(pages), path], 128 * 1024);
    if (information.code !== 0 || information.diagnostic) return { kind: 'unavailable' };
    const sizes = new Map<number, number>();
    for (const match of information.output.toString().matchAll(/^Page\s+(\d+) size:\s+([0-9.]+) x ([0-9.]+) pts/mg)) {
      const width = Number(match[2]), height = Number(match[3]);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { kind: 'unavailable' };
      sizes.set(Number(match[1]), Math.max(1, Math.min(2048, Math.ceil(Math.max(width, height)))));
    }
    if (sizes.size !== pages) return { kind: 'unavailable' };
    for (let page = 1; page <= pages; page++) {
      if (!sizes.has(page)) return { kind: 'unavailable' };
      const raster = await command('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', String(sizes.get(page)), path], 32 * 1024 * 1024);
      if (raster.code !== 0 || raster.diagnostic || raster.output.subarray(0, 3).toString() !== 'P6\n') return { kind: 'unavailable' };
    }
    return { kind: 'valid', mediaType: 'application/pdf' };
  }
  if (format.mime === 'image/png') {
    const envelope = checkPngEnvelope(bytes);
    if (envelope !== 'valid') return { kind: envelope };
  } else if (bytes.subarray(-2).toString('hex') !== 'ffd9') return { kind: 'unavailable' };
  sharp.cache(false); sharp.concurrency(1);
  const options = { failOn: 'warning' as const, limitInputPixels: 40000000, unlimited: false };
  const metadata = await sharp(bytes, { ...options, limitInputPixels: false }).metadata();
  if (!metadata.width || !metadata.height) return { kind: 'unavailable' };
  if (metadata.width * metadata.height > 40000000 || (metadata.pages ?? 1) > 1) return { kind: 'unsupported' };
  let warning = false;
  const pixels = sharp(bytes, options).on('warning', () => { warning = true; }).raw();
  let size = 0;
  for await (const chunk of pixels) { size += (chunk as Buffer).length; if (size > 320000000) { pixels.destroy(); return { kind: 'unavailable' }; } }
  return warning ? { kind: 'unavailable' } : { kind: 'valid', mediaType: format.mime as 'image/png' | 'image/jpeg' };
}
