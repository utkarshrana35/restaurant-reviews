import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  isDefaultPreferences,
  paramsFromSearch,
  parseListFilters,
  toQueryString,
  urlNamesPreferences,
} from '@/lib/listQuery';

describe('parseListFilters', () => {
  it('gives the defaults for an empty query', () => {
    expect(parseListFilters({})).toEqual({ ...DEFAULT_FILTERS });
  });

  it('reads every valid parameter', () => {
    expect(
      parseListFilters({
        cuisine: 'greek',
        minRating: '2',
        maxRating: '4',
        sort: 'rating_asc',
        page: '3',
      }),
    ).toEqual({ cuisine: 'greek', minRating: 2, maxRating: 4, sort: 'rating_asc', page: 3 });
  });

  it.each([
    ['an unknown cuisine', { cuisine: 'klingon' }],
    ['a rating out of range', { minRating: '0', maxRating: '6' }],
    ['a fractional rating', { minRating: '3.5' }],
    ['a signed or padded number', { minRating: '+3', maxRating: ' 4' }],
    ['an unknown sort order', { sort: 'random' }],
    ['page zero', { page: '0' }],
    ['a page beyond the cap', { page: '10001' }],
    ['a non-numeric page', { page: 'abc' }],
  ])('drops %s instead of failing', (_label, params) => {
    expect(parseListFilters(params)).toEqual({ ...DEFAULT_FILTERS });
  });

  it('keeps the minimum and drops the maximum when they contradict', () => {
    const filters = parseListFilters({ minRating: '4', maxRating: '2' });

    expect(filters.minRating).toBe(4);
    expect(filters.maxRating).toBeUndefined();
  });

  it('accepts an equal minimum and maximum', () => {
    expect(parseListFilters({ minRating: '3', maxRating: '3' })).toMatchObject({
      minRating: 3,
      maxRating: 3,
    });
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseListFilters({ cuisine: ['french', 'greek'] }).cuisine).toBe('french');
  });
});

describe('paramsFromSearch', () => {
  it('gives the shape Next.js gives a page, so both sides parse a URL the same way', () => {
    const search = new URLSearchParams('cuisine=french&cuisine=greek&page=2');

    expect(paramsFromSearch(search)).toEqual({ cuisine: ['french', 'greek'], page: '2' });
    expect(parseListFilters(paramsFromSearch(search))).toEqual(
      parseListFilters({ cuisine: ['french', 'greek'], page: '2' }),
    );
  });
});

describe('toQueryString', () => {
  it('is empty for the defaults', () => {
    expect(toQueryString(DEFAULT_FILTERS)).toBe('');
  });

  it('includes only what differs from the defaults', () => {
    expect(toQueryString({ ...DEFAULT_FILTERS, cuisine: 'indian', page: 2 })).toBe(
      'cuisine=indian&page=2',
    );
  });

  it('round-trips through parseListFilters', () => {
    const filters = {
      cuisine: 'japanese',
      minRating: 1,
      maxRating: 5,
      sort: 'rating_asc',
      page: 7,
    } as const;

    const params = Object.fromEntries(new URLSearchParams(toQueryString(filters)));

    expect(parseListFilters(params)).toEqual(filters);
  });
});

describe('isDefaultPreferences', () => {
  it('is true only when no filter is set and the order is the default', () => {
    expect(isDefaultPreferences({ sort: 'rating_desc' })).toBe(true);
    expect(isDefaultPreferences({ sort: 'rating_asc' })).toBe(false);
    expect(isDefaultPreferences({ sort: 'rating_desc', maxRating: 3 })).toBe(false);
  });
});

describe('urlNamesPreferences', () => {
  it('ignores the page, which is not a preference', () => {
    expect(urlNamesPreferences({})).toBe(false);
    expect(urlNamesPreferences({ page: '2' })).toBe(false);
  });

  it('is true when any filter or the order is present', () => {
    expect(urlNamesPreferences({ sort: 'rating_desc' })).toBe(true);
    expect(urlNamesPreferences({ cuisine: 'greek' })).toBe(true);
  });
});
