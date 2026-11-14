import { crc32, deflateSync } from 'node:zlib';

type Rgb = [number, number, number];

/** One PNG chunk: length, type, data, and a CRC over type and data. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * A PNG filled with a diagonal gradient between two colours, for seed data. Built by hand with
 * zlib so the seed needs no image library and no files checked into the repository.
 */
export function gradientPng(width: number, height: number, from: Rgb, to: Rgb): Buffer {
  const rowLength = 1 + width * 3; // a filter-type byte, then RGB for each pixel
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    pixels[y * rowLength] = 0; // filter type: none
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const offset = y * rowLength + 1 + x * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(from[channel]! + (to[channel]! - from[channel]!) * t);
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  // Bytes 10 to 12 (compression, filter, interlace) stay 0.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
