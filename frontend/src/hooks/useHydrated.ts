'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true from the render after that.
 *
 * For output that depends on the browser (its time zone, its storage): render the server's
 * version until this is true, so hydration sees the same markup the server sent, then switch.
 * React uses the server snapshot while hydrating, so no effect or extra state is needed.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
