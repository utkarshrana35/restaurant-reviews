import { RESTAURANT_SLUG_MAX_LENGTH } from '@restaurant-reviews/common';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { RestaurantModel } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';

/** A restaurant document with `slug`, not saved: validation alone needs no database. */
const withSlug = (slug: string) =>
  new RestaurantModel({
    owner: new Types.ObjectId(),
    slug,
    title: 'Thyme Traveler',
    location: '7 Wishing Well Way',
    description: 'A culinary adventure through time.',
    cuisine: 'italian',
    imageKey: 'restaurants/a.png',
  });

// The API already normalises and checks slugs; the model is the last guard, for any write that
// does not go through the API.
describe('RestaurantModel slug', () => {
  it('stores a slug in lowercase, trimmed', () => {
    const doc = withSlug('  Thyme-Traveler ');

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.slug).toBe('thyme-traveler');
  });

  it.each([
    ['a space', 'thyme traveler'],
    ['a path', '../admin'],
    ['accents', 'crêpe'],
    ['a doubled hyphen', 'thyme--traveler'],
    ['nothing at all', ''],
    ['too many characters', 'x'.repeat(RESTAURANT_SLUG_MAX_LENGTH + 1)],
  ])('refuses a slug with %s', (_label, slug) => {
    expect(withSlug(slug).validateSync()?.errors.slug).toBeDefined();
  });
});

describe('RestaurantModel rating', () => {
  it('starts unrated', () => {
    expect(withSlug('thyme').toObject()).toMatchObject({
      ratingAvg: null,
      ratingCount: 0,
      rated: false,
      ratingRevision: 0,
    });
  });
});
