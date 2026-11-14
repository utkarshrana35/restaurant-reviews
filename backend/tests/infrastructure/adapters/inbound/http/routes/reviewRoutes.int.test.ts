import { REVIEW_COMMENT_MAX_LENGTH, slugify } from '@restaurant-reviews/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ReviewModel } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/ReviewModel';
import { SAMPLE_BYTES } from '../../../../../support/InMemoryFileStorage';
import { clearDatabase, createTestApp, signUp, type TestApp } from '../../../../../support/testApp';

type Agent = Awaited<ReturnType<typeof signUp>>['agent'];

let t: TestApp;
let owner: Agent;
let rita: Agent;
let ritaId: string;
let ravi: Agent;
let restaurantId: string;

beforeAll(async () => {
  t = createTestApp();
  await t.container.database.connect();
  // The unique index must exist before the tests that rely on it run.
  await ReviewModel.init();
});

beforeEach(async () => {
  await clearDatabase();
  t = createTestApp();
  ({ agent: owner } = await signUp(t, 'owner', 'owner@example.com'));
  ({ agent: rita, userId: ritaId } = await signUp(t, 'reviewer', 'rita@example.com'));
  ({ agent: ravi } = await signUp(t, 'reviewer', 'ravi@example.com'));
  restaurantId = await createRestaurant('Thyme Traveler');
});

afterAll(async () => {
  await clearDatabase();
  await t.container.database.disconnect();
});

async function createRestaurant(title: string): Promise<string> {
  const presign = await owner
    .post('/api/uploads/presign')
    .send({ contentType: 'image/jpeg', size: SAMPLE_BYTES.jpeg.length })
    .expect(201);
  t.storage.put(presign.body.key, SAMPLE_BYTES.jpeg);
  const res = await owner
    .post('/api/restaurants')
    .send({
      title,
      slug: slugify(title),
      location: '7 Wishing Well Way',
      description: 'A culinary adventure.',
      cuisine: 'italian',
      imageKey: presign.body.key,
    })
    .expect(201);
  return res.body.id;
}

const reviewsOf = (id = restaurantId) => `/api/restaurants/${id}/reviews`;

function post(agent: Agent, body: Record<string, unknown> = {}, id = restaurantId) {
  return agent.post(reviewsOf(id)).send({ rating: 4, comment: 'Lovely evening.', ...body });
}

async function restaurant(id = restaurantId) {
  return (await request(t.app).get(`/api/restaurants/${id}`).expect(200)).body;
}

describe('POST /api/restaurants/:id/reviews', () => {
  it('creates the review as the caller and updates the restaurant rating', async () => {
    const res = await post(rita, { rating: 5, comment: '  Superb.  ' }).expect(201);

    expect(res.body).toMatchObject({
      restaurantId,
      authorId: ritaId,
      authorName: 'rita',
      rating: 5,
      comment: 'Superb.',
    });
    expect(await restaurant()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });

    await post(ravi, { rating: 2 }).expect(201);
    expect(await restaurant()).toMatchObject({ ratingAvg: 3.5, ratingCount: 2 });
  });

  it('stores averages rounded to one decimal place', async () => {
    const { agent: rosa } = await signUp(t, 'reviewer', 'rosa@example.com');
    await post(rita, { rating: 5 }).expect(201);
    await post(ravi, { rating: 4 }).expect(201);
    await post(rosa, { rating: 4 }).expect(201);

    expect((await restaurant()).ratingAvg).toBe(4.3);
  });

  it('ignores an author or restaurant named in the body', async () => {
    const otherId = await createRestaurant('Other place');

    const res = await post(rita, { authorId: 'someone-else', restaurantId: otherId }).expect(201);

    expect(res.body).toMatchObject({ authorId: ritaId, restaurantId });
  });

  it('refuses a second review by the same reviewer with 409', async () => {
    await post(rita, { rating: 5 }).expect(201);

    const res = await post(rita, { rating: 1 }).expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
    expect(await restaurant()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
  });

  it('lets only one of two simultaneous reviews by the same reviewer through', async () => {
    const results = await Promise.all([post(rita, { rating: 5 }), post(rita, { rating: 1 })]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await ReviewModel.countDocuments()).toBe(1);
  });

  it('refuses guests with 401 and owners with 403', async () => {
    await post(request.agent(t.app)).expect(401);
    const res = await post(owner).expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await ReviewModel.countDocuments()).toBe(0);
  });

  it.each([
    ['an unknown restaurant', '507f1f77bcf86cd799439011'],
    ['a malformed id', 'not-an-id'],
  ])('answers 404 for %s', async (_label, id) => {
    const res = await post(rita, {}, id).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['no rating', { rating: undefined }, 'rating'],
    ['a rating of zero', { rating: 0 }, 'rating'],
    ['a rating above five', { rating: 6 }, 'rating'],
    ['a fractional rating', { rating: 3.5 }, 'rating'],
    ['a rating sent as text', { rating: '4' }, 'rating'],
    ['no comment', { comment: undefined }, 'comment'],
    ['a blank comment', { comment: '   ' }, 'comment'],
    ['a comment over the limit', { comment: 'x'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1) }, 'comment'],
  ])('rejects %s', async (_label, body, path) => {
    const res = await post(rita, body).expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ path }));
  });

  it('feeds the rating into the listing filter and order', async () => {
    const otherId = await createRestaurant('Other place');
    await post(rita, { rating: 2 }).expect(201);
    await post(rita, { rating: 5 }, otherId).expect(201);

    const best = await request(t.app).get('/api/restaurants').expect(200);
    const atLeastFour = await request(t.app).get('/api/restaurants?minRating=4').expect(200);

    expect(best.body.items.map((r: { id: string }) => r.id)).toEqual([otherId, restaurantId]);
    expect(atLeastFour.body.items.map((r: { id: string }) => r.id)).toEqual([otherId]);
  });
});

describe('GET /api/restaurants/:id/reviews', () => {
  it('is public and lists newest first with page totals', async () => {
    await post(rita, { comment: 'First' }).expect(201);
    await post(ravi, { comment: 'Second' }).expect(201);

    const res = await request(t.app).get(`${reviewsOf()}?limit=1`).expect(200);

    expect(res.body).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.items.map((r: { comment: string }) => r.comment)).toEqual(['Second']);

    const second = await request(t.app).get(`${reviewsOf()}?limit=1&page=2`).expect(200);
    expect(second.body.items.map((r: { comment: string }) => r.comment)).toEqual(['First']);
  });

  it('answers 404 for an unknown restaurant', async () => {
    await request(t.app).get(reviewsOf('507f1f77bcf86cd799439011')).expect(404);
  });

  it.each([['page=0'], ['limit=500'], ['page=abc']])('rejects %s', async (query) => {
    const res = await request(t.app).get(`${reviewsOf()}?${query}`).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /api/restaurants/:id/reviews/mine', () => {
  it("returns the caller's review, or null before they write one", async () => {
    expect((await rita.get(`${reviewsOf()}/mine`).expect(200)).body).toEqual({ review: null });

    await post(rita, { comment: 'Mine' }).expect(201);

    const res = await rita.get(`${reviewsOf()}/mine`).expect(200);
    expect(res.body.review).toMatchObject({ authorId: ritaId, comment: 'Mine' });
    expect((await ravi.get(`${reviewsOf()}/mine`).expect(200)).body).toEqual({ review: null });
  });

  it('needs a reviewer', async () => {
    await request(t.app).get(`${reviewsOf()}/mine`).expect(401);
    await owner.get(`${reviewsOf()}/mine`).expect(403);
  });
});

describe('GET /api/reviews/mine', () => {
  it("lists the caller's reviews across restaurants, newest first, with titles", async () => {
    const otherId = await createRestaurant('Other place');
    await post(rita, { comment: 'First' }).expect(201);
    await post(rita, { comment: 'Second' }, otherId).expect(201);
    await post(ravi, { comment: 'Not mine' }).expect(201);

    const res = await rita.get('/api/reviews/mine').expect(200);

    expect(res.body).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    expect(
      res.body.items.map((r: { comment: string; restaurantTitle: string }) => [
        r.comment,
        r.restaurantTitle,
      ]),
    ).toEqual([
      ['Second', 'Other place'],
      ['First', 'Thyme Traveler'],
    ]);
    // The same image address and page the restaurant itself has.
    expect(res.body.items[1].restaurantImageUrl).toBe((await restaurant()).imageUrl);
    expect(res.body.items[1].restaurantSlug).toBe('thyme-traveler');
  });

  it('pages, and validates the page', async () => {
    const otherId = await createRestaurant('Other place');
    await post(rita).expect(201);
    await post(rita, {}, otherId).expect(201);

    const res = await rita.get('/api/reviews/mine?limit=1&page=2').expect(200);
    expect(res.body).toMatchObject({ page: 2, total: 2, totalPages: 2 });
    expect(res.body.items).toHaveLength(1);

    await rita.get('/api/reviews/mine?page=0').expect(400);
  });

  it('needs a reviewer', async () => {
    await request(t.app).get('/api/reviews/mine').expect(401);
    await owner.get('/api/reviews/mine').expect(403);
  });
});

describe('DELETE /api/reviews/:id', () => {
  it("removes the author's review and recalculates the rating", async () => {
    const mine = await post(rita, { rating: 5 }).expect(201);
    await post(ravi, { rating: 2 }).expect(201);

    await rita.delete(`/api/reviews/${mine.body.id}`).expect(204);

    expect(await restaurant()).toMatchObject({ ratingAvg: 2, ratingCount: 1 });
    await post(rita, { rating: 3 }).expect(201); // and may review again
  });

  it("refuses another reviewer's or an owner's attempt, and guests", async () => {
    const mine = await post(rita).expect(201);

    await ravi.delete(`/api/reviews/${mine.body.id}`).expect(403);
    await owner.delete(`/api/reviews/${mine.body.id}`).expect(403);
    await request(t.app).delete(`/api/reviews/${mine.body.id}`).expect(401);
    expect(await ReviewModel.countDocuments()).toBe(1);
  });

  it.each([['507f1f77bcf86cd799439011'], ['not-an-id']])('answers 404 for %s', async (id) => {
    await rita.delete(`/api/reviews/${id}`).expect(404);
  });
});

describe('deleting a restaurant', () => {
  it('removes its reviews', async () => {
    const otherId = await createRestaurant('Other place');
    await post(rita).expect(201);
    await post(rita, {}, otherId).expect(201);

    await owner.delete(`/api/restaurants/${restaurantId}`).expect(204);

    expect(await ReviewModel.countDocuments()).toBe(1);
    await request(t.app).get(reviewsOf()).expect(404);
  });
});
