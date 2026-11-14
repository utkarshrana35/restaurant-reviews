import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Call once at the top of a test file whose tests need to move time. Each test then starts at
 * the real current time, frozen, and moves it with `time.advance`.
 *
 * Only `Date` is replaced. Timers (setTimeout and friends) stay real, so the database driver and
 * the HTTP server keep working normally.
 */
export function useControllableTime(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** Moves the faked clock. Only works in files that call `useControllableTime`. */
export const time = {
  /** Jumps the clock forward. */
  advance({ seconds = 0, minutes = 0 }: { seconds?: number; minutes?: number }): void {
    vi.setSystemTime(Date.now() + (minutes * 60 + seconds) * 1000);
  },
};
