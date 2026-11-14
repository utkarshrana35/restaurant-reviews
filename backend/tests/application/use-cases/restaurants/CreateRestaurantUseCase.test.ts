import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../../src/domain/errors';
import { SAMPLE_BYTES } from '../../../support/InMemoryFileStorage';
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

describe('CreateRestaurantUseCase', () => {
  it('creates the restaurant for the caller with the uploaded image published', async () => {
    const imageKey = await f.uploadImage(OWNER_A);

    const restaurant = await f.createRestaurant.execute({
      ownerId: OWNER_A,
      details: f.details({ imageKey }),
    });

    expect(restaurant).toMatchObject({
      ownerId: OWNER_A,
      title: 'Thyme Traveler',
      cuisine: 'italian',
      ratingAvg: null,
      ratingCount: 0,
    });
    expect(restaurant.imageKey).toMatch(/^restaurants\//);
    expect(f.storage.keys()).toEqual([restaurant.imageKey]);
  });

  it('creates nothing when the image belongs to another owner’s upload', async () => {
    const imageKey = await f.uploadImage(OWNER_B);

    await expect(
      f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) }),
    ).rejects.toThrow(ValidationError);

    expect(f.restaurants.restaurants).toHaveLength(0);
  });

  it('creates nothing when the upload is not an image', async () => {
    const imageKey = await f.uploadImage(OWNER_A, SAMPLE_BYTES.notAnImage);

    await expect(
      f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) }),
    ).rejects.toThrow(ValidationError);

    expect(f.restaurants.restaurants).toHaveLength(0);
    expect(f.storage.keys()).toEqual([]);
  });

  it('leaves no published image behind when saving the restaurant fails, but keeps the upload', async () => {
    const imageKey = await f.uploadImage(OWNER_A);
    f.restaurants.failNextWrite = true;

    await expect(
      f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) }),
    ).rejects.toThrow('Database unavailable');

    expect(f.storage.keys()).toEqual([imageKey]);
  });

  it('succeeds when the owner retries after a failed save, without uploading again', async () => {
    const imageKey = await f.uploadImage(OWNER_A);
    f.restaurants.failNextWrite = true;
    await expect(
      f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) }),
    ).rejects.toThrow('Database unavailable');

    const restaurant = await f.createRestaurant.execute({
      ownerId: OWNER_A,
      details: f.details({ imageKey }),
    });

    expect(f.restaurants.restaurants).toHaveLength(1);
    expect(f.storage.keys()).toEqual([restaurant.imageKey]);
  });

  it('cannot reuse one upload for two restaurants', async () => {
    const imageKey = await f.uploadImage(OWNER_A);
    await f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) });

    await expect(
      f.createRestaurant.execute({ ownerId: OWNER_A, details: f.details({ imageKey }) }),
    ).rejects.toThrow(ValidationError);

    expect(f.restaurants.restaurants).toHaveLength(1);
  });

  describe('the slug', () => {
    /** The error a taken slug is refused with, attached to the slug field. */
    const slugTaken = expect.objectContaining({
      code: 'CONFLICT',
      details: [{ path: 'slug', message: expect.stringContaining('already uses this address') }],
    });

    it('is the one the owner chose', async () => {
      const restaurant = await f.createFor(OWNER_A, { slug: 'thyme-on-main' });

      expect(restaurant.slug).toBe('thyme-on-main');
      expect(await f.getRestaurant.execute({ slug: 'thyme-on-main' })).toEqual(restaurant);
    });

    it('is refused when another restaurant has it, whoever owns it', async () => {
      await f.createFor(OWNER_A, { slug: 'thyme-traveler' });
      const imageKey = await f.uploadImage(OWNER_B);

      await expect(
        f.createRestaurant.execute({
          ownerId: OWNER_B,
          details: f.details({ imageKey, slug: 'thyme-traveler' }),
        }),
      ).rejects.toEqual(slugTaken);

      expect(f.restaurants.restaurants).toHaveLength(1);
      // No published copy is left behind, and the upload is kept, so the owner can choose
      // another slug and submit again without uploading the file again.
      expect(f.storage.keys()).toEqual([f.restaurants.restaurants[0]!.imageKey, imageKey]);
    });

    it('needs no lookup before saving: the unique index decides', async () => {
      const findOne = vi.spyOn(f.restaurants, 'findOne');

      await f.createFor(OWNER_A, { slug: 'thyme-traveler' });

      expect(findOne).not.toHaveBeenCalled();
    });
  });
});
