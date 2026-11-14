'use client';

import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { SelectField } from '@/components/ui';

interface FormSelectFieldProps<Values extends FieldValues, Option extends string> {
  /** The form's `control`, from `useForm`. */
  control: Control<Values>;
  /** The form field this drop-down sets. */
  name: FieldPathByValue<Values, Option | undefined>;
  label: string;
  options: readonly { value: Option; label: string }[];
  disabled?: boolean;
}

/**
 * A react-hook-form drop-down. Controlled, because the underlying select is: the form holds the
 * value and the select shows it. Shows the field's validation message beneath it.
 *
 * ```tsx
 * <FormSelectField control={control} name="cuisine" label="Cuisine" options={CUISINE_OPTIONS} />
 * ```
 */
export default function FormSelectField<Values extends FieldValues, Option extends string>({
  control,
  name,
  label,
  options,
  disabled,
}: FormSelectFieldProps<Values, Option>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <SelectField
      label={label}
      // Nothing chosen yet shows as an empty select rather than an out-of-range value.
      value={(field.value as Option | undefined) ?? ''}
      options={options}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      disabled={disabled}
    />
  );
}
