import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sweepOrphanedReviews } from '../../../scripts/orphanedReviews/orphanedReviews';
import { RestaurantModel } from '../../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import { ReviewModel } from '../../../src/infrastructure/adapters/outbound/mongoose/models/ReviewModel';
import { clearDatabase, createTestApp, type TestApp } from '../../support/testApp';

let t: TestApp;

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

async function restaurant(slug: string) {
  const doc = await RestaurantModel.create({
    owner: new Types.ObjectId(),
    slug,
    title: slug,
    location: 'Somewhere',
    description: 'A place.',
    cuisine: 'italian',
    imageKey: `restaurants/${slug}.png`,
  });
  return doc._id;
}

/** `count` reviews of the restaurant, each by a different author. */
async function reviewsOf(restaurantId: Types.ObjectId, count: number) {
  await ReviewModel.create(
    Array.from({ length: count }, () => ({
      restaurant: restaurantId,
      author: new Types.ObjectId(),
      authorName: 'Rita',
      rating: 4,
      comment: 'Lovely.',
    })),
  );
}

describe('sweepOrphanedReviews', () => {
  it('deletes the reviews of deleted restaurants and leaves every other review alone', async () => {
    const kept = await restaurant('still-open');
    await reviewsOf(kept, 2);
    const gone = await restaurant('closed');
    await reviewsOf(gone, 3);
    const alsoGone = await restaurant('also-closed');
    await reviewsOf(alsoGone, 1);
    // Deleted the way a failed restaurant deletion leaves things: record gone, reviews not.
    await RestaurantModel.deleteMany({ _id: { $in: [gone, alsoGone] } });

    expect(await sweepOrphanedReviews()).toEqual({ restaurants: 2, reviews: 4 });
    expect(await ReviewModel.countDocuments({ restaurant: kept })).toBe(2);
    expect(await ReviewModel.countDocuments()).toBe(2);
  });

  it('only counts in a dry run', async () => {
    const gone = await restaurant('closed');
    await reviewsOf(gone, 2);
    await RestaurantModel.deleteOne({ _id: gone });

    expect(await sweepOrphanedReviews({ dryRun: true })).toEqual({ restaurants: 1, reviews: 2 });
    expect(await ReviewModel.countDocuments()).toBe(2);
  });

  it('finds nothing to do when every review has its restaurant, and can run again', async () => {
    await reviewsOf(await restaurant('still-open'), 2);

    expect(await sweepOrphanedReviews()).toEqual({ restaurants: 0, reviews: 0 });
    expect(await sweepOrphanedReviews()).toEqual({ restaurants: 0, reviews: 0 });
    expect(await ReviewModel.countDocuments()).toBe(2);
  });
});
