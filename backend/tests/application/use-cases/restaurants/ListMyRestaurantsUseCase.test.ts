import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRestaurantFixture,
  OWNER_A,
  OWNER_B,
  type RestaurantFixture,
} from '../../../support/restaurantFixture';

let f: RestaurantFixture;

beforeEach(() => {
  f = createRestaurantFixture();
});

describe('ListMyRestaurantsUseCase', () => {
  it('returns only the caller’s restaurants, newest first', async () => {
    await f.createFor(OWNER_A, { title: 'First' });
    await f.createFor(OWNER_B, { title: 'Someone else’s' });
    await f.createFor(OWNER_A, { title: 'Second' });

    const mine = await f.listMyRestaurants.execute({ ownerId: OWNER_A });

    expect(mine.map((restaurant) => restaurant.title)).toEqual(['Second', 'First']);
  });

  it('returns an empty list for an owner with no restaurants', async () => {
    await f.createFor(OWNER_B);

    expect(await f.listMyRestaurants.execute({ ownerId: OWNER_A })).toEqual([]);
  });
});
