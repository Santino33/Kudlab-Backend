export async function validateConsentFile(file: File, signal?: AbortSignal) {
  if (signal?.aborted) return { kind: 'unavailable' as const };
  if (!file.size || file.size > 10485760) return { kind: 'invalid' as const };
  try {
    const header = Buffer.from(await file.slice(0, 8).arrayBuffer());
    if (signal?.aborted) return { kind: 'unavailable' as const };
    // shortcut: signature and extension only; content, readability and signature require human review.
    const mediaType = header.subarray(0, 5).equals(Buffer.from('%PDF-')) ? 'application/pdf'
      : header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : header.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : null;
    if (!mediaType) return { kind: 'unsupported' as const };
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const allowed = { 'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'] };
    if (!file.name.includes('.') || !extension || !allowed[mediaType].includes(extension)) return { kind: 'invalid' as const };
    return { kind: 'valid', mediaType } as const;
  } catch { return { kind: 'unavailable' as const }; }
}
