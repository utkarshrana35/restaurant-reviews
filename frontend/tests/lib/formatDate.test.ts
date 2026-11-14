import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/formatDate';

// Late evening UTC, which is already the next day in India and still the same day in New York.
const LATE_EVENING_UTC = '2026-10-03T23:30:00.000Z';

describe('formatDate', () => {
  it('formats an API date as day, short month and year', () => {
    expect(formatDate('2026-10-03T12:00:00.000Z')).toBe('3 Oct 2026');
  });

  it('uses UTC by default, so the server and every browser render the same text', () => {
    expect(formatDate(LATE_EVENING_UTC)).toBe('3 Oct 2026');
  });

  it("gives the day in the visitor's own zone when asked", () => {
    expect(formatDate(LATE_EVENING_UTC, 'Asia/Kolkata')).toBe('4 Oct 2026');
    expect(formatDate(LATE_EVENING_UTC, 'America/New_York')).toBe('3 Oct 2026');
  });
});

describe('formatDateTime', () => {
  it('gives the exact time and names the zone', () => {
    expect(formatDateTime(LATE_EVENING_UTC)).toBe('3 Oct 2026, 23:30 UTC');
    expect(formatDateTime(LATE_EVENING_UTC, 'Asia/Kolkata')).toBe('4 Oct 2026, 05:00 GMT+5:30');
  });
});
