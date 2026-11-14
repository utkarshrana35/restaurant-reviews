import { z } from 'zod';

/** The most items one page may hold. */
export const MAX_PAGE_SIZE = 50;
/** The highest page number accepted, so a request cannot ask the database to skip without limit. */
export const MAX_PAGE = 10_000;

/**
 * The `page` and `limit` query parameters of a paginated endpoint, with the page size it uses
 * when the client does not ask for one. Query-string values arrive as strings, so they are
 * coerced.
 */
export function pageQueryShape(defaultLimit: number) {
  return {
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(defaultLimit),
  };
}
