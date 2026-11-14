import type { RestaurantListQuery } from '@restaurant-reviews/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRestaurantFixture,
  OWNER_A,
  type RestaurantFixture,
} from '../../../support/restaurantFixture';

let f: RestaurantFixture;

const query = (overrides: Partial<RestaurantListQuery> = {}): RestaurantListQuery => ({
  sort: 'rating_desc',
  page: 1,
  limit: 12,
  ...overrides,
});

/** Creates restaurants with the given ratings (null for unrated), titled by their position. */
async function seed(ratings: (number | null)[], cuisine: 'italian' | 'greek' = 'italian') {
  for (const [index, rating] of ratings.entries()) {
    const restaurant = await f.createFor(OWNER_A, { title: `R${index}`, cuisine });
    f.restaurants.rate(restaurant.id, rating);
  }
}

const titles = (items: { title: string }[]) => items.map((item) => item.title);

beforeEach(() => {
  f = createRestaurantFixture();
});

describe('ListRestaurantsUseCase', () => {
  it('lists best rated first by default, with unrated restaurants last', async () => {
    await seed([3, null, 5, 4.5]);

    const page = await f.listRestaurants.execute(query());

    expect(titles(page.items)).toEqual(['R2', 'R3', 'R0', 'R1']);
  });

  it('lists worst rated first on request, still with unrated restaurants last', async () => {
    await seed([3, null, 5, 4.5]);

    const page = await f.listRestaurants.execute(query({ sort: 'rating_asc' }));

    expect(titles(page.items)).toEqual(['R0', 'R3', 'R2', 'R1']);
  });

  it('keeps restaurants with equal ratings in a stable order, so pages do not overlap', async () => {
    await seed([4, 4, 4, 4]);

    const first = await f.listRestaurants.execute(query({ limit: 2 }));
    const second = await f.listRestaurants.execute(query({ limit: 2, page: 2 }));

    expect([...titles(first.items), ...titles(second.items)]).toEqual(['R0', 'R1', 'R2', 'R3']);
  });

  it('pages through the results and reports the totals', async () => {
    await seed([5, 4, 3, 2, 1]);

    const page = await f.listRestaurants.execute(query({ limit: 2, page: 2 }));

    expect(titles(page.items)).toEqual(['R2', 'R3']);
    expect(page).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('returns an empty page past the end, with the true totals', async () => {
    await seed([5, 4]);

    const page = await f.listRestaurants.execute(query({ page: 9 }));

    expect(page).toMatchObject({ items: [], page: 9, total: 2, totalPages: 1 });
  });

  it('reports no pages when nothing matches', async () => {
    const page = await f.listRestaurants.execute(query());

    expect(page).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('filters by cuisine', async () => {
    await seed([5, 4], 'italian');
    await seed([3], 'greek');

    const page = await f.listRestaurants.execute(query({ cuisine: 'greek' }));

    expect(page.items.map((restaurant) => restaurant.cuisine)).toEqual(['greek']);
  });

  it('filters by a rating range, inclusive at both ends, leaving out unrated restaurants', async () => {
    await seed([5, 4.5, 4, 3, 2, null]);

    const page = await f.listRestaurants.execute(query({ minRating: 3, maxRating: 4 }));

    expect(titles(page.items)).toEqual(['R2', 'R3']);
  });

  it('treats a minimum on its own as "at least", leaving out unrated restaurants', async () => {
    await seed([5, 3.9, null]);

    const page = await f.listRestaurants.execute(query({ minRating: 4 }));

    expect(titles(page.items)).toEqual(['R0']);
  });
});
