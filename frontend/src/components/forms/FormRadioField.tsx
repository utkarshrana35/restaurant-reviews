'use client';

import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { RadioField } from '@/components/ui';

interface FormRadioFieldProps<Values extends FieldValues, Option extends string> {
  /** The form's `control`, from `useForm`. */
  control: Control<Values>;
  /** The form field this group sets. */
  name: FieldPathByValue<Values, Option | undefined>;
  label: string;
  options: readonly { value: Option; label: string }[];
  disabled?: boolean;
}

/**
 * A react-hook-form single-choice group. Controlled: the form holds the value and the group
 * shows it. Shows the field's validation message beneath it.
 *
 * ```tsx
 * <FormRadioField control={control} name="role" label="I am a" options={ROLE_OPTIONS} />
 * ```
 */
export default function FormRadioField<Values extends FieldValues, Option extends string>({
  control,
  name,
  label,
  options,
  disabled,
}: FormRadioFieldProps<Values, Option>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <RadioField
      label={label}
      value={(field.value as Option | undefined) ?? ''}
      options={options}
      onChange={field.onChange}
      error={fieldState.error?.message}
      disabled={disabled}
    />
  );
}
