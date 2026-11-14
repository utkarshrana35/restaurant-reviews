/** Which slice of an ordered result to return: skip this many, then return at most `limit`. */
export interface Pagination {
  skip: number;
  limit: number;
}

/** One slice of an ordered result, and how many items match in total across every slice. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
