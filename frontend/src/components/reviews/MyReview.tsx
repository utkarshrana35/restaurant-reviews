'use client';

import type { ReviewDto } from '@restaurant-reviews/common';
import { useState, type ReactNode } from 'react';
import { Box, Button, ConfirmDialog, Paper, Stack, Typography } from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { useDeleteReviewMutation } from '@/store/apiSlice';
import ReviewItem from './ReviewItem';

interface MyReviewProps {
  review: ReviewDto;
  /** Shown above the review. Defaults to "Your review"; the account page names the restaurant. */
  heading?: ReactNode;
  /** Shown beside the review on wider screens and above it on phones, such as an image. */
  media?: ReactNode;
  /** Called once the review has been deleted, after the cached data has been invalidated. */
  onDeleted?: () => void;
}

/** One of the signed-in reviewer's own reviews, with a way to withdraw it. */
export default function MyReview({ review, heading, media, onDeleted }: MyReviewProps) {
  const [deleteReview, deletion] = useDeleteReviewMutation();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    deletion.reset();
  };

  const confirm = async () => {
    try {
      await deleteReview({ id: review.id, restaurantId: review.restaurantId }).unwrap();
      close();
      onDeleted?.();
    } catch {
      // The dialog stays open and shows the error, so the reviewer can retry or cancel.
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {media && (
          <Box
            sx={{
              width: { xs: '100%', sm: 180 },
              flexShrink: 0,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {media}
          </Box>
        )}
        <Stack spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
          {heading ?? (
            <Typography variant="subtitle2" color="text.secondary">
              Your review
            </Typography>
          )}
          <ReviewItem
            review={review}
            action={
              <Button size="small" color="error" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            }
          />
        </Stack>
      </Stack>

      <ConfirmDialog
        open={confirming}
        title="Delete your review?"
        confirmLabel="Delete"
        onConfirm={confirm}
        onCancel={close}
        busy={deletion.isLoading}
        error={deletion.isError ? toApiError(deletion.error).message : null}
      >
        Your rating will no longer count towards this restaurant&apos;s average. You can write a new
        review afterwards.
      </ConfirmDialog>
    </Paper>
  );
}
