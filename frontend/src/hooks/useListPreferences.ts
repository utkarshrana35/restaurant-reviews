'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { listPreferencesStore } from '@/lib/listPreferencesStore';
import {
  isDefaultPreferences,
  paramsFromSearch,
  parseListFilters,
  toQueryString,
  urlNamesPreferences,
  type ListFilters,
  type ListPreferences,
} from '@/lib/listQuery';

const listUrl = (filters: ListFilters) => {
  const query = toQueryString(filters);
  return query ? `/?${query}` : '/';
};

const preferencesOf = ({ page: _page, ...preferences }: ListFilters): ListPreferences =>
  preferences;

/**
 * The restaurant list's filters, order and page, kept in the URL, and the visitor's remembered
 * filters and order.
 *
 * Changes update the URL with the History API, which Next.js syncs with `useSearchParams`, so
 * the component re-renders with the new filters without asking the server for a new page. The
 * data for them is then fetched from the browser.
 *
 * On arrival with no filters or order in the URL, the saved ones are applied, which is how a
 * returning visitor finds the list as they left it. A URL that names them (a shared link, the
 * back button) takes precedence, and becomes the saved choice.
 */
export function useListPreferences() {
  const params = paramsFromSearch(useSearchParams());
  const filters = parseListFilters(params);
  const urlHasPreferences = urlNamesPreferences(params);
  const query = toQueryString(filters);

  useEffect(() => {
    if (urlHasPreferences) {
      listPreferencesStore.save(preferencesOf(filters));
      return;
    }
    const saved = listPreferencesStore.load();
    if (saved && !isDefaultPreferences(saved)) {
      window.history.replaceState(null, '', listUrl({ ...saved, page: 1 }));
    }
    // `query` stands for `filters`, whose object identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlHasPreferences]);

  /** Applies new filters or a new order, starting again from the first page. */
  const changePreferences = (preferences: ListPreferences) => {
    // Saved first, so that resetting to the defaults is not undone by the restore above.
    listPreferencesStore.save(preferences);
    window.history.replaceState(null, '', listUrl({ ...preferences, page: 1 }));
  };

  /** Moves to another page. A history entry, so Back returns to the previous page. */
  const changePage = (page: number) => {
    window.history.pushState(null, '', listUrl({ ...filters, page }));
    window.scrollTo({ top: 0 });
  };

  return { filters, changePreferences, changePage };
}
