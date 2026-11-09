import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { checkPngEnvelope } from '../../src/modules/academico/consents/png-envelope.js';

function chunk(type: string, data: Buffer) {
  const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(type, 4); data.copy(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4); return bytes;
}
describe('PNG completeness and profile — CA-02', () => {
  it('rejects every truncated prefix and bad CRC without trusting chunk lengths', async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#abc' } }).png().toBuffer();
    expect(checkPngEnvelope(png)).toBe('valid');
    for (let end = 0; end < png.length; end++) expect(checkPngEnvelope(png.subarray(0, end)), `prefix ${end}`).toBe('invalid');
    const corrupt = Buffer.from(png); corrupt[corrupt.length - 1]! ^= 1;
    expect(checkPngEnvelope(corrupt)).toBe('invalid');
    const huge = Buffer.from(png); huge.writeUInt32BE(0x7fffffff, 33);
    expect(checkPngEnvelope(huge)).toBe('invalid');
    const animated = Buffer.concat([png.subarray(0, 33), chunk('acTL', Buffer.from([0, 0, 0, 1, 0, 0, 0, 0])), png.subarray(33)]);
    expect(checkPngEnvelope(animated)).toBe('unsupported');
    expect(checkPngEnvelope(Buffer.concat([png, Buffer.from('extra')]))).toBe('unavailable');
    const header = Buffer.from(png.subarray(16, 29)); header[8] = 3;
    expect(checkPngEnvelope(Buffer.concat([png.subarray(0, 8), chunk('IHDR', header), png.subarray(33)]))).toBe('invalid');
  });
});
