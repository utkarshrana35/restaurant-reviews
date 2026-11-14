import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../../src/domain/errors';
import { createReviewFixture, type ReviewFixture } from '../../../support/reviewFixture';

let f: ReviewFixture;

beforeEach(async () => {
  f = await createReviewFixture();
});

describe('DeleteReviewUseCase', () => {
  it("removes the author's review and recalculates the average", async () => {
    const rita = await f.review(f.rita.id, { rating: 5 });
    await f.review(f.ravi.id, { rating: 2 });

    await f.deleteReview.execute({ id: rita.id, authorId: f.rita.id });

    expect(f.reviews.reviews.map((review) => review.authorId)).toEqual([f.ravi.id]);
    expect(await f.current()).toMatchObject({ ratingAvg: 2, ratingCount: 1 });
  });

  it('leaves the restaurant unrated when its last review is removed', async () => {
    const review = await f.review(f.rita.id);

    await f.deleteReview.execute({ id: review.id, authorId: f.rita.id });

    expect(await f.current()).toMatchObject({ ratingAvg: null, ratingCount: 0 });
  });

  it("refuses someone else's review and deletes nothing", async () => {
    const review = await f.review(f.rita.id);

    await expect(f.deleteReview.execute({ id: review.id, authorId: f.ravi.id })).rejects.toThrow(
      ForbiddenError,
    );
    expect(f.reviews.reviews).toHaveLength(1);
  });

  it('reports a review that does not exist, including one already deleted', async () => {
    const review = await f.review(f.rita.id);
    await f.deleteReview.execute({ id: review.id, authorId: f.rita.id });

    await expect(f.deleteReview.execute({ id: review.id, authorId: f.rita.id })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('lets the reviewer review the restaurant again afterwards', async () => {
    const review = await f.review(f.rita.id, { rating: 1 });
    await f.deleteReview.execute({ id: review.id, authorId: f.rita.id });

    await f.review(f.rita.id, { rating: 4 });

    expect(await f.current()).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
  });
});
