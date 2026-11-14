'use client';

import type { Role, UserDto } from '@restaurant-reviews/common';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LinkButton, Stack, StatusAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

interface RequireAuthProps {
  children: (user: UserDto) => ReactNode;
  /** When given, only this kind of account may see the page. */
  role?: Role;
}

/**
 * Renders its children only for a signed-in user (of the given role, if one is named). A guest
 * is sent to the sign-in page; a signed-in user of the wrong role is told the page is not for
 * them, since signing in again would not help. If the session cannot be checked (the API is
 * unreachable), the visitor stays on the page with a retry rather than being sent away.
 *
 * The token cookies are invisible to the page, so this is decided from the session the API
 * reports. It controls what is shown, not what is allowed: the API checks every request.
 */
export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, isKnown, isError, isRetrying, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Only a definite "nobody is signed in" sends the visitor to sign in. When the session could
  // not be checked at all, they may well still be signed in, and the page offers a retry.
  const mustSignIn = isKnown && !user;
  useEffect(() => {
    if (mustSignIn) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [mustSignIn, pathname, router]);

  if (!user && isError) {
    return (
      <StatusAlert severity="error" onRetry={retry} retrying={isRetrying}>
        Your session could not be checked. Check your connection and try again.
      </StatusAlert>
    );
  }
  if (!user) return <StatusAlert severity="info">Checking your session…</StatusAlert>;

  if (role && user.role !== role) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <StatusAlert severity="error">
          This page is not available for your account type.
        </StatusAlert>
        <LinkButton href="/" variant="contained">
          Back to restaurants
        </LinkButton>
      </Stack>
    );
  }

  return children(user);
}
