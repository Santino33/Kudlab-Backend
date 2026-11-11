const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function checkPngEnvelope(bytes: Buffer): 'valid' | 'invalid' | 'unsupported' | 'unavailable' {
  if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return 'invalid';
  let header = false, data = false, endedData = false, palette = false, color = -1, depth = 0;
  for (let offset = 8; offset < bytes.length;) {
    if (bytes.length - offset < 12) return 'invalid';
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    if (length > 0x7fffffff || end > bytes.length) return 'invalid';
    const type = bytes.subarray(offset + 4, offset + 8), name = type.toString('ascii');
    if (![...type].every(c => c >= 65 && c <= 90 || c >= 97 && c <= 122)) return 'invalid';
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(offset + 4, end - 4)) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
    if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(end - 4)) return 'invalid';
    if (type[2]! & 32) return 'unavailable';
    if (!header && name !== 'IHDR') return 'invalid';
    if (name === 'IHDR') {
      if (header || length !== 13) return 'invalid';
      header = true; depth = bytes[offset + 16]!; color = bytes[offset + 17]!;
      const allowed: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!bytes.readUInt32BE(offset + 8) || !bytes.readUInt32BE(offset + 12) || !allowed[color]?.includes(depth)
        || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20]! > 1) return 'invalid';
    } else if (name === 'PLTE') {
      if (palette || data || !length || length > 768 || length % 3 || [0, 4].includes(color)
        || color === 3 && length / 3 > 2 ** depth) return 'invalid';
      palette = true;
    } else if (name === 'IDAT') {
      if (endedData || color === 3 && !palette) return 'invalid';
      data = true;
    } else {
      if (data) endedData = true;
      if (['acTL', 'fcTL', 'fdAT'].includes(name)) return 'unsupported';
      if (name === 'IEND') return length || !data ? 'invalid' : end === bytes.length ? 'valid' : 'unavailable';
      if (!(type[0]! & 32)) return 'unavailable';
    }
    offset = end;
  }
  return 'invalid';
}
