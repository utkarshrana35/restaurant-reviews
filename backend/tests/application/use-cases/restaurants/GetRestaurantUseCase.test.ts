import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../../src/domain/errors';
import {
  createRestaurantFixture,
  OWNER_A,
  type RestaurantFixture,
} from '../../../support/restaurantFixture';

let f: RestaurantFixture;

beforeEach(() => {
  f = createRestaurantFixture();
});

describe('GetRestaurantUseCase', () => {
  it('returns a restaurant to anyone who asks for it by id', async () => {
    const restaurant = await f.createFor(OWNER_A);

    expect(await f.getRestaurant.execute({ id: restaurant.id })).toEqual(restaurant);
  });

  it('finds a restaurant by the slug in its public URL', async () => {
    const restaurant = await f.createFor(OWNER_A);

    expect(await f.getRestaurant.execute({ slug: restaurant.slug })).toEqual(restaurant);
  });

  it('reports a restaurant that does not exist', async () => {
    await expect(f.getRestaurant.execute({ id: 'nope' })).rejects.toThrow(NotFoundError);
    await expect(f.getRestaurant.execute({ slug: 'nope' })).rejects.toThrow(NotFoundError);
  });
});
