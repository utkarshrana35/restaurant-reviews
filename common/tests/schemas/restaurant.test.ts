import { describe, expect, it } from 'vitest';
import {
  IMAGE_MAX_BYTES,
  RESTAURANT_DESCRIPTION_MAX_LENGTH,
  RESTAURANT_LOCATION_MAX_LENGTH,
  RESTAURANT_SLUG_MAX_LENGTH,
  RESTAURANT_TITLE_MAX_LENGTH,
} from '../../src/constants';
import {
  presignUploadSchema,
  restaurantCreateSchema,
  restaurantUpdateSchema,
} from '../../src/schemas/restaurant';

const valid = {
  title: 'Thyme Traveler',
  slug: 'thyme-traveler',
  location: '7 Wishing Well Way',
  description: 'A culinary adventure.',
  cuisine: 'italian',
  imageKey: 'pending/owner/abc.jpg',
};

describe('restaurantCreateSchema', () => {
  it('accepts a complete restaurant and drops what an owner may not set', () => {
    const parsed = restaurantCreateSchema.parse({
      ...valid,
      ownerId: 'someone-else',
      ratingAvg: 5,
      ratingCount: 999,
    });
    expect(parsed).toEqual(valid);
  });

  it.each([
    ['a blank title', { title: '  ' }, 'title'],
    ['a title over the limit', { title: 'x'.repeat(RESTAURANT_TITLE_MAX_LENGTH + 1) }, 'title'],
    [
      'a location over the limit',
      { location: 'x'.repeat(RESTAURANT_LOCATION_MAX_LENGTH + 1) },
      'location',
    ],
    [
      'a description over the limit',
      { description: 'x'.repeat(RESTAURANT_DESCRIPTION_MAX_LENGTH + 1) },
      'description',
    ],
    ['a cuisine that is not offered', { cuisine: 'klingon' }, 'cuisine'],
    ['no image', { imageKey: '' }, 'imageKey'],
    ['no slug', { slug: '' }, 'slug'],
    ['a slug with spaces', { slug: 'thyme traveler' }, 'slug'],
    ['a slug with a doubled hyphen', { slug: 'thyme--traveler' }, 'slug'],
    ['a slug starting with a hyphen', { slug: '-thyme' }, 'slug'],
    ['a slug ending with a hyphen', { slug: 'thyme-' }, 'slug'],
    ['a slug with a path in it', { slug: '../admin' }, 'slug'],
    ['a slug with accents', { slug: 'crêpe' }, 'slug'],
    ['a slug over the limit', { slug: 'x'.repeat(RESTAURANT_SLUG_MAX_LENGTH + 1) }, 'slug'],
  ])('rejects %s', (_label, change, path) => {
    const result = restaurantCreateSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });

  it('accepts each field at exactly its limit', () => {
    const atLimit = {
      ...valid,
      title: 'x'.repeat(RESTAURANT_TITLE_MAX_LENGTH),
      location: 'x'.repeat(RESTAURANT_LOCATION_MAX_LENGTH),
      description: 'x'.repeat(RESTAURANT_DESCRIPTION_MAX_LENGTH),
      slug: 'x'.repeat(RESTAURANT_SLUG_MAX_LENGTH),
    };
    expect(restaurantCreateSchema.safeParse(atLimit).success).toBe(true);
  });

  it('accepts a slug of digits, and trims one', () => {
    expect(restaurantCreateSchema.parse({ ...valid, slug: '1984' }).slug).toBe('1984');
    expect(restaurantCreateSchema.parse({ ...valid, slug: ' thyme ' }).slug).toBe('thyme');
  });

  it('lowercases a slug with capitals rather than refusing it', () => {
    expect(restaurantCreateSchema.parse({ ...valid, slug: 'Thyme-Traveler' }).slug).toBe(
      'thyme-traveler',
    );
  });
});

describe('restaurantUpdateSchema', () => {
  it('accepts any one field', () => {
    expect(restaurantUpdateSchema.parse({ title: 'New name' })).toEqual({ title: 'New name' });
  });

  it('rejects an update that changes nothing, including one with only unknown fields', () => {
    expect(restaurantUpdateSchema.safeParse({}).success).toBe(false);
    expect(restaurantUpdateSchema.safeParse({ ratingAvg: 5 }).success).toBe(false);
  });

  it('never changes the slug', () => {
    expect(restaurantUpdateSchema.parse({ title: 'New name', slug: 'new-name' })).toEqual({
      title: 'New name',
    });
    expect(restaurantUpdateSchema.safeParse({ slug: 'new-name' }).success).toBe(false);
  });
});

describe('presignUploadSchema', () => {
  it.each([['image/jpeg'], ['image/png'], ['image/webp']])('accepts %s', (contentType) => {
    expect(presignUploadSchema.safeParse({ contentType, size: 1024 }).success).toBe(true);
  });

  it.each([
    ['an SVG, which can carry scripts', { contentType: 'image/svg+xml', size: 1024 }],
    ['a PDF', { contentType: 'application/pdf', size: 1024 }],
    ['an empty file', { contentType: 'image/png', size: 0 }],
    ['a file over the limit', { contentType: 'image/png', size: IMAGE_MAX_BYTES + 1 }],
    ['a fractional size', { contentType: 'image/png', size: 10.5 }],
  ])('rejects %s', (_label, body) => {
    expect(presignUploadSchema.safeParse(body).success).toBe(false);
  });

  it('accepts exactly the size limit', () => {
    expect(
      presignUploadSchema.safeParse({ contentType: 'image/png', size: IMAGE_MAX_BYTES }).success,
    ).toBe(true);
  });
});
