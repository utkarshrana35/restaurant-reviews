import { RESTAURANT_SLUG_MAX_LENGTH } from '@restaurant-reviews/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RestaurantModel } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import { MongooseRestaurantRepository } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/MongooseRestaurantRepository';
import { SAMPLE_BYTES } from '../../../../../support/InMemoryFileStorage';
import { clearDatabase, createTestApp, signUp, type TestApp } from '../../../../../support/testApp';

type Agent = Awaited<ReturnType<typeof signUp>>['agent'];

let t: TestApp;
let ownerA: Agent;
let ownerAId: string;
let ownerB: Agent;
let reviewer: Agent;

beforeAll(async () => {
  t = createTestApp();
  await t.container.database.connect();
});

beforeEach(async () => {
  await clearDatabase();
  t = createTestApp();
  ({ agent: ownerA, userId: ownerAId } = await signUp(t, 'owner', 'owner-a@example.com'));
  ({ agent: ownerB } = await signUp(t, 'owner', 'owner-b@example.com'));
  ({ agent: reviewer } = await signUp(t, 'reviewer', 'reviewer@example.com'));
});

afterAll(async () => {
  await clearDatabase();
  await t.container.database.disconnect();
});

/** Does what the browser does: asks for an upload permission, then "uploads" to that key. */
async function uploadImage(agent: Agent, bytes: readonly number[] = SAMPLE_BYTES.jpeg) {
  const res = await agent
    .post('/api/uploads/presign')
    .send({ contentType: 'image/jpeg', size: bytes.length })
    .expect(201);
  t.storage.put(res.body.key, bytes);
  return res.body.key as string;
}

// Each set of details gets its own slug, so tests can create several restaurants.
let slugCount = 0;

function details(overrides: Record<string, unknown> = {}) {
  slugCount += 1;
  return {
    title: 'Thyme Traveler',
    slug: `thyme-traveler-${slugCount}`,
    location: '7 Wishing Well Way, Hidden Valley',
    description: 'A culinary adventure through time.',
    cuisine: 'italian',
    ...overrides,
  };
}

async function createRestaurant(agent: Agent, overrides: Record<string, unknown> = {}) {
  const imageKey = await uploadImage(agent);
  const res = await agent
    .post('/api/restaurants')
    .send(details({ imageKey, ...overrides }))
    .expect(201);
  return res.body as { id: string; slug: string; imageUrl: string; title: string };
}

describe('POST /api/uploads/presign', () => {
  it('gives an owner a permission scoped to their own upload area', async () => {
    const res = await ownerA
      .post('/api/uploads/presign')
      .send({ contentType: 'image/png', size: 1024 });

    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(new RegExp(`^pending/${ownerAId}/[0-9a-f-]{36}\\.png$`));
    expect(res.body.url).toEqual(expect.any(String));
    expect(res.body.fields).toMatchObject({ key: res.body.key, 'Content-Type': 'image/png' });
  });

  it.each([
    ['a type that is not an accepted image', { contentType: 'application/pdf', size: 1024 }],
    ['an SVG, which can carry scripts', { contentType: 'image/svg+xml', size: 1024 }],
    ['a file over 5 MB', { contentType: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }],
    ['an empty file', { contentType: 'image/jpeg', size: 0 }],
    ['a missing size', { contentType: 'image/jpeg' }],
  ])('refuses %s', async (_label, body) => {
    const res = await ownerA.post('/api/uploads/presign').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(t.storage.issuedUploads).toHaveLength(0);
  });

  it('is refused to reviewers and guests', async () => {
    const body = { contentType: 'image/jpeg', size: 1024 };

    expect((await reviewer.post('/api/uploads/presign').send(body)).status).toBe(403);
    expect((await request(t.app).post('/api/uploads/presign').send(body)).status).toBe(401);
    expect(t.storage.issuedUploads).toHaveLength(0);
  });
});

describe('POST /api/restaurants', () => {
  it('creates a restaurant owned by the caller', async () => {
    const imageKey = await uploadImage(ownerA);

    const res = await ownerA.post('/api/restaurants').send(details({ imageKey }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      ownerId: ownerAId,
      title: 'Thyme Traveler',
      cuisine: 'italian',
      ratingAvg: null,
      ratingCount: 0,
    });
    expect(res.body.imageUrl).toMatch(/^https:\/\/storage\.test\/bucket\/restaurants\/.+\.jpg$/);
    // The storage key is internal and is not exposed.
    expect(res.body).not.toHaveProperty('imageKey');
  });

  it('ignores an owner, rating or id supplied in the body', async () => {
    const imageKey = await uploadImage(ownerA);

    const res = await ownerA.post('/api/restaurants').send(
      details({
        imageKey,
        owner: '507f1f77bcf86cd799439011',
        ownerId: '507f1f77bcf86cd799439011',
        ratingAvg: 5,
        ratingCount: 999,
        _id: '507f1f77bcf86cd799439011',
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ownerId: ownerAId, ratingAvg: null, ratingCount: 0 });
    expect(res.body.id).not.toBe('507f1f77bcf86cd799439011');
  });

  it('is refused to a reviewer', async () => {
    const res = await reviewer.post('/api/restaurants').send(details({ imageKey: 'x' }));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await RestaurantModel.countDocuments()).toBe(0);
  });

  it('is refused to a guest', async () => {
    const res = await request(t.app)
      .post('/api/restaurants')
      .send(details({ imageKey: 'x' }));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('reports every invalid field', async () => {
    const res = await ownerA
      .post('/api/restaurants')
      .send({ title: ' ', location: '', description: 'x'.repeat(2001), cuisine: 'klingon' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(
      expect.arrayContaining(['title', 'slug', 'location', 'description', 'cuisine', 'imageKey']),
    );
    expect(await RestaurantModel.countDocuments()).toBe(0);
  });

  it('trims surrounding whitespace from text fields', async () => {
    const created = await createRestaurant(ownerA, { title: '  Padded Name  ' });

    expect(created.title).toBe('Padded Name');
  });

  it('rejects an upload that is not really an image, pointing at the image field', async () => {
    const imageKey = await uploadImage(ownerA, SAMPLE_BYTES.notAnImage);

    const res = await ownerA.post('/api/restaurants').send(details({ imageKey }));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'imageKey', message: 'The file is not a JPEG, PNG or WebP image' },
    ]);
    expect(await RestaurantModel.countDocuments()).toBe(0);
  });

  it('rejects another owner’s upload', async () => {
    const imageKey = await uploadImage(ownerB);

    const res = await ownerA.post('/api/restaurants').send(details({ imageKey }));

    expect(res.status).toBe(400);
    expect(await RestaurantModel.countDocuments()).toBe(0);
  });

  it('stores markup in text fields as plain text, unchanged', async () => {
    const title = '<img src=x onerror=alert(1)>';

    const created = await createRestaurant(ownerA, { title });

    // Returned as data; the frontend renders it as text, so it never becomes markup.
    expect(created.title).toBe(title);
  });
});

describe('GET /api/restaurants/mine', () => {
  it('lists only the caller’s restaurants, newest first', async () => {
    await createRestaurant(ownerA, { title: 'First' });
    await createRestaurant(ownerB, { title: 'Someone else’s' });
    await createRestaurant(ownerA, { title: 'Second' });

    const res = await ownerA.get('/api/restaurants/mine');

    expect(res.status).toBe(200);
    expect(res.body.map((restaurant: { title: string }) => restaurant.title)).toEqual([
      'Second',
      'First',
    ]);
  });

  it('is an empty list for an owner with no restaurants', async () => {
    await createRestaurant(ownerB);

    expect((await ownerA.get('/api/restaurants/mine')).body).toEqual([]);
  });

  it('is refused to reviewers and guests', async () => {
    expect((await reviewer.get('/api/restaurants/mine')).status).toBe(403);
    expect((await request(t.app).get('/api/restaurants/mine')).status).toBe(401);
  });
});

describe('GET /api/restaurants/:id', () => {
  it('is readable by anyone, signed in or not', async () => {
    const created = await createRestaurant(ownerA);

    const res = await request(t.app).get(`/api/restaurants/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, title: 'Thyme Traveler' });
  });

  it.each([
    ['an id that matches nothing', '507f1f77bcf86cd799439011'],
    ['a malformed id', 'not-an-id'],
    ['an id built from an operator', '{"$ne":null}'],
  ])('answers 404 for %s', async (_label, id) => {
    const res = await request(t.app).get(`/api/restaurants/${encodeURIComponent(id)}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Restaurant not found' });
  });
});

describe('restaurant slugs', () => {
  it('finds a restaurant by the slug its owner chose, for anyone', async () => {
    const created = await createRestaurant(ownerA, { slug: 'crepe-expectations' });

    const res = await request(t.app).get('/api/restaurants/by-slug/crepe-expectations');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, slug: 'crepe-expectations' });
  });

  it('refuses a slug another restaurant has, on the slug field', async () => {
    await createRestaurant(ownerA, { slug: 'thyme-traveler' });
    const imageKey = await uploadImage(ownerB);

    const res = await ownerB
      .post('/api/restaurants')
      .send(details({ imageKey, slug: 'thyme-traveler' }));

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([
      { path: 'slug', message: expect.stringContaining('already uses this address') },
    ]);
  });

  it('lets only one of two restaurants created at the same moment have a slug', async () => {
    // The unique index has to exist for the second save to be refused.
    await RestaurantModel.init();
    const keys = await Promise.all([uploadImage(ownerA), uploadImage(ownerB)]);

    const results = await Promise.all([
      ownerA.post('/api/restaurants').send(details({ imageKey: keys[0], slug: 'same' })),
      ownerB.post('/api/restaurants').send(details({ imageKey: keys[1], slug: 'same' })),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await RestaurantModel.countDocuments()).toBe(1);
  });

  it('saves a slug typed with capitals in lowercase', async () => {
    const created = await createRestaurant(ownerA, { slug: 'Thyme-Traveler' });

    expect(created.slug).toBe('thyme-traveler');
    expect(await RestaurantModel.exists({ slug: 'thyme-traveler' })).not.toBeNull();
  });

  it('treats slugs that differ only in case as the same address', async () => {
    await createRestaurant(ownerA, { slug: 'thyme-traveler' });
    const imageKey = await uploadImage(ownerB);

    const res = await ownerB
      .post('/api/restaurants')
      .send(details({ imageKey, slug: 'THYME-TRAVELER' }));

    expect(res.status).toBe(409);
  });

  it.each([
    ['a space', 'thyme traveler'],
    ['a path', '../admin'],
  ])('rejects a slug with %s', async (_label, slug) => {
    const imageKey = await uploadImage(ownerA);

    const res = await ownerA.post('/api/restaurants').send(details({ imageKey, slug }));

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toEqual(['slug']);
  });

  it('keeps the slug when the restaurant is renamed, and ignores a new one', async () => {
    const created = await createRestaurant(ownerA, { slug: 'thyme-traveler' });
    await ownerA
      .patch(`/api/restaurants/${created.id}`)
      .send({ title: 'Renamed', slug: 'renamed' })
      .expect(200);

    const res = await request(t.app).get('/api/restaurants/by-slug/thyme-traveler');

    expect(res.body).toMatchObject({ slug: 'thyme-traveler', title: 'Renamed' });
  });

  // Its URL looks like the reviews of a restaurant called "by-slug".
  it('finds a restaurant whose slug is "reviews"', async () => {
    const created = await createRestaurant(ownerA, { slug: 'reviews' });

    const res = await request(t.app).get('/api/restaurants/by-slug/reviews');

    expect(res.body).toMatchObject({ id: created.id, slug: 'reviews' });
  });

  it('finds a restaurant whatever the case of the slug in the URL', async () => {
    const created = await createRestaurant(ownerA, { slug: 'crepe-expectations' });

    const res = await request(t.app).get('/api/restaurants/by-slug/Crepe-Expectations');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, slug: 'crepe-expectations' });
  });

  it.each([
    ['a slug that matches nothing', 'no-such-place'],
    ['a pattern', 'thyme.*'],
    ['an operator', '{"$ne":null}'],
    ['a slug over the limit', 'x'.repeat(RESTAURANT_SLUG_MAX_LENGTH + 1)],
    ['text with a percent sign', '%E0'],
  ])('answers 404 for %s', async (_label, slug) => {
    await createRestaurant(ownerA);

    const res = await request(t.app).get(`/api/restaurants/by-slug/${encodeURIComponent(slug)}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Restaurant not found' });
  });
});

describe('PATCH /api/restaurants/:id', () => {
  it('lets the owner change some fields and keeps the rest', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA
      .patch(`/api/restaurants/${created.id}`)
      .send({ title: 'Renamed', cuisine: 'french' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Renamed',
      cuisine: 'french',
      location: '7 Wishing Well Way, Hidden Valley',
      imageUrl: created.imageUrl,
    });
  });

  it('refuses another owner and changes nothing', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerB.patch(`/api/restaurants/${created.id}`).send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const stored = await RestaurantModel.findById(created.id).lean();
    expect(stored?.title).toBe('Thyme Traveler');
  });

  it('is refused to reviewers and guests', async () => {
    const created = await createRestaurant(ownerA);
    const url = `/api/restaurants/${created.id}`;

    expect((await reviewer.patch(url).send({ title: 'x' })).status).toBe(403);
    expect((await request(t.app).patch(url).send({ title: 'x' })).status).toBe(401);
  });

  it('cannot move a restaurant to another owner or set its rating', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA
      .patch(`/api/restaurants/${created.id}`)
      .send({ title: 'Renamed', owner: '507f1f77bcf86cd799439011', ratingAvg: 5, ratingCount: 99 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ownerId: ownerAId, ratingAvg: null, ratingCount: 0 });
  });

  it('rejects a body with nothing to change', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA.patch(`/api/restaurants/${created.id}`).send({ unknown: 'field' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid values and changes nothing', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA
      .patch(`/api/restaurants/${created.id}`)
      .send({ title: '', cuisine: 'klingon' });

    expect(res.status).toBe(400);
    const stored = await RestaurantModel.findById(created.id).lean();
    expect(stored).toMatchObject({ title: 'Thyme Traveler', cuisine: 'italian' });
  });

  it('replaces the image and deletes the old file', async () => {
    const created = await createRestaurant(ownerA);
    const imageKey = await uploadImage(ownerA, SAMPLE_BYTES.png);

    const res = await ownerA.patch(`/api/restaurants/${created.id}`).send({ imageKey });

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/\.png$/);
    expect(res.body.imageUrl).not.toBe(created.imageUrl);
    expect(t.storage.keys()).toHaveLength(1);
  });

  it('answers 404 for a restaurant that does not exist', async () => {
    const res = await ownerA
      .patch('/api/restaurants/507f1f77bcf86cd799439011')
      .send({ title: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/restaurants/:id', () => {
  it('lets the owner delete the restaurant, and removes its image', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA.delete(`/api/restaurants/${created.id}`);

    expect(res.status).toBe(204);
    expect(await RestaurantModel.countDocuments()).toBe(0);
    expect(t.storage.keys()).toEqual([]);
    expect((await request(t.app).get(`/api/restaurants/${created.id}`)).status).toBe(404);
  });

  it('refuses another owner and deletes nothing', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerB.delete(`/api/restaurants/${created.id}`);

    expect(res.status).toBe(403);
    expect(await RestaurantModel.countDocuments()).toBe(1);
    expect(t.storage.keys()).toHaveLength(1);
  });

  it('is refused to reviewers and guests', async () => {
    const created = await createRestaurant(ownerA);
    const url = `/api/restaurants/${created.id}`;

    expect((await reviewer.delete(url)).status).toBe(403);
    expect((await request(t.app).delete(url)).status).toBe(401);
    expect(await RestaurantModel.countDocuments()).toBe(1);
  });

  it('answers 404 the second time', async () => {
    const created = await createRestaurant(ownerA);
    await ownerA.delete(`/api/restaurants/${created.id}`).expect(204);

    expect((await ownerA.delete(`/api/restaurants/${created.id}`)).status).toBe(404);
  });

  it('is blocked when sent from another site, even with the owner’s cookies', async () => {
    const created = await createRestaurant(ownerA);

    const res = await ownerA
      .delete(`/api/restaurants/${created.id}`)
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(await RestaurantModel.countDocuments()).toBe(1);
  });
});

describe('GET /api/restaurants', () => {
  /**
   * Creates a restaurant and gives it a rating, standing in for reviews. Stored the way review
   * writes store it, so the fields the listing sorts on agree with each other.
   */
  async function rated(title: string, ratingAvg: number | null, cuisine = 'italian') {
    const created = await createRestaurant(ownerA, { title, cuisine });
    const repository = new MongooseRestaurantRepository();
    const revision = await repository.startRatingUpdate(created.id);
    await repository.setRating(created.id, ratingAvg, ratingAvg === null ? 0 : 3, revision!);
    return created;
  }

  const titlesOf = (res: request.Response) =>
    res.body.items.map((item: { title: string }) => item.title);

  it('is public and lists best rated first, unrated last', async () => {
    await rated('Middling', 3);
    await rated('Unrated', null);
    await rated('Best', 5);

    const res = await request(t.app).get('/api/restaurants');

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Best', 'Middling', 'Unrated']);
    expect(res.body).toMatchObject({ page: 1, limit: 12, total: 3, totalPages: 1 });
    expect(res.body.items[0]).toMatchObject({ ratingAvg: 5, ratingCount: 3 });
    expect(res.body.items[0]).not.toHaveProperty('imageKey');
  });

  it('lists worst rated first on request, still with unrated last', async () => {
    await rated('Middling', 3);
    await rated('Unrated', null);
    await rated('Best', 5);

    const res = await request(t.app).get('/api/restaurants?sort=rating_asc');

    expect(titlesOf(res)).toEqual(['Middling', 'Best', 'Unrated']);
  });

  it('combines cuisine and rating filters', async () => {
    await rated('Greek four', 4, 'greek');
    await rated('Greek two', 2, 'greek');
    await rated('Italian four', 4, 'italian');

    const res = await request(t.app).get('/api/restaurants?cuisine=greek&minRating=3&maxRating=5');

    expect(titlesOf(res)).toEqual(['Greek four']);
  });

  it('pages through results', async () => {
    for (const [index, rating] of [5, 4, 3].entries()) await rated(`R${index}`, rating);

    const res = await request(t.app).get('/api/restaurants?limit=2&page=2');

    expect(titlesOf(res)).toEqual(['R2']);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it.each([
    ['an unknown cuisine', 'cuisine=klingon', 'cuisine'],
    ['a rating above five', 'minRating=6', 'minRating'],
    ['a fractional rating', 'minRating=3.5', 'minRating'],
    ['a minimum above the maximum', 'minRating=4&maxRating=2', 'maxRating'],
    ['an unknown sort order', 'sort=random', 'sort'],
    ['page zero', 'page=0', 'page'],
    ['a page size over the limit', 'limit=500', 'limit'],
    ['a non-numeric page', 'page=abc', 'page'],
    ['a page past the last one allowed', 'page=10001', 'page'],
  ])('rejects %s', async (_label, queryString, path) => {
    const res = await request(t.app).get(`/api/restaurants?${queryString}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ path }));
  });

  it('ignores parameters it does not know, including operator-shaped ones', async () => {
    await rated('Only one', 4);

    const res = await request(t.app).get('/api/restaurants?owner[$ne]=x&debug=1');

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Only one']);
  });
});
