import { beforeEach, describe, expect, it, vi } from 'vitest';
import { roundRating } from '../../../src/application/services/RestaurantRatings';
import { createReviewFixture, type ReviewFixture } from '../../support/reviewFixture';

describe('roundRating', () => {
  it.each([
    [4, 4],
    [3.66666, 3.7],
    [3.33333, 3.3],
    [4.25, 4.3],
    [1, 1],
  ])('rounds %d to %d, the precision averages are shown and filtered at', (average, expected) => {
    expect(roundRating(average)).toBe(expected);
  });
});

describe('RestaurantRatings', () => {
  let f: ReviewFixture;

  beforeEach(async () => {
    f = await createReviewFixture();
  });

  it('stores the rounded average and count of the reviews', async () => {
    await f.review(f.rita.id, { rating: 5 });
    await f.review(f.ravi.id, { rating: 4 });
    f.restaurants.rate(f.restaurant.id, 1, 99); // Wrong on purpose, as after a lost update.

    await f.ratings.recalculate(f.restaurant.id);

    expect(await f.current()).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });
  });

  it('gives the same result when run again', async () => {
    await f.review(f.rita.id, { rating: 3 });

    await f.ratings.recalculate(f.restaurant.id);
    await f.ratings.recalculate(f.restaurant.id);

    expect(await f.current()).toMatchObject({ ratingAvg: 3, ratingCount: 1 });
  });

  it('keeps a newer result when an older, slower recalculation finishes last', async () => {
    await f.review(f.rita.id, { rating: 5 });
    // Holds one recalculation back after it has read the reviews (Rita's 5 alone).
    const summary = f.reviews.ratingSummary.bind(f.reviews);
    let markRead!: () => void;
    let release!: () => void;
    const read = new Promise<void>((resolve) => (markRead = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    vi.spyOn(f.reviews, 'ratingSummary').mockImplementationOnce(async (id) => {
      const result = await summary(id);
      markRead();
      await released;
      return result;
    });
    const slow = f.ratings.recalculate(f.restaurant.id);
    await read;

    // Meanwhile Ravi reviews, and his recalculation reads both reviews and stores 3.
    await f.review(f.ravi.id, { rating: 1 });
    release();
    await slow;

    // The slow one's average of 5 was worked out before Ravi's review, so it is not stored.
    expect(await f.current()).toMatchObject({ ratingAvg: 3, ratingCount: 2 });
  });

  it('does nothing for a restaurant that no longer exists', async () => {
    await f.restaurants.delete(f.restaurant.id);

    await expect(f.ratings.recalculate(f.restaurant.id)).resolves.toBeUndefined();
  });

  it('clears the rating of a restaurant with no reviews', async () => {
    f.restaurants.rate(f.restaurant.id, 4, 3);

    await f.ratings.recalculate(f.restaurant.id);

    expect(await f.current()).toMatchObject({ ratingAvg: null, ratingCount: 0 });
  });
});
