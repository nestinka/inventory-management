/**
 * In-memory sort helpers for report pages that load all rows up-front.
 *
 * Core list pages sort at the DB layer via Prisma `orderBy`. Reports build
 * derived/aggregated rows in JS that have no direct DB column, so they sort
 * the result array in the server component before passing it to the table.
 */

import type { SortDir } from '@/components/ui/sortable-header';

export type SortGetter<Row> = (row: Row) => string | number | Date | null | undefined;

/**
 * Pick the active sort column from a URL param, falling back to the page's
 * default when the param is missing or not in the allowed list.
 */
export function resolveSort<C extends string>(
  raw: string | undefined,
  allowed: readonly C[],
  fallback: C,
): C {
  return (allowed as readonly string[]).includes(raw ?? '') ? (raw as C) : fallback;
}

export function resolveSortDir(raw: string | undefined, fallback: SortDir): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw;
  return fallback;
}

/**
 * Stable sort by a getter. Nulls and undefineds sink to the end on asc and rise
 * to the top on desc — same behaviour Postgres gives on its NULLS LAST default.
 */
export function sortRows<Row>(
  rows: Row[],
  getter: SortGetter<Row>,
  dir: SortDir,
): Row[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    const aNull = va === null || va === undefined;
    const bNull = vb === null || vb === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1; // nulls always last regardless of direction
    if (bNull) return -1;
    if (va instanceof Date && vb instanceof Date) {
      return (va.getTime() - vb.getTime()) * factor;
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * factor;
    }
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
}
