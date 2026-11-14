import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from '../../../../src/domain/errors';
import { createReviewFixture, type ReviewFixture } from '../../../support/reviewFixture';

let f: ReviewFixture;

beforeEach(async () => {
  f = await createReviewFixture();
});

describe('CreateReviewUseCase', () => {
  it('stores the review with the author taken from their account', async () => {
    const review = await f.review(f.rita.id, { rating: 5, comment: 'Superb.' });

    expect(review).toMatchObject({
      restaurantId: f.restaurant.id,
      authorId: f.rita.id,
      authorName: 'Rita',
      rating: 5,
      comment: 'Superb.',
    });
    expect(f.reviews.reviews).toHaveLength(1);
  });

  it("updates the restaurant's average and count", async () => {
    await f.review(f.rita.id, { rating: 5 });
    expect(await f.current()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });

    await f.review(f.ravi.id, { rating: 2 });
    expect(await f.current()).toMatchObject({ ratingAvg: 3.5, ratingCount: 2 });
  });

  it('refuses a second review of the same restaurant by the same reviewer', async () => {
    await f.review(f.rita.id, { rating: 5 });

    await expect(f.review(f.rita.id, { rating: 1 })).rejects.toThrow(ConflictError);
    expect(f.reviews.reviews).toHaveLength(1);
    expect(await f.current()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
  });

  it('refuses a duplicate that slips past the check, as the unique index does', async () => {
    await f.review(f.rita.id);
    f.reviews.raceNextCreate = true;

    await expect(f.review(f.rita.id)).rejects.toThrow(ConflictError);
    expect(f.reviews.reviews).toHaveLength(1);
  });

  it('lets the same reviewer review a different restaurant', async () => {
    const other = await f.createFor('owner-a', { title: 'Other place' });

    await f.review(f.rita.id);
    await f.review(f.rita.id, {}, other.id);

    expect(f.reviews.reviews).toHaveLength(2);
  });

  it('reports a restaurant that does not exist', async () => {
    await expect(f.review(f.rita.id, {}, 'missing')).rejects.toThrow(NotFoundError);
    expect(f.reviews.reviews).toHaveLength(0);
  });

  it('refuses an owner, even if the route check were bypassed', async () => {
    await expect(f.review(f.owner.id)).rejects.toThrow(ForbiddenError);
    expect(f.reviews.reviews).toHaveLength(0);
  });

  it('refuses an account that no longer exists', async () => {
    await expect(f.review('deleted-user')).rejects.toThrow(UnauthenticatedError);
  });
});
