import { Rating, Stack, Typography } from '@/components/ui';

interface RatingSummaryProps {
  ratingAvg: number | null;
  ratingCount: number;
  size?: 'small' | 'medium' | 'large';
}

/** A restaurant's average as stars and a number, or a note that it has no reviews yet. */
export default function RatingSummary({
  ratingAvg,
  ratingCount,
  size = 'small',
}: RatingSummaryProps) {
  if (ratingAvg === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        No reviews yet
      </Typography>
    );
  }

  const average = ratingAvg.toFixed(1);
  const reviews = `${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'}`;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Rating value={ratingAvg} precision={0.1} size={size} readOnly aria-hidden />
      <Typography variant="body2" aria-label={`Rated ${average} out of 5 from ${reviews}`}>
        <strong>{average}</strong> ({reviews})
      </Typography>
    </Stack>
  );
}
