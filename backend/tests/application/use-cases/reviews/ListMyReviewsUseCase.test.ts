import { beforeEach, describe, expect, it } from 'vitest';
import { createReviewFixture, type ReviewFixture } from '../../../support/reviewFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

let f: ReviewFixture;

beforeEach(async () => {
  f = await createReviewFixture();
});

describe('ListMyReviewsUseCase', () => {
  it("lists only the caller's reviews, newest first, each with its restaurant", async () => {
    const other = await f.createFor('owner-a', { title: 'Other place' });
    await f.review(f.rita.id, { comment: 'First' });
    time.advance({ seconds: 1 });
    await f.review(f.rita.id, { comment: 'Second' }, other.id);
    await f.review(f.ravi.id, { comment: 'Not mine' });

    const page = await f.listMyReviews.execute({ authorId: f.rita.id, page: 1, limit: 10 });

    expect(page.items.map(({ review, restaurant }) => [review.comment, restaurant.title])).toEqual([
      ['Second', 'Other place'],
      ['First', 'Thyme Traveler'],
    ]);
    expect(page).toMatchObject({ total: 2, totalPages: 1 });
  });

  it("shows the restaurant's current title after the owner renames it", async () => {
    await f.review(f.rita.id);
    await f.updateRestaurant.execute({
      id: f.restaurant.id,
      ownerId: 'owner-a',
      changes: { title: 'Thyme Traveller' },
    });

    const page = await f.listMyReviews.execute({ authorId: f.rita.id, page: 1, limit: 10 });

    expect(page.items[0]!.restaurant.title).toBe('Thyme Traveller');
  });

  it('pages through the reviews', async () => {
    const other = await f.createFor('owner-a', { title: 'Other place' });
    await f.review(f.rita.id, { comment: 'First' });
    time.advance({ seconds: 1 });
    await f.review(f.rita.id, { comment: 'Second' }, other.id);

    const second = await f.listMyReviews.execute({ authorId: f.rita.id, page: 2, limit: 1 });

    expect(second.items.map(({ review }) => review.comment)).toEqual(['First']);
    expect(second).toMatchObject({ total: 2, totalPages: 2 });
  });

  it('is empty for a reviewer who has not written any', async () => {
    const page = await f.listMyReviews.execute({ authorId: f.ravi.id, page: 1, limit: 10 });

    expect(page).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('leaves out a review whose restaurant has just been deleted', async () => {
    await f.review(f.rita.id);
    await f.restaurants.delete(f.restaurant.id); // the reviews have not been removed yet

    const page = await f.listMyReviews.execute({ authorId: f.rita.id, page: 1, limit: 10 });

    expect(page.items).toEqual([]);
  });
});
