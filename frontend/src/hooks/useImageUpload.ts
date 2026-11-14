import { presignUploadSchema } from '@restaurant-reviews/common';
import { useEffect, useRef, useState } from 'react';
import { toApiError } from '@/lib/apiError';
import { isUploadCancelled, uploadToStorage } from '@/lib/uploadToStorage';
import { usePresignImageUploadMutation } from '@/store/apiSlice';

/** Where an image upload has got to. */
export type ImageUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; previewUrl: string; progress: number }
  | { status: 'done'; previewUrl: string }
  | { status: 'error'; message: string };

/**
 * Uploads one image straight to storage: checks it, asks the API for permission, sends the file,
 * and reports progress. `upload` resolves with the key to send as `imageKey`, or null if the
 * upload did not complete (the reason is then in `state`).
 *
 * An upload still running when the component using this hook goes away (the owner left the
 * form) is cancelled, so it does not carry on in the background. So is one still running when
 * another starts.
 */
export function useImageUpload() {
  const [presign] = usePresignImageUploadMutation();
  const [state, setState] = useState<ImageUploadState>({ status: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  const previewUrl = 'previewUrl' in state ? state.previewUrl : null;
  // A preview is a browser-held copy of the file; release it when it is no longer shown.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Cancel whatever is still uploading when the form is left.
  useEffect(() => () => inFlight.current?.abort(), []);

  const upload = async (file: File): Promise<string | null> => {
    // The same rules the API applies, checked first so an obviously wrong file fails instantly.
    const declared = presignUploadSchema.safeParse({ contentType: file.type, size: file.size });
    if (!declared.success) {
      const message = declared.error.issues[0]?.message ?? 'Choose a different image';
      setState({ status: 'error', message });
      return null;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const preview = URL.createObjectURL(file);
    setState({ status: 'uploading', previewUrl: preview, progress: 0 });
    try {
      const permission = await presign(declared.data).unwrap();
      await uploadToStorage(
        permission,
        file,
        (progress) => setState({ status: 'uploading', previewUrl: preview, progress }),
        controller.signal,
      );
      setState({ status: 'done', previewUrl: preview });
      return permission.key;
    } catch (err) {
      // Cancelled because the form was left or another upload started: nothing to report.
      if (isUploadCancelled(err)) return null;
      const message = err instanceof Error ? err.message : toApiError(err).message;
      setState({ status: 'error', message });
      return null;
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  };

  return { state, upload };
}
