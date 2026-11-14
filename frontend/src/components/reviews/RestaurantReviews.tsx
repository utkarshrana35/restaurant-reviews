'use client';

import type { Paginated, ReviewDto } from '@restaurant-reviews/common';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Box,
  Divider,
  LinearProgress,
  Pagination,
  Stack,
  StatusAlert,
  Typography,
} from '@/components/ui';
import { useGetReviewsQuery } from '@/store/apiSlice';
import ReviewComposer from './ReviewComposer';
import ReviewItem from './ReviewItem';

interface RestaurantReviewsProps {
  restaurantId: string;
  /** The first page, rendered on the server with the rest of the restaurant's page. */
  initialReviews: Paginated<ReviewDto>;
}

/**
 * A restaurant's reviews, newest first, and what the reader can do about writing one.
 *
 * The first page comes from the server. Other pages are fetched in the browser. When the reader
 * writes or deletes a review, the server part of the page is refreshed, which brings a new first
 * page and the restaurant's new average together.
 */
export default function RestaurantReviews({
  restaurantId,
  initialReviews,
}: RestaurantReviewsProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [page, setPage] = useState(1);

  const showingInitial = page === 1;
  const { currentData, isFetching, isError, refetch } = useGetReviewsQuery(
    { restaurantId, page },
    { skip: showingInitial },
  );
  const results = showingInitial ? initialReviews : currentData;

  // The last page shown, kept on screen while the next one loads.
  const [lastResults, setLastResults] = useState(initialReviews);
  if (results && results !== lastResults) setLastResults(results);
  const { items, total, totalPages } = results ?? lastResults;

  const isPending = (!results && isFetching) || isRefreshing;

  const onChanged = () => {
    setPage(1);
    startRefresh(() => router.refresh());
  };

  return (
    <Stack component="section" spacing={3} aria-labelledby="reviews-heading">
      <Typography id="reviews-heading" variant="h5" component="h2">
        Reviews{total > 0 && ` (${total})`}
      </Typography>

      <ReviewComposer restaurantId={restaurantId} onChanged={onChanged} />

      <Box sx={{ height: 4 }}>{isPending && <LinearProgress aria-label="Loading reviews" />}</Box>

      {!results && isError && !isFetching ? (
        <StatusAlert severity="error" onRetry={() => refetch()}>
          The reviews could not be loaded.
        </StatusAlert>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">No reviews yet. Be the first to write one.</Typography>
      ) : (
        <Stack
          spacing={2}
          divider={<Divider flexItem />}
          aria-busy={isPending}
          sx={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s' }}
        >
          {items.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </Stack>
      )}

      {totalPages > 1 && (
        <Pagination
          sx={{ alignSelf: 'center' }}
          count={totalPages}
          page={Math.min(page, totalPages)}
          onChange={(_event, next) => setPage(next)}
          disabled={isPending}
        />
      )}
    </Stack>
  );
}
