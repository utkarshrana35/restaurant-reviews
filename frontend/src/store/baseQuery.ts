import {
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { SignedInDto, UserDto } from '@restaurant-reviews/common';
import { toApiError } from '@/lib/apiError';

// The tokens live in HttpOnly cookies, so requests carry no auth headers: the browser attaches
// each cookie to the paths it is scoped to.
export const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' });

/** What a refresh found out about the session. */
export type RefreshOutcome =
  /** The session was resumed with a new access token. */
  | { status: 'resumed'; user: UserDto }
  /** The API says there is no session to resume. Final: signing in again is the only way back. */
  | { status: 'ended' }
  /**
   * The refresh did not get an answer about the session (the API unreachable, a 5xx, a 429).
   * The session may well still be valid, so nothing about it should change.
   */
  | { status: 'failed'; error: FetchBaseQueryError };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Asks the API for a new access token using the refresh cookie. Calls made while one is already
 * under way share its result, so a burst of expired requests triggers a single refresh.
 */
export function refreshSession(api: BaseQueryApi): Promise<RefreshOutcome> {
  refreshInFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const result = await rawBaseQuery({ url: 'auth/refresh', method: 'POST' }, api, {});
      if (!result.error) return { status: 'resumed', user: (result.data as SignedInDto).user };
      // Only this answer means the session is over; any other failure leaves it as it was.
      if (toApiError(result.error).code === 'SESSION_ENDED') return { status: 'ended' };
      return { status: 'failed', error: result.error };
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Called when the session has ended and cannot be resumed. */
export type SignedOutHandler = (api: BaseQueryApi) => void;

/**
 * The app's base query. When a protected endpoint answers that the caller is not signed in, the
 * access token has usually just expired: refresh it once and repeat the request.
 *
 * If the API says the session has ended, `onSignedOut` runs and the original 401 is returned. If
 * the refresh itself fails, its error is returned instead, and the user stays signed in: a brief
 * outage must not sign anyone out.
 */
export function createBaseQuery(
  onSignedOut: SignedOutHandler,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  return async (args, api, extraOptions) => {
    const result = await rawBaseQuery(args, api, extraOptions);
    // Only this code means "no valid access token"; a wrong password is also a 401.
    if (!result.error || toApiError(result.error).code !== 'UNAUTHENTICATED') return result;

    const refreshed = await refreshSession(api);
    if (refreshed.status === 'failed') return { error: refreshed.error };
    if (refreshed.status === 'ended') {
      onSignedOut(api);
      return result;
    }
    return rawBaseQuery(args, api, extraOptions);
  };
}
