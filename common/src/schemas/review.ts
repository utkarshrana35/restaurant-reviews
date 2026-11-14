import { z } from 'zod';
import { RATING_MAX, RATING_MIN, REVIEW_COMMENT_MAX_LENGTH } from '../constants';
import { pageQueryShape } from './pagination';

/** Reviews per page when the client does not ask for a size. */
export const DEFAULT_REVIEW_PAGE_SIZE = 10;

/**
 * Body of `POST /api/restaurants/:id/reviews`. The author and the restaurant come from the
 * session and the URL, never from the body.
 */
export const reviewCreateSchema = z.object({
  rating: z
    .number('Choose a rating')
    .int('Ratings are whole stars')
    .min(RATING_MIN, 'Choose a rating')
    .max(RATING_MAX, `Ratings go up to ${RATING_MAX} stars`),
  comment: z
    .string()
    .trim()
    .min(1, 'Write a few words about your visit')
    .max(REVIEW_COMMENT_MAX_LENGTH, `Keep it under ${REVIEW_COMMENT_MAX_LENGTH} characters`),
});

/** Query of `GET /api/restaurants/:id/reviews`: newest first, one page at a time. */
export const reviewListQuerySchema = z.object(pageQueryShape(DEFAULT_REVIEW_PAGE_SIZE));

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
