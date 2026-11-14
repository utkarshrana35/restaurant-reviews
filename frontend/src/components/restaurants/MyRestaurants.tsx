'use client';

import { CUISINE_LABELS, type RestaurantDto } from '@restaurant-reviews/common';
import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  ConfirmDialog,
  LinkButton,
  Skeleton,
  Stack,
  StatusAlert,
  Typography,
} from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { restaurantPath } from '@/lib/restaurantPath';
import { useDeleteRestaurantMutation, useGetMyRestaurantsQuery } from '@/store/apiSlice';
import { RESTAURANT_GRID } from './restaurantGrid';

/** The signed-in owner's restaurants, each with edit and delete. */
export default function MyRestaurants() {
  const { data: restaurants, isLoading, isError, isFetching, refetch } = useGetMyRestaurantsQuery();
  const [deleteRestaurant, deletion] = useDeleteRestaurantMutation();
  const [pendingDelete, setPendingDelete] = useState<RestaurantDto | null>(null);

  if (isLoading) {
    return (
      <Box sx={RESTAURANT_GRID} aria-busy="true" aria-label="Loading your restaurants">
        {[0, 1, 2].map((placeholder) => (
          <Skeleton key={placeholder} variant="rounded" height={320} />
        ))}
      </Box>
    );
  }

  if (isError || !restaurants) {
    return (
      <StatusAlert severity="error" onRetry={() => refetch()} retrying={isFetching}>
        Your restaurants could not be loaded.
      </StatusAlert>
    );
  }

  if (restaurants.length === 0) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography color="text.secondary">You have not added any restaurants yet.</Typography>
        <LinkButton href="/owner/restaurants/new" variant="contained">
          Add your first restaurant
        </LinkButton>
      </Stack>
    );
  }

  const closeDialog = () => {
    setPendingDelete(null);
    deletion.reset();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRestaurant(pendingDelete.id).unwrap();
      closeDialog();
    } catch {
      // The dialog stays open and shows the error, so the owner can retry or cancel.
    }
  };

  return (
    <>
      <Box sx={RESTAURANT_GRID}>
        {restaurants.map((restaurant) => (
          <Card key={restaurant.id} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardMedia component="img" height={180} image={restaurant.imageUrl} alt="" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                {/* Rendered as text: a title containing markup is shown, never executed. */}
                <Typography variant="h6" component="h2" sx={{ overflowWrap: 'anywhere' }}>
                  {restaurant.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {restaurant.location}
                </Typography>
                <Chip size="small" label={CUISINE_LABELS[restaurant.cuisine]} />
              </Stack>
            </CardContent>
            <CardActions>
              <LinkButton href={restaurantPath(restaurant.slug)} size="small">
                View
              </LinkButton>
              <LinkButton href={`/owner/restaurants/${restaurant.id}/edit`} size="small">
                Edit
              </LinkButton>
              <Button size="small" color="error" onClick={() => setPendingDelete(restaurant)}>
                Delete
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this restaurant?"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={closeDialog}
        busy={deletion.isLoading}
        error={deletion.isError ? toApiError(deletion.error).message : null}
      >
        “{pendingDelete?.title}” and its image will be removed permanently. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
