import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/safeRedirect';

describe('safeRedirect', () => {
  it('keeps a same-site path, including its query string', () => {
    expect(safeRedirect('/account')).toBe('/account');
    expect(safeRedirect('/restaurants/42?tab=reviews')).toBe('/restaurants/42?tab=reviews');
  });

  it.each([
    ['an absolute URL', 'https://evil.example/phish'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash variant browsers treat as //', '/\\evil.example'],
    ['a tab between the slashes, which browsers strip', '/\t/evil.example'],
    ['a newline between the slashes, which browsers strip', '/\n/evil.example'],
    ['a carriage return between the slashes', '/\r/evil.example'],
    ['a backslash after a tab', '/\t\\evil.example'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'account'],
    ['an empty string', ''],
  ])('falls back to home for %s', (_label, next) => {
    expect(safeRedirect(next)).toBe('/');
  });

  it('keeps the fragment of a same-site path', () => {
    expect(safeRedirect('/account#reviews')).toBe('/account#reviews');
  });

  it('falls back to home when the parameter is missing or repeated', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect(['/a', '/b'])).toBe('/');
  });
});
