// Run by stdin in a separate network-disabled client container sharing only the worker socket.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { request } from 'node:http';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { validateConsentFile } from './src/modules/academico/consents/consent-validator.ts';
function pdf(broken = false, padding = 0) {
  const streams = ['0 0 m 10 10 l S', broken ? 'BAD_OPERATOR' : '1 1 m 20 20 l S'];
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 6 0 R >>',
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`];
  let text = '%PDF-1.4\n' + (padding ? '%' + 'x'.repeat(padding - 2) + '\n' : '');
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += 'xref\n0 7\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  return Buffer.from(text + `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
function sizedPdf(size) {
  let padding = size - pdf().length;
  for (let i = 0; i < 5; i++) { const bytes = pdf(false, padding); if (bytes.length === size) return bytes; padding += size - bytes.length; }
  throw new Error('Fixture size mismatch');
}
const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#aabbcc' } }).png().toBuffer();
const jpeg = await sharp(png).jpeg().toBuffer();
const badCRC = Buffer.from(png); badCRC[badCRC.length - 1] ^= 1;
const socket = '/socket/validator.sock';
const cases = [
  ['valid.png', png, 'valid'], ['crc.png', badCRC, 'invalid'], ['missing-iend.png', png.subarray(0, -12), 'invalid'],
  ['valid.jpg', jpeg, 'valid'], ['truncated.jpg', jpeg.subarray(0, -12), 'unavailable'],
  ['valid.pdf', pdf(), 'valid'], ['second-page.pdf', pdf(true), 'unavailable'],
  ['truncated.pdf', pdf().subarray(0, -35), 'invalid'],
  ['exact.pdf', sizedPdf(10485760), 'valid'], ['oversized.pdf', sizedPdf(10485761), 'invalid'],
  ['wrong.jpg', png, 'invalid'],
];
for (const [name, bytes, expected] of cases) {
  const result = await validateConsentFile(new File([bytes], name), socket);
  console.log(JSON.stringify({ name, expected, result })); assert.equal(result.kind, expected, name);
}
for (const [name, pipeline] of [
  ['palette.png', sharp(png).png({ palette: true })], ['interlaced.png', sharp(png).png({ progressive: true })],
  ['gray.png', sharp(png).greyscale().png()], ['alpha.png', sharp(png).ensureAlpha().png()],
  ['16bit.png', sharp(png).toColourspace('rgb16').png()], ['progressive.jpg', sharp(png).jpeg({ progressive: true })],
]) {
  const result = await validateConsentFile(new File([await pipeline.toBuffer()], name), socket);
  assert.equal(result.kind, 'valid', name); console.log(JSON.stringify({ profile: name, result }));
}
await writeFile('/tmp/base.pdf', pdf());
execFileSync('qpdf', ['--encrypt', 'synthetic', 'synthetic-owner', '256', '--', '/tmp/base.pdf', '/tmp/encrypted.pdf']);
execFileSync('qpdf', ['--empty', '--pages', '/tmp/base.pdf', Array(201).fill('1').join(','), '--', '/tmp/pages.pdf']);
for (const name of ['encrypted', 'pages']) {
  const result = await validateConsentFile(new File([await readFile(`/tmp/${name}.pdf`)], `${name}.pdf`), socket);
  assert.equal(result.kind, 'unsupported', name); console.log(JSON.stringify({ profile: name, result }));
}
execFileSync('qpdf', ['--empty', '--pages', '/tmp/base.pdf', Array(200).fill('1').join(','), '--', '/tmp/exact-pages.pdf']);
const pageBoundary = await validateConsentFile(new File([await readFile('/tmp/exact-pages.pdf')], '200pages.pdf'), socket);
console.log(JSON.stringify({ pageBoundary })); assert.equal(pageBoundary.kind, 'valid');
const large = await sharp({ create: { width: 8000, height: 5000, channels: 3, background: '#abc' } }).png().toBuffer();
assert.equal((await validateConsentFile(new File([large], '40mp.png'), socket)).kind, 'valid');
const over = await sharp({ create: { width: 8000, height: 5001, channels: 3, background: '#abc' } }).png().toBuffer();
assert.equal((await validateConsentFile(new File([over], 'over40mp.png'), socket)).kind, 'unsupported');
console.log(JSON.stringify({ pixelBoundary: 'passed' }));
// Hold one streaming request open, prove bounded concurrency, then abort it.
const pending = request({ socketPath: socket, path: '/validate', method: 'POST' });
pending.on('error', () => undefined);
await new Promise(resolve => pending.write(png.subarray(0, 1), resolve));
const busy = await validateConsentFile(new File([png], 'busy.png'), socket);
assert.equal(busy.kind, 'unavailable'); pending.destroy();
console.log(JSON.stringify({ saturation: 'passed', clientAbortSent: true }));
const cancelled = new AbortController(); cancelled.abort();
assert.equal((await validateConsentFile(new File([png], 'cancelled.png'), socket, cancelled.signal)).kind, 'unavailable');
assert.equal((await validateConsentFile(new File([png], 'absent.png'), '/socket/absent')).kind, 'unavailable');
