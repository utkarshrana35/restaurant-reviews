import { describe, expect, it } from 'vitest';
import { createListPreferencesStore } from '@/lib/listPreferencesStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const KEY = 'restaurant-list-preferences';

describe('listPreferencesStore', () => {
  it('loads what it saved', () => {
    const store = createListPreferencesStore(memoryStorage());

    store.save({ cuisine: 'greek', minRating: 3, sort: 'rating_asc' });

    expect(store.load()).toEqual({
      cuisine: 'greek',
      minRating: 3,
      maxRating: undefined,
      sort: 'rating_asc',
    });
  });

  it('has nothing to load before anything is saved', () => {
    expect(createListPreferencesStore(memoryStorage()).load()).toBeNull();
  });

  it('drops invalid saved values and keeps the valid ones', () => {
    const storage = memoryStorage({
      [KEY]: JSON.stringify({ cuisine: 'klingon', minRating: 9, maxRating: 4, sort: 'rating_asc' }),
    });

    expect(createListPreferencesStore(storage).load()).toEqual({
      cuisine: undefined,
      minRating: undefined,
      maxRating: 4,
      sort: 'rating_asc',
    });
  });

  it.each([
    ['text that is not JSON', '{not json'],
    ['JSON that is not an object', '"rating_asc"'],
    ['null', 'null'],
  ])('treats %s as nothing saved', (_label, raw) => {
    expect(createListPreferencesStore(memoryStorage({ [KEY]: raw })).load()).toBeNull();
  });

  it('never throws when storage is blocked or missing', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    for (const store of [
      createListPreferencesStore(blocked),
      createListPreferencesStore(undefined),
    ]) {
      expect(() => store.save({ sort: 'rating_desc' })).not.toThrow();
      expect(store.load()).toBeNull();
    }
  });
});
