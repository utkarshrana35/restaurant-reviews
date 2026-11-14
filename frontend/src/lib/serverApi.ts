import 'server-only';
import type { Paginated, RestaurantDto, ReviewDto } from '@restaurant-reviews/common';
import { cache } from 'react';
import { DEFAULT_FILTERS, toQueryString, type ListFilters } from './listQuery';

// The same address next.config.ts proxies /api to. Server components call the API directly.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000';

/** The API could not be reached or answered with an unexpected error. */
export class ApiUnavailableError extends Error {}

async function get(path: string): Promise<Response> {
  try {
    // Always fresh: listings change as owners edit and reviewers rate.
    return await fetch(`${API_URL}/api${path}`, { cache: 'no-store' });
  } catch (err) {
    throw new ApiUnavailableError('The API could not be reached', { cause: err });
  }
}

/** One page of the public restaurant list, for server rendering. */
export async function fetchRestaurants(
  filters: ListFilters = DEFAULT_FILTERS,
): Promise<Paginated<RestaurantDto>> {
  const response = await get(`/restaurants?${toQueryString(filters)}`);
  if (!response.ok) throw new ApiUnavailableError(`Listing failed with ${response.status}`);
  return (await response.json()) as Paginated<RestaurantDto>;
}

/** The first page of a restaurant's reviews, newest first, for server rendering. */
export async function fetchReviews(restaurantId: string): Promise<Paginated<ReviewDto>> {
  const response = await get(`/restaurants/${encodeURIComponent(restaurantId)}/reviews`);
  if (!response.ok) throw new ApiUnavailableError(`Reviews failed with ${response.status}`);
  return (await response.json()) as Paginated<ReviewDto>;
}

/**
 * The restaurant with this slug, or null if there is none. Cached per request, so the page and
 * its metadata share one API call.
 */
export const fetchRestaurantBySlug = cache(async (slug: string): Promise<RestaurantDto | null> => {
  const response = await get(`/restaurants/by-slug/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new ApiUnavailableError(`Restaurant lookup failed with ${response.status}`);
  return (await response.json()) as RestaurantDto;
});
