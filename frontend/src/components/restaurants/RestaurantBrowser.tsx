'use client';

import type { Paginated, RestaurantDto } from '@restaurant-reviews/common';
import { useState } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Pagination,
  Stack,
  StatusAlert,
  Typography,
} from '@/components/ui';
import { useListPreferences } from '@/hooks/useListPreferences';
import {
  DEFAULT_PREFERENCES,
  isDefaultPreferences,
  toQueryString,
  type ListFilters,
} from '@/lib/listQuery';
import { useGetRestaurantsQuery } from '@/store/apiSlice';
import RestaurantCard from './RestaurantCard';
import RestaurantFilters from './RestaurantFilters';
import { RESTAURANT_GRID } from './restaurantGrid';

interface RestaurantBrowserProps {
  /** The filters in the URL the server rendered this page for. */
  initialFilters: ListFilters;
  /** The results the server fetched for them, shown without asking the API again. */
  initialResults: Paginated<RestaurantDto>;
}

/**
 * The public restaurant list: filters, sort order, results and pagination.
 *
 * The server renders the first page, so the first response already contains restaurants. After
 * that the browser takes over: a change updates the URL and RTK Query fetches the matching page,
 * caching each combination, so returning to one seen recently is instant. While a new page
 * loads, the previous results stay on screen, dimmed under a progress bar.
 */
export default function RestaurantBrowser({
  initialFilters,
  initialResults,
}: RestaurantBrowserProps) {
  const { filters, changePreferences, changePage } = useListPreferences();
  const showingInitial = toQueryString(filters) === toQueryString(initialFilters);
  const { currentData, isFetching, isError, refetch } = useGetRestaurantsQuery(filters, {
    skip: showingInitial,
  });
  const results = showingInitial ? initialResults : currentData;

  // The last results shown, kept on screen while the next ones load.
  const [lastResults, setLastResults] = useState(initialResults);
  if (results && results !== lastResults) setLastResults(results);
  const { items, total, totalPages } = results ?? lastResults;

  const isPending = !results && isFetching;
  const { page: _page, ...preferences } = filters;

  return (
    <Stack spacing={3}>
      <RestaurantFilters value={preferences} onChange={changePreferences} />

      {/* Reserves its height so the list does not jump when loading starts and stops. */}
      <Box sx={{ height: 4 }}>
        {isPending && <LinearProgress aria-label="Loading restaurants" />}
      </Box>

      {!results && isError && !isFetching ? (
        <StatusAlert severity="error" onRetry={() => refetch()}>
          The restaurants could not be loaded.
        </StatusAlert>
      ) : (
        <Box
          aria-busy={isPending}
          sx={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s' }}
        >
          {items.length === 0 ? (
            <EmptyResults
              filtered={!isDefaultPreferences(preferences)}
              pastTheEnd={total > 0}
              onReset={() => changePreferences(DEFAULT_PREFERENCES)}
              onFirstPage={() => changePage(1)}
            />
          ) : (
            <Stack spacing={3}>
              <Typography variant="body2" color="text.secondary" role="status">
                {total} {total === 1 ? 'restaurant' : 'restaurants'}
              </Typography>
              <Box sx={RESTAURANT_GRID}>
                {items.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </Box>
            </Stack>
          )}
        </Box>
      )}

      {totalPages > 1 && (
        <Pagination
          sx={{ alignSelf: 'center' }}
          count={totalPages}
          page={Math.min(filters.page, totalPages)}
          onChange={(_event, page) => changePage(page)}
          disabled={isPending}
        />
      )}
    </Stack>
  );
}

interface EmptyResultsProps {
  /** Filters are applied; clearing them may show restaurants. */
  filtered: boolean;
  /** Results exist, but the page asked for is past the last one. */
  pastTheEnd: boolean;
  onReset: () => void;
  onFirstPage: () => void;
}

function EmptyResults({ filtered, pastTheEnd, onReset, onFirstPage }: EmptyResultsProps) {
  let message = 'No restaurants have been added yet.';
  let action = null;
  if (pastTheEnd) {
    message = 'This page is past the end of the list.';
    action = <Button onClick={onFirstPage}>Go to the first page</Button>;
  } else if (filtered) {
    message = 'No restaurants match these filters.';
    action = (
      <Button variant="contained" onClick={onReset}>
        Clear filters
      </Button>
    );
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start', py: 4 }}>
      <Typography color="text.secondary">{message}</Typography>
      {action}
    </Stack>
  );
}
