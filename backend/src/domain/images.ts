import type { ImageContentType } from '@restaurant-reviews/common';

/** How many leading bytes `detectImageType` needs to see. */
export const IMAGE_SIGNATURE_BYTES = 12;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Identifies an image from the signature at the start of its content. A file's name and declared
 * type are chosen by whoever uploads it; its first bytes are what it actually is. Returns null
 * for anything that is not a JPEG, PNG or WebP.
 */
export function detectImageType(bytes: Uint8Array): ImageContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP is a RIFF container: "RIFF", four size bytes, then "WEBP".
  const isRiff = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]);
  if (isRiff && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
