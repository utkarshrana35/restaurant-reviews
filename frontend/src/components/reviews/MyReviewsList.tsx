'use client';

import type { Paginated, AuthoredReviewDto } from '@restaurant-reviews/common';
import Link from 'next/link';
import { useState } from 'react';
import RestaurantImage from '@/components/restaurants/RestaurantImage';
import {
  Box,
  LinearProgress,
  LinkButton,
  Pagination,
  Skeleton,
  Stack,
  StatusAlert,
  TextLink,
  Typography,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { restaurantPath } from '@/lib/restaurantPath';
import { useGetMyReviewsQuery } from '@/store/apiSlice';
import MyReview from './MyReview';

/**
 * Every review the signed-in reviewer has written, newest first, each under the name of the
 * restaurant it is about and with a Delete button. Renders nothing for other accounts.
 */
export default function MyReviewsList() {
  const { user } = useAuth();
  const isReviewer = user?.role === 'reviewer';
  const [page, setPage] = useState(1);
  const { data, currentData, isLoading, isFetching, isError, refetch } = useGetMyReviewsQuery(
    page,
    { skip: !isReviewer },
  );

  // After the last review on a later page is deleted, that page no longer exists.
  const [lastSeen, setLastSeen] = useState<Paginated<AuthoredReviewDto> | undefined>();
  if (currentData && currentData !== lastSeen) {
    setLastSeen(currentData);
    if (page > 1 && currentData.items.length === 0) setPage(Math.max(1, currentData.totalPages));
  }

  if (!isReviewer) return null;

  return (
    <Stack component="section" spacing={2} aria-labelledby="my-reviews-heading">
      <Typography id="my-reviews-heading" variant="h5" component="h2">
        Your reviews{data && data.total > 0 && ` (${data.total})`}
      </Typography>

      {isLoading ? (
        <Stack spacing={2} aria-busy="true" aria-label="Loading your reviews">
          {[0, 1].map((placeholder) => (
            <Skeleton key={placeholder} variant="rounded" height={140} />
          ))}
        </Stack>
      ) : isError && !data ? (
        <StatusAlert severity="error" onRetry={() => refetch()} retrying={isFetching}>
          Your reviews could not be loaded.
        </StatusAlert>
      ) : !data || data.total === 0 ? (
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography color="text.secondary">You have not reviewed any restaurants yet.</Typography>
          <LinkButton href="/" variant="contained">
            Find a restaurant
          </LinkButton>
        </Stack>
      ) : (
        <>
          <Box sx={{ height: 4 }}>
            {isFetching && <LinearProgress aria-label="Loading your reviews" />}
          </Box>
          <Stack spacing={2} sx={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {data.items.map((review) => (
              <MyReview
                key={review.id}
                review={review}
                media={
                  // The title below is the link screen readers and keyboards use; the image
                  // repeats it for the mouse only.
                  <Link
                    href={restaurantPath(review.restaurantSlug)}
                    tabIndex={-1}
                    aria-hidden
                    style={{ display: 'block' }}
                  >
                    <RestaurantImage
                      src={review.restaurantImageUrl}
                      height={{ xs: 160, sm: 120 }}
                    />
                  </Link>
                }
                heading={
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    <TextLink href={restaurantPath(review.restaurantSlug)}>
                      {review.restaurantTitle}
                    </TextLink>
                  </Typography>
                }
              />
            ))}
          </Stack>
          {data.totalPages > 1 && (
            <Pagination
              sx={{ alignSelf: 'center' }}
              count={data.totalPages}
              page={Math.min(page, data.totalPages)}
              onChange={(_event, next) => setPage(next)}
              disabled={isFetching}
            />
          )}
        </>
      )}
    </Stack>
  );
}
