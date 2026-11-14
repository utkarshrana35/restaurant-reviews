import { ROLES, type Role } from '@restaurant-reviews/common';

/** Name of the cookie the frontend sets for itself once a user has signed in. */
export const SESSION_HINT_COOKIE = 'signed_in';

// The longest a session can last (the upper bound of REFRESH_TOKEN_TTL_DAYS). The hint may
// outlive the real session; that only costs one refresh request that answers SESSION_ENDED.
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Reads and writes cookies; `document.cookie` in the browser, replaceable in tests. */
export interface CookieJar {
  read(): string;
  write(cookie: string): void;
}

/** The role a hint cookie's value names, or null if the value is not a role. */
export function roleFromHint(value: string | undefined): Role | null {
  return ROLES.find((role) => role === value) ?? null;
}

/**
 * Remembers, in a cookie written by the frontend, that this browser signed in and as which kind
 * of account. The API never sets or reads it. The real tokens are in HttpOnly cookies scoped to
 * the API, so neither page scripts nor page requests can see them; this cookie is what lets:
 *
 * - the page proxy redirect before a page renders, and
 * - the app tell a returning user (whose access token may need refreshing) from a guest (for
 *   whom a refresh is pointless).
 *
 * It is only a hint: it holds no secret and grants nothing. If it is stale or has been edited,
 * the worst outcome is a page shell the API then refuses to fill, or one refresh request that
 * answers SESSION_ENDED.
 */
export function createSessionHint(jar: CookieJar | undefined, secure = false) {
  const attributes = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;

  const role = (): Role | null => {
    const cookies = (jar?.read() ?? '').split('; ');
    const hint = cookies.find((cookie) => cookie.startsWith(`${SESSION_HINT_COOKIE}=`));
    return roleFromHint(hint?.slice(SESSION_HINT_COOKIE.length + 1));
  };

  return {
    role,
    exists: (): boolean => role() !== null,
    set(signedInAs: Role): void {
      jar?.write(`${SESSION_HINT_COOKIE}=${signedInAs}; Max-Age=${MAX_AGE_SECONDS}; ${attributes}`);
    },
    clear(): void {
      jar?.write(`${SESSION_HINT_COOKIE}=; Max-Age=0; ${attributes}`);
    },
  };
}

const inBrowser = typeof document !== 'undefined';

/** The sign-in hint for this browser. */
export const sessionHint = createSessionHint(
  inBrowser
    ? {
        read: () => document.cookie,
        write: (cookie) => {
          document.cookie = cookie;
        },
      }
    : undefined,
  inBrowser && window.location.protocol === 'https:',
);
