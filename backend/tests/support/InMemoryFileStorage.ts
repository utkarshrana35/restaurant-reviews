import type {
  FileStorage,
  PresignedUpload,
  PresignedUploadRequest,
  ServedHeaders,
  StoredFile,
} from '../../src/application/ports/FileStorage';

/** Leading bytes of real files, for building test uploads. */
export const SAMPLE_BYTES = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d],
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  // What a renamed script or document looks like: no image signature.
  notAnImage: [...Buffer.from('<script>alert(1)</script>')],
} as const;

/**
 * File storage held in a Map. `put` stands in for the browser's direct upload, which in the real
 * system goes to S3 without touching the API.
 */
export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();
  readonly issuedUploads: PresignedUploadRequest[] = [];
  /** The headers each copied file was given, by destination key. */
  readonly servedHeaders = new Map<string, ServedHeaders>();
  /** Set to make the next delete fail, as a storage outage would. */
  failNextDelete = false;

  put(key: string, bytes: readonly number[] | Uint8Array, totalSize = bytes.length): void {
    // `totalSize` lets a test claim a large file without allocating one.
    const content = new Uint8Array(totalSize);
    content.set(bytes.slice(0, totalSize));
    this.files.set(key, content);
  }

  keys(prefix = ''): string[] {
    return [...this.files.keys()].filter((key) => key.startsWith(prefix));
  }

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload> {
    this.issuedUploads.push(request);
    return {
      url: 'https://storage.test/bucket',
      fields: { key: request.key, 'Content-Type': request.contentType, policy: 'signed' },
    };
  }

  async stat(key: string): Promise<StoredFile | null> {
    const file = this.files.get(key);
    return file ? { size: file.length } : null;
  }

  async readHead(key: string, byteCount: number): Promise<Uint8Array> {
    return this.files.get(key)?.slice(0, byteCount) ?? new Uint8Array();
  }

  async copy(fromKey: string, toKey: string, headers: ServedHeaders): Promise<void> {
    const file = this.files.get(fromKey);
    if (!file) throw new Error(`No such file: ${fromKey}`);
    this.files.set(toKey, file);
    this.servedHeaders.set(toKey, headers);
  }

  async delete(key: string): Promise<void> {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('Storage unavailable');
    }
    this.files.delete(key);
  }

  publicUrl(key: string): string {
    return `https://storage.test/bucket/${key}`;
  }
}
