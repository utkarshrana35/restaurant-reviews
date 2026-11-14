import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../../src/domain/errors';
import { createReviewFixture, type ReviewFixture } from '../../../support/reviewFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

let f: ReviewFixture;

beforeEach(async () => {
  f = await createReviewFixture();
});

describe('ListReviewsUseCase', () => {
  it('lists newest first with the page totals', async () => {
    await f.review(f.rita.id, { comment: 'First' });
    time.advance({ seconds: 1 });
    await f.review(f.ravi.id, { comment: 'Second' });

    const page = await f.listReviews.execute({ restaurantId: f.restaurant.id, page: 1, limit: 10 });

    expect(page.items.map((review) => review.comment)).toEqual(['Second', 'First']);
    expect(page).toMatchObject({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });

  it('pages through the reviews', async () => {
    await f.review(f.rita.id, { comment: 'First' });
    time.advance({ seconds: 1 });
    await f.review(f.ravi.id, { comment: 'Second' });

    const second = await f.listReviews.execute({
      restaurantId: f.restaurant.id,
      page: 2,
      limit: 1,
    });

    expect(second.items.map((review) => review.comment)).toEqual(['First']);
    expect(second).toMatchObject({ total: 2, totalPages: 2 });
  });

  it('gives an empty first page for a restaurant with no reviews', async () => {
    const page = await f.listReviews.execute({ restaurantId: f.restaurant.id, page: 1, limit: 10 });

    expect(page).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('only lists the requested restaurant', async () => {
    const other = await f.createFor('owner-a', { title: 'Other place' });
    await f.review(f.rita.id, {}, other.id);

    const page = await f.listReviews.execute({ restaurantId: f.restaurant.id, page: 1, limit: 10 });

    expect(page.total).toBe(0);
  });

  it('reports a restaurant that does not exist rather than "no reviews"', async () => {
    await expect(
      f.listReviews.execute({ restaurantId: 'missing', page: 1, limit: 10 }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GetMyReviewUseCase', () => {
  it("returns the caller's review, and null for someone who has not reviewed", async () => {
    const mine = await f.review(f.rita.id);

    expect(
      await f.getMyReview.execute({ restaurantId: f.restaurant.id, authorId: f.rita.id }),
    ).toEqual(mine);
    expect(
      await f.getMyReview.execute({ restaurantId: f.restaurant.id, authorId: f.ravi.id }),
    ).toBeNull();
  });

  it('reports a restaurant that does not exist', async () => {
    await expect(
      f.getMyReview.execute({ restaurantId: 'missing', authorId: f.rita.id }),
    ).rejects.toThrow(NotFoundError);
  });
});
