import { describe, expect, it } from 'vitest';
import { detectImageType } from '../../src/domain/images';
import { SAMPLE_BYTES } from '../support/InMemoryFileStorage';

const bytes = (values: readonly number[]) => new Uint8Array(values);

describe('detectImageType', () => {
  it.each([
    ['image/jpeg', SAMPLE_BYTES.jpeg],
    ['image/png', SAMPLE_BYTES.png],
    ['image/webp', SAMPLE_BYTES.webp],
  ] as const)('recognises %s from its signature', (type, sample) => {
    expect(detectImageType(bytes(sample))).toBe(type);
  });

  it('rejects content that is not an image, whatever it is called', () => {
    expect(detectImageType(bytes(SAMPLE_BYTES.notAnImage))).toBeNull();
  });

  it('rejects other RIFF files, which share the first four bytes with WebP', () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];

    expect(detectImageType(bytes(wav))).toBeNull();
  });

  it('rejects a GIF, a real image of a type that is not accepted', () => {
    expect(detectImageType(bytes([...Buffer.from('GIF89a'), 0, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it('rejects empty and truncated content', () => {
    expect(detectImageType(new Uint8Array())).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8]))).toBeNull();
  });
});
