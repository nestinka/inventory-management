import { formatDistanceToNow, isAfter, subDays } from 'date-fns';
import { formatDateTime } from '@/lib/utils';

/**
 * Returns a human-readable relative time string.
 * - Within the last 24 hours → "2 hours ago" etc. (date-fns)
 * - Older → full datetime string (e.g. "19 May 2026, 14:32")
 */
export function formatRelativeTime(date: Date): string {
  const yesterday = subDays(new Date(), 1);
  if (isAfter(date, yesterday)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return formatDateTime(date);
}
