'use client';

import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Rating from '@mui/material/Rating';
import { useId } from 'react';

interface RatingFieldProps {
  label: string;
  /** Whole stars, or null while nothing has been chosen. */
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

const STAR_LABELS = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'];

/** A labelled star picker, whole stars only, with an inline error message. */
export default function RatingField({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: RatingFieldProps) {
  const labelId = useId();

  return (
    <FormControl error={Boolean(error)} disabled={disabled}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <Rating
        aria-labelledby={labelId}
        value={value}
        size="large"
        disabled={disabled}
        getLabelText={(stars) =>
          `${stars} ${stars === 1 ? 'star' : 'stars'}, ${STAR_LABELS[stars]}`
        }
        onChange={(_event, stars) => onChange(stars)}
        onBlur={onBlur}
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
