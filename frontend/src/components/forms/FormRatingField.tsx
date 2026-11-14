'use client';

import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { RatingField } from '@/components/ui';

interface FormRatingFieldProps<Values extends FieldValues> {
  /** The form's `control`, from `useForm`. */
  control: Control<Values>;
  /** The form field this star picker sets. */
  name: FieldPathByValue<Values, number | undefined>;
  label: string;
  disabled?: boolean;
}

/**
 * A react-hook-form star rating. Controlled, because the star widget needs the current value to
 * draw itself. Clearing the stars leaves the field empty, so the schema reports it as missing.
 *
 * ```tsx
 * <FormRatingField control={control} name="rating" label="Your rating" />
 * ```
 */
export default function FormRatingField<Values extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: FormRatingFieldProps<Values>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <RatingField
      label={label}
      value={(field.value as number | undefined) ?? null}
      onChange={(stars) => field.onChange(stars ?? undefined)}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      disabled={disabled}
    />
  );
}
