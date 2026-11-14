import { describe, expect, it } from 'vitest';
import { restaurantListQuerySchema } from '../../src/schemas/restaurantList';

describe('restaurantListQuerySchema', () => {
  it('defaults to the first page of twelve, best rated first, unfiltered', () => {
    expect(restaurantListQuerySchema.parse({})).toEqual({
      sort: 'rating_desc',
      page: 1,
      limit: 12,
    });
  });

  it('coerces query-string values and keeps the filters', () => {
    expect(
      restaurantListQuerySchema.parse({
        cuisine: 'greek',
        minRating: '2',
        maxRating: '4',
        sort: 'rating_asc',
        page: '2',
      }),
    ).toEqual({
      cuisine: 'greek',
      minRating: 2,
      maxRating: 4,
      sort: 'rating_asc',
      page: 2,
      limit: 12,
    });
  });

  it('accepts an equal minimum and maximum', () => {
    expect(restaurantListQuerySchema.safeParse({ minRating: '3', maxRating: '3' }).success).toBe(
      true,
    );
  });

  it('reports a minimum above the maximum on the maximum', () => {
    const result = restaurantListQuerySchema.safeParse({ minRating: '4', maxRating: '2' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['maxRating']);
  });

  it.each([
    ['an unknown cuisine', { cuisine: 'klingon' }],
    ['a rating of 0', { minRating: '0' }],
    ['a rating of 6', { maxRating: '6' }],
    ['a fractional rating', { minRating: '3.5' }],
    ['an unknown order', { sort: 'random' }],
  ])('rejects %s', (_label, query) => {
    expect(restaurantListQuerySchema.safeParse(query).success).toBe(false);
  });

  it('drops parameters it does not know, including operator-shaped ones', () => {
    expect(restaurantListQuerySchema.parse({ 'owner[$ne]': 'x', debug: '1' })).toEqual({
      sort: 'rating_desc',
      page: 1,
      limit: 12,
    });
  });
});
