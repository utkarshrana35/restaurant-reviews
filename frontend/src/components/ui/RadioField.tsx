'use client';

import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useId } from 'react';

interface RadioFieldProps<Value extends string> {
  label: string;
  value: Value | '';
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
  error?: string;
  disabled?: boolean;
}

/** A labelled single-choice group with an inline error message. */
export default function RadioField<Value extends string>({
  label,
  value,
  options,
  onChange,
  error,
  disabled,
}: RadioFieldProps<Value>) {
  const labelId = useId();

  return (
    <FormControl error={Boolean(error)} disabled={disabled}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <RadioGroup
        row
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={option.label}
          />
        ))}
      </RadioGroup>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
