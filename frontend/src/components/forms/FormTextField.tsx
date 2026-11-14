'use client';

import type { ComponentProps } from 'react';
import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { TextField } from '@/components/ui';

type TextFieldProps = ComponentProps<typeof TextField>;

interface FormTextFieldProps<Values extends FieldValues> extends Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'inputRef' | 'error'
> {
  /** The form's `control`, from `useForm`. */
  control: Control<Values>;
  /** The form field this input edits. Must hold a string. */
  name: FieldPathByValue<Values, string>;
  /** A hint shown under the input while there is no error to show in its place. */
  helperText?: string;
}

/**
 * A react-hook-form text input. Controlled, so a value the form sets itself (`setValue`, `reset`)
 * reaches the input like a typed one does: the label moves out of the way and a multiline input
 * grows to fit. Typing re-renders this field only, not the form. The field's validation message
 * replaces `helperText` while there is one. Any other TextField prop (type, multiline,
 * autoComplete, ...) passes straight through.
 *
 * ```tsx
 * <FormTextField control={control} name="email" label="Email" type="email" />
 * ```
 */
export default function FormTextField<Values extends FieldValues>({
  control,
  name,
  helperText,
  ...props
}: FormTextFieldProps<Values>) {
  const { field, fieldState } = useController({ control, name });
  const error = fieldState.error?.message;

  return (
    <TextField
      fullWidth
      {...props}
      name={field.name}
      value={field.value as string}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={Boolean(error)}
      helperText={error ?? helperText}
    />
  );
}
