import { describe, expect, it } from 'vitest';
import { restaurantPath } from '@/lib/restaurantPath';

describe('restaurantPath', () => {
  it('puts the slug in the restaurant page’s URL', () => {
    expect(restaurantPath('le-petit-bistro')).toBe('/restaurants/le-petit-bistro');
  });

  it('keeps an unexpected character from changing the path', () => {
    expect(restaurantPath('a/b?c')).toBe('/restaurants/a%2Fb%3Fc');
  });
});
