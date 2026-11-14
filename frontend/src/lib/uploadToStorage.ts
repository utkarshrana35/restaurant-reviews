import type { PresignedUploadDto } from '@restaurant-reviews/common';

/** True for the error an upload rejects with when it was cancelled through its signal. */
export function isUploadCancelled(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Sends a file straight to storage using a presigned upload. The file goes from the browser to
 * the bucket; it never passes through our API.
 *
 * Uses XMLHttpRequest because `fetch` cannot report upload progress.
 *
 * @param onProgress Called with a whole percentage from 0 to 100 as the upload advances.
 * @param signal Cancels the upload, for example when the form is left mid-upload. The promise
 *   then rejects with an `AbortError` (see `isUploadCancelled`).
 */
export function uploadToStorage(
  { url, fields }: Pick<PresignedUploadDto, 'url' | 'fields'>,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancelled = () => new DOMException('The upload was cancelled.', 'AbortError');
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }

    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    // Storage reads the policy fields first and requires the file to be the last part.
    form.append('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', url);

    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const settle = () => signal?.removeEventListener('abort', abort);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      settle();
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        // Storage refused it: the file broke the size or type limits the permission carries,
        // or the permission expired before the upload started.
        reject(new Error('The image could not be uploaded. Check its size and type.'));
      }
    });
    request.addEventListener('error', () => {
      settle();
      reject(new Error('The image could not be uploaded. Check your connection and try again.'));
    });
    request.addEventListener('abort', () => {
      settle();
      reject(cancelled());
    });

    request.send(form);
  });
}
