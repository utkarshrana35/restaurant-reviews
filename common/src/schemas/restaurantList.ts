import { z } from 'zod';
import { CUISINES, DEFAULT_SORT_ORDER, RATING_MAX, RATING_MIN, SORT_ORDERS } from '../constants';
import { pageQueryShape } from './pagination';

/** Restaurants per page when the client does not ask for a size. */
export const DEFAULT_PAGE_SIZE = 12;

// Query-string values always arrive as strings, so numbers are coerced.
const rating = z.coerce.number().int('Ratings are whole stars').min(RATING_MIN).max(RATING_MAX);

/**
 * Query of `GET /api/restaurants`: optional cuisine and rating range, sort order, and page.
 * Defaults give the first page of every restaurant, best rated first.
 */
export const restaurantListQuerySchema = z
  .object({
    cuisine: z.enum(CUISINES).optional(),
    minRating: rating.optional(),
    maxRating: rating.optional(),
    sort: z.enum(SORT_ORDERS).default(DEFAULT_SORT_ORDER),
    ...pageQueryShape(DEFAULT_PAGE_SIZE),
  })
  .refine(
    (query) =>
      query.minRating === undefined ||
      query.maxRating === undefined ||
      query.minRating <= query.maxRating,
    { message: 'The minimum rating cannot be above the maximum', path: ['maxRating'] },
  );

export type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>;
