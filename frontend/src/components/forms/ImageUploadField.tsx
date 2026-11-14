'use client';

import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES } from '@restaurant-reviews/common';
import { useRef, type ChangeEvent } from 'react';
import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { Box, Button, LinearProgress, Stack, Typography } from '@/components/ui';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ImageUploadFieldProps<Values extends FieldValues> {
  /** The form's `control`, from `useForm`. */
  control: Control<Values>;
  /** The form field that receives the uploaded image's key. Must hold a string. */
  name: FieldPathByValue<Values, string>;
  label?: string;
  /** An image already saved, shown until a new one is chosen. */
  currentImageUrl?: string;
  /** Called as an upload starts and ends, for example to hold the form's submit button. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}

/**
 * A react-hook-form field that uploads one image straight to storage and stores the resulting
 * key in the named field. It shows a preview, upload progress, and the field's validation
 * message. While an upload is running the field holds '' so a half-finished image is never
 * submitted. If the form clears the field after an upload (because the server refused the
 * image), the preview goes back to `currentImageUrl`, so what is shown is what would be saved.
 *
 * ```tsx
 * <ImageUploadField control={control} name="imageKey" />
 * ```
 */
export default function ImageUploadField<Values extends FieldValues>({
  control,
  name,
  label = 'Image',
  currentImageUrl,
  onUploadingChange,
  disabled,
}: ImageUploadFieldProps<Values>) {
  const { field, fieldState } = useController({ control, name });
  const input = useRef<HTMLInputElement>(null);
  const { state, upload } = useImageUpload();

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again (to retry) still fires a change event.
    event.target.value = '';
    if (!file) return;

    field.onChange('');
    onUploadingChange?.(true);
    const imageKey = await upload(file);
    onUploadingChange?.(false);
    if (imageKey) field.onChange(imageKey);
    field.onBlur();
  };

  const uploading = state.status === 'uploading';
  // A finished upload is previewed only while the field still holds its key. Once the form
  // clears it (the API rejected the image), submitting would keep the saved image, so that is
  // what is shown, and the field's error says why the new one was dropped.
  const showsUpload = uploading || (state.status === 'done' && Boolean(field.value));
  const shownUrl = showsUpload && 'previewUrl' in state ? state.previewUrl : currentImageUrl;
  // A problem with the file itself takes precedence over the form's rule for the field.
  const message = state.status === 'error' ? state.message : fieldState.error?.message;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" component="span">
        {label}
      </Typography>

      {shownUrl && (
        <Box
          component="img"
          src={shownUrl}
          alt={`Preview of the ${label.toLowerCase()}`}
          sx={{
            width: '100%',
            maxHeight: 280,
            objectFit: 'cover',
            borderRadius: 1,
            opacity: uploading ? 0.5 : 1,
          }}
        />
      )}

      {uploading && (
        <LinearProgress variant="determinate" value={state.progress} aria-label="Upload progress" />
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button
          variant="outlined"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
          // The hint beside it wraps on a narrow screen; the button keeps its label on one line.
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {shownUrl ? 'Replace image' : 'Choose image'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {uploading
            ? `Uploading… ${state.progress}%`
            : `JPEG, PNG or WebP, up to ${IMAGE_MAX_BYTES / 1024 / 1024} MB`}
        </Typography>
      </Stack>

      {message && (
        <Typography variant="body2" color="error" role="alert">
          {message}
        </Typography>
      )}

      <input
        ref={(element) => {
          input.current = element;
          // Lets the form focus this field when it is the first one with an error.
          field.ref(element);
        }}
        type="file"
        hidden
        name={field.name}
        accept={IMAGE_CONTENT_TYPES.join(',')}
        aria-label={`${label} file`}
        onChange={handleFile}
      />
    </Stack>
  );
}
