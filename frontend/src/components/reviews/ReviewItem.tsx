import type { ReviewDto } from '@restaurant-reviews/common';
import type { ReactNode } from 'react';
import LocalDate from '@/components/LocalDate';
import { Rating, Stack, Typography } from '@/components/ui';

interface ReviewItemProps {
  review: ReviewDto;
  /** Shown beside the date, for example a Delete button on the reader's own review. */
  action?: ReactNode;
}

/** One review: who wrote it, their stars, when, and what they said. */
export default function ReviewItem({ review, action }: ReviewItemProps) {
  const stars = `${review.rating} ${review.rating === 1 ? 'star' : 'stars'}`;
  return (
    <Stack component="article" spacing={1} aria-label={`Review by ${review.authorName}`}>
      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {review.authorName}
        </Typography>
        <Rating value={review.rating} size="small" readOnly aria-label={stars} />
        <LocalDate iso={review.createdAt} />
        {action}
      </Stack>
      {/* Rendered as text: markup in a comment is shown, never executed. pre-line keeps the
          reviewer's line breaks. */}
      <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
        {review.comment}
      </Typography>
    </Stack>
  );
}
