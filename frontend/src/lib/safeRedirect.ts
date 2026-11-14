// Stands in for this site's origin when resolving a path. Any origin works: only whether the
// resolved URL keeps it matters.
const BASE = 'https://this-site.invalid';

/**
 * The `next` query parameter is attacker-controllable, so only same-site paths are honoured.
 * Anything else falls back to home.
 *
 * The path is resolved the way a browser would resolve it, and kept only if it stays on this
 * origin. A string check alone misses what browsers quietly repair: they treat a backslash as a
 * slash and strip tabs and newlines, so `/\evil.example` and `/<tab>/evil.example` both become
 * `//evil.example`, another site. The resolved path is returned, not the original string, so the
 * router is given exactly what was checked.
 */
export function safeRedirect(next: string | string[] | undefined): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/';
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return '/';
  }
  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : '/';
}
