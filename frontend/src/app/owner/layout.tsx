import type { ReactNode } from 'react';
import OwnerOnly from '@/components/auth/OwnerOnly';

/**
 * Every page under /owner is for restaurant owners only. The proxy has usually redirected anyone
 * else already, from the sign-in hint cookie; this confirms it from the real session before any
 * of these pages render. The API still checks every request on its own.
 */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
