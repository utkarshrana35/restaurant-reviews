import { describe, expect, it } from 'vitest';
import { RESTAURANT_SLUG_MAX_LENGTH } from '../src/constants';
import { restaurantSlugSchema } from '../src/schemas/restaurant';
import { slugify } from '../src/slug';

describe('slugify', () => {
  it.each([
    ['Le Petit Bistro', 'le-petit-bistro'],
    ['Crêpe Expectations', 'crepe-expectations'],
    ['  Fish & Chips!!  ', 'fish-chips'],
    ["Joe's Diner No. 1", 'joe-s-diner-no-1'],
    ['<script>alert(1)</script>', 'script-alert-1-script'],
    ['../../etc/passwd', 'etc-passwd'],
    ['İstanbul Kebab', 'istanbul-kebab'],
    ['ŁÓDŹ GRILL', 'lodz-grill'],
    ['Straße 12', 'strasse-12'],
    ['Øl & Brød', 'ol-brod'],
    ['Æble Þing', 'aeble-thing'],
  ])('turns %j into %j, a valid slug', (title, slug) => {
    expect(slugify(title)).toBe(slug);
    expect(restaurantSlugSchema.safeParse(slug).success).toBe(true);
  });

  it('suggests nothing when nothing in the title fits in a URL', () => {
    expect(slugify('ร้านอาหาร')).toBe('');
    expect(slugify('!!!')).toBe('');
  });

  it('cuts a long title at a word boundary', () => {
    const slug = slugify(`${'word '.repeat(30)}end`);

    expect(slug.length).toBeLessThanOrEqual(RESTAURANT_SLUG_MAX_LENGTH);
    expect(slug).toMatch(/^(word-)*word$/);
  });

  it('cuts a long title with no word boundary at the maximum length', () => {
    expect(slugify('a'.repeat(100))).toBe('a'.repeat(RESTAURANT_SLUG_MAX_LENGTH));
  });
});
