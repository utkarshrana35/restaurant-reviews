/** What a presigned upload permits: one key, one content type, a size limit, a lifetime. */
export interface PresignedUploadRequest {
  /** Where the file will be stored. The upload is only valid for exactly this key. */
  key: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
}

/** A permission the browser uses to upload a file directly to storage. */
export interface PresignedUpload {
  /** Where the browser sends the file. */
  url: string;
  /** Form fields that must accompany the file, including the signed policy. */
  fields: Record<string, string>;
}

/** How a file is described to whoever downloads it. */
export interface ServedHeaders {
  contentType: string;
  cacheControl: string;
}

/** Facts about a file already in storage. */
export interface StoredFile {
  size: number;
}

/**
 * File storage that clients upload to directly. The API never receives file contents: it hands
 * out a narrowly scoped permission to upload, then inspects what arrived before accepting it.
 */
export interface FileStorage {
  /** Permission for one upload, limited by the storage itself to the key, type and size given. */
  createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload>;
  /** Facts about a stored file, or null if nothing is stored under the key. */
  stat(key: string): Promise<StoredFile | null>;
  /** The first `byteCount` bytes of a stored file. */
  readHead(key: string, byteCount: number): Promise<Uint8Array>;
  /** Copies a file, setting the headers it will be served with. */
  copy(fromKey: string, toKey: string, headers: ServedHeaders): Promise<void>;
  delete(key: string): Promise<void>;
  /** The address a browser can load the file from. */
  publicUrl(key: string): string;
}
