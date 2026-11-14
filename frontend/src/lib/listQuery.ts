import {
  CUISINES,
  DEFAULT_SORT_ORDER,
  MAX_PAGE,
  RATING_MAX,
  RATING_MIN,
  SORT_ORDERS,
  type Cuisine,
  type SortOrder,
} from '@restaurant-reviews/common';

/** What the visitor has chosen for the restaurant list: filters, order and page. */
export interface ListFilters {
  cuisine?: Cuisine;
  minRating?: number;
  maxRating?: number;
  sort: SortOrder;
  page: number;
}

/** The parts of the list's state that are remembered between visits. The page is not. */
export type ListPreferences = Omit<ListFilters, 'page'>;

export const DEFAULT_PREFERENCES: ListPreferences = { sort: DEFAULT_SORT_ORDER };
export const DEFAULT_FILTERS: ListFilters = { ...DEFAULT_PREFERENCES, page: 1 };

/** Query parameters as Next.js gives them to a page: a repeated name becomes an array. */
export type Params = Record<string, string | string[] | undefined>;

/** The same shape from a browser `URLSearchParams`, so both sides parse a URL identically. */
export function paramsFromSearch(search: Pick<URLSearchParams, 'keys' | 'getAll'>): Params {
  const params: Params = {};
  for (const name of new Set(search.keys())) {
    const values = search.getAll(name);
    params[name] = values.length === 1 ? values[0] : values;
  }
  return params;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined) =>
  allowed.find((candidate) => candidate === value);

function wholeNumberIn(value: string | undefined, min: number, max: number) {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
}

/**
 * Reads the list's state from a URL's query parameters or from saved preferences. Lenient on
 * purpose: anything invalid (a hand-edited URL, an outdated saved value) is dropped and its
 * default used, rather than showing an error page. A minimum above the maximum drops the maximum.
 */
export function parseListFilters(params: Params): ListFilters {
  const minRating = wholeNumberIn(first(params.minRating), RATING_MIN, RATING_MAX);
  let maxRating = wholeNumberIn(first(params.maxRating), RATING_MIN, RATING_MAX);
  if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
    maxRating = undefined;
  }

  return {
    cuisine: oneOf(CUISINES, first(params.cuisine)),
    minRating,
    maxRating,
    sort: oneOf(SORT_ORDERS, first(params.sort)) ?? DEFAULT_SORT_ORDER,
    page: wholeNumberIn(first(params.page), 1, MAX_PAGE) ?? 1,
  };
}

/** The query string for the list's state, leaving out anything at its default. */
export function toQueryString(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.cuisine) params.set('cuisine', filters.cuisine);
  if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
  if (filters.maxRating !== undefined) params.set('maxRating', String(filters.maxRating));
  if (filters.sort !== DEFAULT_SORT_ORDER) params.set('sort', filters.sort);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}

/** True when nothing differs from the default list. */
export function isDefaultPreferences(preferences: ListPreferences): boolean {
  return (
    preferences.cuisine === undefined &&
    preferences.minRating === undefined &&
    preferences.maxRating === undefined &&
    preferences.sort === DEFAULT_SORT_ORDER
  );
}

/** True when the URL itself names a filter or an order, so it takes precedence over saved ones. */
export function urlNamesPreferences(params: Params): boolean {
  return ['cuisine', 'minRating', 'maxRating', 'sort'].some((name) => params[name] !== undefined);
}
