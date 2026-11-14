import { beforeEach, describe, expect, it } from 'vitest';
import type { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../src/domain/errors';
import { SAMPLE_BYTES } from '../../../support/InMemoryFileStorage';
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

describe('UpdateRestaurantUseCase', () => {
  it('changes only the fields that were sent', async () => {
    const updated = await f.updateRestaurant.execute({
      id: restaurant.id,
      ownerId: OWNER_A,
      changes: { title: 'New name' },
    });

    expect(updated).toMatchObject({
      title: 'New name',
      // Kept, so links to the restaurant still work after the rename.
      slug: restaurant.slug,
      location: restaurant.location,
      description: restaurant.description,
      cuisine: restaurant.cuisine,
      imageKey: restaurant.imageKey,
    });
    expect(f.storage.keys()).toEqual([restaurant.imageKey]);
  });

  it('refuses a change by a different owner and leaves the restaurant as it was', async () => {
    await expect(
      f.updateRestaurant.execute({
        id: restaurant.id,
        ownerId: OWNER_B,
        changes: { title: 'Hijacked' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(f.restaurants.restaurants[0]?.title).toBe('Thyme Traveler');
  });

  it('reports a restaurant that does not exist', async () => {
    await expect(
      f.updateRestaurant.execute({ id: 'nope', ownerId: OWNER_A, changes: { title: 'x' } }),
    ).rejects.toThrow(NotFoundError);
  });

  describe('replacing the image', () => {
    it('publishes the new image and deletes the old one', async () => {
      const imageKey = await f.uploadImage(OWNER_A, SAMPLE_BYTES.png);

      const updated = await f.updateRestaurant.execute({
        id: restaurant.id,
        ownerId: OWNER_A,
        changes: { imageKey },
      });

      expect(updated.imageKey).toMatch(/^restaurants\/.*\.png$/);
      expect(updated.imageKey).not.toBe(restaurant.imageKey);
      expect(f.storage.keys()).toEqual([updated.imageKey]);
    });

    it('keeps the old image when the new upload is rejected', async () => {
      const imageKey = await f.uploadImage(OWNER_A, SAMPLE_BYTES.notAnImage);

      await expect(
        f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A, changes: { imageKey } }),
      ).rejects.toThrow(ValidationError);

      expect(f.restaurants.restaurants[0]?.imageKey).toBe(restaurant.imageKey);
      expect(f.storage.keys()).toEqual([restaurant.imageKey]);
    });

    it('keeps the old image and the upload, but no new published copy, when saving fails', async () => {
      const imageKey = await f.uploadImage(OWNER_A);
      f.restaurants.failNextWrite = true;

      await expect(
        f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A, changes: { imageKey } }),
      ).rejects.toThrow('Database unavailable');

      expect(f.storage.keys()).toEqual([restaurant.imageKey, imageKey]);
    });

    it('replaces the image when the owner retries after a failed save, without uploading again', async () => {
      const imageKey = await f.uploadImage(OWNER_A, SAMPLE_BYTES.png);
      f.restaurants.failNextWrite = true;
      await expect(
        f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A, changes: { imageKey } }),
      ).rejects.toThrow('Database unavailable');

      const updated = await f.updateRestaurant.execute({
        id: restaurant.id,
        ownerId: OWNER_A,
        changes: { imageKey },
      });

      expect(updated.imageKey).toMatch(/^restaurants\/.*\.png$/);
      expect(f.storage.keys()).toEqual([updated.imageKey]);
    });

    it('removes the image it replaced when another update changed it after the ownership check', async () => {
      const otherTabUpload = await f.uploadImage(OWNER_A, SAMPLE_BYTES.png);
      const imageKey = await f.uploadImage(OWNER_A, SAMPLE_BYTES.png);
      // The other tab's save lands between this save's ownership check and its write.
      f.restaurants.changeAfterNextRead(() =>
        f.updateRestaurant.execute({
          id: restaurant.id,
          ownerId: OWNER_A,
          changes: { imageKey: otherTabUpload },
        }),
      );

      const updated = await f.updateRestaurant.execute({
        id: restaurant.id,
        ownerId: OWNER_A,
        changes: { imageKey },
      });

      // Only the image now in use is left: the other tab's image, which this save replaced, is
      // removed rather than the original one (already gone) a second time.
      expect(f.storage.keys()).toEqual([updated.imageKey]);
    });

    it('keeps the upload, but no published copy, when the restaurant is deleted after the ownership check', async () => {
      const imageKey = await f.uploadImage(OWNER_A);
      f.restaurants.changeAfterNextRead(() => f.restaurants.delete(restaurant.id));

      await expect(
        f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_A, changes: { imageKey } }),
      ).rejects.toThrow(NotFoundError);

      // The original image is the deleting request's to remove; this one leaves only its upload.
      expect(f.storage.keys()).toEqual([restaurant.imageKey, imageKey]);
    });

    it('does not let another owner swap in their upload', async () => {
      const imageKey = await f.uploadImage(OWNER_B);

      await expect(
        f.updateRestaurant.execute({ id: restaurant.id, ownerId: OWNER_B, changes: { imageKey } }),
      ).rejects.toThrow(ForbiddenError);

      expect(f.restaurants.restaurants[0]?.imageKey).toBe(restaurant.imageKey);
    });
  });
});
