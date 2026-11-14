'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  reviewCreateSchema,
  type ReviewCreateInput,
} from '@restaurant-reviews/common';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormRatingField, FormTextField } from '@/components/forms';
import { Alert, Button, Stack } from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { applyFieldErrors } from '@/lib/formErrors';
import { useCreateReviewMutation } from '@/store/apiSlice';

const FIELDS = ['rating', 'comment'] as const;

interface ReviewFormProps {
  restaurantId: string;
  /** Called once the review has been saved. */
  onSaved: () => void;
}

/** Lets a reviewer rate the restaurant and say why. */
export default function ReviewForm({ restaurantId, onSaved }: ReviewFormProps) {
  const [createReview, { isLoading }] = useCreateReviewMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, setError } = useForm<ReviewCreateInput>({
    resolver: zodResolver(reviewCreateSchema),
    // The rating starts unchosen, which the submitted type does not allow.
    defaultValues: { rating: undefined, comment: '' },
  });

  const onSubmit = handleSubmit(async (review) => {
    setFormError(null);
    try {
      await createReview({ restaurantId, review }).unwrap();
      onSaved();
    } catch (err) {
      const error = toApiError(err);
      if (applyFieldErrors(error, FIELDS, setError).length === 0) setFormError(error.message);
    }
  });

  return (
    <Stack component="form" noValidate spacing={2} onSubmit={onSubmit} aria-label="Write a review">
      {formError && <Alert severity="error">{formError}</Alert>}
      <FormRatingField control={control} name="rating" label="Your rating" disabled={isLoading} />
      <FormTextField
        control={control}
        name="comment"
        label="Comment"
        multiline
        minRows={3}
        disabled={isLoading}
        helperText={`What stood out? Up to ${REVIEW_COMMENT_MAX_LENGTH} characters.`}
        slotProps={{ htmlInput: { maxLength: REVIEW_COMMENT_MAX_LENGTH } }}
      />
      <Button
        type="submit"
        variant="contained"
        loading={isLoading}
        sx={{ alignSelf: 'flex-start' }}
      >
        Post review
      </Button>
    </Stack>
  );
}
