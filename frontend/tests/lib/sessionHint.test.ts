import { describe, expect, it } from 'vitest';
import { createSessionHint, roleFromHint, type CookieJar } from '@/lib/sessionHint';

/** A minimal stand-in for document.cookie: stores by name and honours Max-Age=0 as deletion. */
function fakeJar(initial: Record<string, string> = {}) {
  const cookies = new Map(Object.entries(initial));
  const written: string[] = [];
  const jar: CookieJar = {
    read: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    write: (cookie) => {
      written.push(cookie);
      const [pair = ''] = cookie.split('; ');
      const [name = '', value = ''] = pair.split('=');
      if (/Max-Age=0/.test(cookie)) cookies.delete(name);
      else cookies.set(name, value);
    },
  };
  return { jar, written };
}

describe('sessionHint', () => {
  it('is absent until set, and absent again once cleared', () => {
    const hint = createSessionHint(fakeJar().jar);

    expect(hint.exists()).toBe(false);
    hint.set('reviewer');
    expect(hint.exists()).toBe(true);
    hint.clear();
    expect(hint.exists()).toBe(false);
  });

  it('remembers which kind of account signed in', () => {
    const hint = createSessionHint(fakeJar().jar);

    hint.set('owner');

    expect(hint.role()).toBe('owner');
  });

  it('finds the hint among other cookies', () => {
    const { jar } = fakeJar({ theme: 'dark', signed_in: 'reviewer', lang: 'en' });

    expect(createSessionHint(jar).role()).toBe('reviewer');
  });

  it('is not fooled by a cookie whose name merely contains the hint name', () => {
    const { jar } = fakeJar({ not_signed_in: 'owner', signed_in_old: 'owner' });

    expect(createSessionHint(jar).exists()).toBe(false);
  });

  it('treats a value that is not a role as no hint at all', () => {
    const { jar } = fakeJar({ signed_in: 'admin' });

    expect(createSessionHint(jar).exists()).toBe(false);
  });

  it('writes a site-wide cookie that pages receive, with no secret in it', () => {
    const { jar, written } = fakeJar();

    createSessionHint(jar).set('owner');

    expect(written).toEqual(['signed_in=owner; Max-Age=2592000; Path=/; SameSite=Lax']);
  });

  it('marks the cookie Secure when the site is served over HTTPS', () => {
    const { jar, written } = fakeJar();

    createSessionHint(jar, true).set('owner');

    expect(written[0]).toMatch(/; Secure$/);
  });

  it('clears with the same path it was set with, so the browser removes it', () => {
    const { jar, written } = fakeJar({ signed_in: 'owner' });

    createSessionHint(jar).clear();

    expect(written).toEqual(['signed_in=; Max-Age=0; Path=/; SameSite=Lax']);
  });

  it('behaves as "no hint" when there is no cookie jar, as on the server', () => {
    const hint = createSessionHint(undefined);

    hint.set('owner');
    expect(hint.exists()).toBe(false);
  });
});

describe('roleFromHint', () => {
  it('accepts the two real roles and nothing else', () => {
    expect(roleFromHint('owner')).toBe('owner');
    expect(roleFromHint('reviewer')).toBe('reviewer');
    expect(roleFromHint('admin')).toBeNull();
    expect(roleFromHint('1')).toBeNull();
    expect(roleFromHint('')).toBeNull();
    expect(roleFromHint(undefined)).toBeNull();
  });
});
