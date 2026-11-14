import type { UserDto } from '@restaurant-reviews/common';
import { useGetSessionQuery } from '@/store/apiSlice';

interface Auth {
  /**
   * The signed-in user, or null. Null means "guest" only when `isKnown` is true; before that it
   * means the session is still loading or could not be checked.
   */
  user: UserDto | null;
  /**
   * True once the API has said who is signed in, so `user` is a definite answer. False while the
   * session is loading, and when it could not be checked (see `isError`).
   */
  isKnown: boolean;
  /**
   * True when the API could not say who is signed in (it was unreachable, or answered with an
   * error). The session may well still be valid.
   */
  isError: boolean;
  /** True while the session is being asked for again. */
  isRetrying: boolean;
  /** Asks the API again, for example from a Retry button. */
  retry: () => void;
}

/** Who is signed in, as reported by the API. */
export function useAuth(): Auth {
  const { data, isError, isFetching, refetch } = useGetSessionQuery();
  return {
    user: data?.user ?? null,
    isKnown: data !== undefined,
    isError: isError && !data,
    isRetrying: isFetching,
    retry: () => void refetch(),
  };
}
