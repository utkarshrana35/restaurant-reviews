import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RestaurantModel } from '../../../../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import { MongooseRestaurantRepository } from '../../../../../src/infrastructure/adapters/outbound/mongoose/MongooseRestaurantRepository';
import { clearDatabase, createTestApp, type TestApp } from '../../../../support/testApp';

// What the in-memory fake only imitates: the atomic reads that come with each write.

let t: TestApp;
const repository = new MongooseRestaurantRepository();

beforeAll(async () => {
  t = createTestApp();
  await t.container.database.connect();
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await t.container.database.disconnect();
});

async function storedRestaurant() {
  const doc = await RestaurantModel.create({
    owner: new Types.ObjectId(),
    slug: 'thyme-traveler',
    title: 'Thyme Traveler',
    location: '7 Wishing Well Way',
    description: 'A culinary adventure through time.',
    cuisine: 'italian',
    imageKey: 'restaurants/original.png',
  });
  return doc.id as string;
}

describe('MongooseRestaurantRepository', () => {
  describe('ratings', () => {
    it('gives each recalculation a higher revision', async () => {
      const id = await storedRestaurant();

      const first = await repository.startRatingUpdate(id);
      const second = await repository.startRatingUpdate(id);

      expect(second).toBeGreaterThan(first!);
    });

    it('ignores the result of a recalculation overtaken by a later one', async () => {
      const id = await storedRestaurant();
      const older = await repository.startRatingUpdate(id);
      const newer = await repository.startRatingUpdate(id);

      await repository.setRating(id, 3, 2, newer!);
      await repository.setRating(id, 5, 1, older!);

      expect(await RestaurantModel.findById(id).lean()).toMatchObject({
        ratingAvg: 3,
        ratingCount: 2,
        rated: true,
      });
    });

    it('has no revision for a restaurant that does not exist', async () => {
      expect(await repository.startRatingUpdate(new Types.ObjectId().toString())).toBeNull();
    });
  });

  describe('update', () => {
    it('returns the restaurant as it replaced it and as it left it', async () => {
      const id = await storedRestaurant();
      // Another update lands first; the next one reports that as what it replaced.
      await repository.update(id, { imageKey: 'restaurants/other-tab.png' });

      const result = await repository.update(id, {
        title: '  Renamed  ',
        imageKey: 'restaurants/new.png',
      });

      expect(result?.previous).toMatchObject({
        title: 'Thyme Traveler',
        imageKey: 'restaurants/other-tab.png',
      });
      // Trimmed the way the stored value is.
      expect(result?.updated).toMatchObject({ title: 'Renamed', imageKey: 'restaurants/new.png' });
      expect(await RestaurantModel.findById(id).lean()).toMatchObject({
        title: 'Renamed',
        imageKey: 'restaurants/new.png',
      });
    });
  });

  describe('delete', () => {
    it('returns the restaurant as it was deleted, and null once it is gone', async () => {
      const id = await storedRestaurant();
      await repository.update(id, { imageKey: 'restaurants/replaced.png' });

      expect(await repository.delete(id)).toMatchObject({ imageKey: 'restaurants/replaced.png' });
      expect(await repository.delete(id)).toBeNull();
    });
  });
});
