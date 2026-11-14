'use client';

import { Tooltip, Typography } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { browserTimeZone, formatDate, formatDateTime, UTC } from '@/lib/formatDate';

/**
 * A date from the API, shown in the visitor's own time zone, with the exact time and zone in a
 * tooltip.
 *
 * The server cannot know the visitor's zone, so it renders the date in UTC, and so does the
 * browser while hydrating, keeping the two identical. Right after, the browser shows it in its
 * own zone. The two can differ by a day for times near midnight.
 */
export default function LocalDate({ iso }: { iso: string }) {
  const zone = useHydrated() ? browserTimeZone() : UTC;

  return (
    <Tooltip title={formatDateTime(iso, zone)} describeChild>
      <Typography variant="body2" color="text.secondary" component="time" dateTime={iso}>
        {formatDate(iso, zone)}
      </Typography>
    </Tooltip>
  );
}
