import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { ForbiddenError, NotFoundError } from '../../../../src/domain/errors';
import {
  createRestaurantFixture,
  OWNER_A,
  OWNER_B,
  type RestaurantFixture,
} from '../../../support/restaurantFixture';

let f: RestaurantFixture;
let restaurant: Restaurant;

beforeEach(async () => {
  f = createRestaurantFixture();
  restaurant = await f.createFor(OWNER_A);
});

describe('DeleteRestaurantUseCase', () => {
  it('removes the restaurant and its image', async () => {
    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    expect(f.restaurants.restaurants).toHaveLength(0);
    expect(f.storage.keys()).toEqual([]);
  });

  it("removes the restaurant's reviews and leaves other restaurants' reviews alone", async () => {
    const other = await f.createFor(OWNER_A, { title: 'Other place' });
    const review = { authorId: 'r', authorName: 'R', rating: 4, comment: 'Nice' };
    await f.reviews.create({ ...review, restaurantId: restaurant.id });
    await f.reviews.create({ ...review, restaurantId: other.id });

    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    expect(f.reviews.reviews.map((r) => r.restaurantId)).toEqual([other.id]);
  });

  it('refuses a different owner and deletes nothing', async () => {
    await expect(
      f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_B }),
    ).rejects.toThrow(ForbiddenError);

    expect(f.restaurants.restaurants).toHaveLength(1);
    expect(f.storage.keys()).toEqual([restaurant.imageKey]);
  });

  it('reports a restaurant that does not exist, including one already deleted', async () => {
    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    await expect(
      f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A }),
    ).rejects.toThrow(NotFoundError);
  });

  it('still deletes the restaurant when its image cannot be removed', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    f.storage.failNextDelete = true;

    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    expect(f.restaurants.restaurants).toHaveLength(0);
    logged.mockRestore();
  });

  it('removes the image the restaurant had when deleted, even one set after the ownership check', async () => {
    const imageKey = await f.uploadImage(OWNER_A);
    // An image replacement lands between the ownership check and the delete.
    f.restaurants.changeAfterNextRead(() =>
      f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A, changes: { imageKey } }),
    );

    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    // The replacement image is removed too, not only the original one it had already replaced.
    expect(f.restaurants.restaurants).toHaveLength(0);
    expect(f.storage.keys()).toEqual([]);
  });

  it('still removes the reviews when another request deleted the restaurant first', async () => {
    const review = { authorId: 'r', authorName: 'R', rating: 4, comment: 'Nice' };
    await f.reviews.create({ ...review, restaurantId: restaurant.id });
    // The other request deletes only the record, as if it failed before its own cleanup.
    f.restaurants.changeAfterNextRead(() => f.restaurants.delete(restaurant.id));

    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    expect(f.reviews.reviews).toEqual([]);
    // The image is left to the request that deleted the restaurant.
    expect(f.storage.keys()).toEqual([restaurant.imageKey]);
  });

  it('leaves the owner’s other restaurants alone', async () => {
    const other = await f.createFor(OWNER_A, { title: 'Second place' });

    await f.deleteRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A });

    expect(f.restaurants.restaurants.map((r) => r.id)).toEqual([other.id]);
    expect(f.storage.keys()).toEqual([other.imageKey]);
  });
});
