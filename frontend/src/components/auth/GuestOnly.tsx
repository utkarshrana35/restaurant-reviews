'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface GuestOnlyProps {
  children: ReactNode;
  /** Where a signed-in user is sent. Must already be a same-site path. */
  redirectTo: string;
}

/**
 * For the sign-in and register pages. A signed-in user is sent on to `redirectTo`, both when
 * they arrive already signed in and at the moment the form on the page signs them in.
 *
 * The form is shown straight away, without waiting to learn who the visitor is: nearly everyone
 * who opens these pages is a guest, and they should not wait on a session check.
 */
export default function GuestOnly({ children, redirectTo }: GuestOnlyProps) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(redirectTo);
  }, [user, redirectTo, router]);

  return user ? null : children;
}
