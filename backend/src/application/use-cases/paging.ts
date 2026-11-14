import type { Paginated } from '@restaurant-reviews/common';
import type { PaginatedResponse, Pagination } from '../ports/Pagination';

/** The slice of results that page `page` covers, at `limit` items per page. */
export function sliceFor(page: number, limit: number): Pagination {
  return { skip: (page - 1) * limit, limit };
}

/** A repository's slice as a page, with the totals the client needs for its page controls. */
export function toPage<T>(
  { items, total }: PaginatedResponse<T>,
  page: number,
  limit: number,
): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
