import { RESTAURANT_GRID } from '@/components/restaurants/restaurantGrid';
import { Box, PageHeader, Skeleton, Stack } from '@/components/ui';

/**
 * Shown while the restaurant list is first rendered on the server.
 *
 * It sits in the `(list)` route group, which does not change the URL, so that it covers only
 * the list. A loading boundary above `/restaurants/[id]` would start the response before that
 * page can call `notFound()`, and an unknown restaurant would then be sent with status 200.
 */
export default function Loading() {
  return (
    <>
      <PageHeader title="Restaurants" />
      <Stack spacing={3} aria-busy="true" aria-label="Loading restaurants">
        <Skeleton variant="rounded" height={56} />
        <Box sx={RESTAURANT_GRID}>
          {[0, 1, 2, 3, 4, 5].map((placeholder) => (
            <Skeleton key={placeholder} variant="rounded" height={320} />
          ))}
        </Box>
      </Stack>
    </>
  );
}
