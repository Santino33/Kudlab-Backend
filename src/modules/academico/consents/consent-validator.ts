import { request } from 'node:http';
import { z } from 'zod';

const resultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('valid'), mediaType: z.enum(['application/pdf', 'image/png', 'image/jpeg']) }),
  z.strictObject({ kind: z.enum(['invalid', 'unsupported', 'unavailable']) }),
]);
export async function validateConsentFile(file: File, socketPath: string, signal?: AbortSignal) {
  if (!file.size || file.size > 10485760) return { kind: 'invalid' as const };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (signal?.aborted) return { kind: 'unavailable' as const };
  try {
    const result = await new Promise<z.infer<typeof resultSchema>>((resolve, reject) => {
      const call = request({ socketPath, path: '/validate', method: 'POST', signal,
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length },
      }, response => {
        let output = '';
        response.on('data', (chunk: Buffer) => { output += chunk.toString(); if (output.length > 1024) call.destroy(new Error('Response limit')); });
        response.on('error', reject);
        response.on('end', () => {
          try { if (response.statusCode !== 200) throw new Error('Unavailable'); resolve(resultSchema.parse(JSON.parse(output))); }
          catch { reject(new Error('Unconfirmed validation')); }
        });
      });
      const deadline = setTimeout(() => call.destroy(new Error('Validation deadline')), 31000);
      call.on('close', () => clearTimeout(deadline)); call.on('error', reject); call.end(bytes);
    });
    if (result.kind === 'valid') {
      const extension = file.name.split('.').at(-1)?.toLowerCase();
      const allowed = { 'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'] };
      if (!extension || !allowed[result.mediaType].includes(extension)) return { kind: 'invalid' as const };
    }
    return result;
  } catch { return { kind: 'unavailable' as const }; }
}
