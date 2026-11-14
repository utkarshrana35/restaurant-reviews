'use client';

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

interface SelectFieldProps<Value extends string> {
  label: string;
  /** Empty string while nothing has been chosen. */
  value: Value | '';
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

/** A labelled drop-down with an inline error message. */
export default function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange,
  onBlur,
  error,
  disabled,
}: SelectFieldProps<Value>) {
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as Value)}
      onBlur={onBlur}
      error={Boolean(error)}
      helperText={error}
      disabled={disabled}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
