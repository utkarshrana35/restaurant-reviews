// A fixed locale, so dates read the same everywhere. The time zone is UTC unless one is given:
// the server and the browser's first render both use UTC so their output matches, and the
// browser then switches to the visitor's own zone (see components/LocalDate).
const LOCALE = 'en-GB';
export const UTC = 'UTC';

/** A date from the API (ISO 8601) as "3 Oct 2026", in `timeZone`. */
export function formatDate(iso: string, timeZone: string = UTC): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/** A date from the API as "3 Oct 2026, 17:35 GMT+5:30": the exact moment, naming the zone. */
export function formatDateTime(iso: string, timeZone: string = UTC): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(new Date(iso));
}

/** The visitor's time zone, such as "Asia/Kolkata". Only meaningful in the browser. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
