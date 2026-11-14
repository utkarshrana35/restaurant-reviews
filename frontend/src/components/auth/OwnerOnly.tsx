'use client';

import type { ReactNode } from 'react';
import RequireAuth from './RequireAuth';

/** Renders its children only for a signed-in restaurant owner. Used by the /owner layout. */
export default function OwnerOnly({ children }: { children: ReactNode }) {
  return <RequireAuth role="owner">{() => children}</RequireAuth>;
}
