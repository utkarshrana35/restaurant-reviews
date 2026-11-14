import { parseListFilters, type ListPreferences } from './listQuery';

const KEY = 'restaurant-list-preferences';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Remembers the visitor's last filters and sort order for the restaurant list, in localStorage,
 * so they are applied again when the visitor comes back. Whatever is read back is validated the
 * same way as a URL, so an outdated or edited value cannot break the page.
 */
export function createListPreferencesStore(storage: PreferenceStorage | undefined) {
  return {
    load(): ListPreferences | null {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        // The stored values are strings or numbers; the URL parser accepts their string form.
        const asParams = Object.fromEntries(
          Object.entries(parsed).map(([name, value]) => [name, String(value)]),
        );
        const { page: _page, ...preferences } = parseListFilters(asParams);
        return preferences;
      } catch {
        // Blocked storage or a corrupt value: behave as if nothing was saved.
        return null;
      }
    },
    save(preferences: ListPreferences): void {
      try {
        storage?.setItem(KEY, JSON.stringify(preferences));
      } catch {
        // Without storage the preferences are simply not remembered.
      }
    },
  };
}

function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** The preferences store for this browser. */
export const listPreferencesStore = createListPreferencesStore(browserStorage());
