'use client';

import { LinkButton, Skeleton, Stack, StatusAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { toApiError } from '@/lib/apiError';
import { useGetRestaurantQuery } from '@/store/apiSlice';
import RestaurantForm from './RestaurantForm';

/**
 * Loads a restaurant and shows its edit form, or explains why it cannot be edited. Rendered inside
 * the /owner layout, so a signed-in owner is already confirmed.
 */
export default function EditRestaurant({ id }: { id: string }) {
  const { user } = useAuth();
  const { data: restaurant, error, isLoading, isFetching, refetch } = useGetRestaurantQuery(id);

  if (isLoading) return <Skeleton variant="rounded" height={480} sx={{ maxWidth: 640 }} />;

  const backToList = (
    <LinkButton href="/owner/restaurants" variant="contained">
      Back to your restaurants
    </LinkButton>
  );

  if (!restaurant) {
    const notFound = error !== undefined && toApiError(error).code === 'NOT_FOUND';
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        {notFound ? (
          <StatusAlert severity="error">This restaurant does not exist or was deleted.</StatusAlert>
        ) : (
          <StatusAlert severity="error" onRetry={() => refetch()} retrying={isFetching}>
            The restaurant could not be loaded.
          </StatusAlert>
        )}
        {backToList}
      </Stack>
    );
  }

  // The API would refuse the save anyway; this avoids showing a form that cannot succeed.
  if (restaurant.ownerId !== user?.id) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <StatusAlert severity="error">You can only edit your own restaurants.</StatusAlert>
        {backToList}
      </Stack>
    );
  }

  // Keyed by id so that moving between two edit pages starts each form from its own values.
  return <RestaurantForm key={restaurant.id} restaurant={restaurant} />;
}
