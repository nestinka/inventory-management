import Link from 'next/link';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

/**
 * Loose object type for searchParams. Accepts narrowly-typed page interfaces
 * (`{ q?: string }`) as well as `Record<string, string | string[]>`. Values are
 * stringified at runtime; unrenderable values (objects, functions) are ignored.
 */
type AnySearchParams = Readonly<Record<string, unknown>> | object;

interface Props {
  /** Column key sent back as the `sortBy` URL param. */
  column: string;
  /** Visible header label. */
  label: string;
  /** The currently-active sort column (read from searchParams). */
  currentSort: string | undefined;
  /** The currently-active sort direction (read from searchParams). */
  currentDir: SortDir | undefined;
  /**
   * The other URL params on this page (filters, cursor, etc.) that must be
   * preserved when the user clicks to sort. Pass `searchParams` straight from
   * the page or a curated subset; arrays are flattened to repeated keys.
   */
  searchParams?: AnySearchParams;
  /**
   * Click behaviour when this column is already active. Default `'toggle'`
   * cycles asc → desc → asc. Set to `'reverse'` if asc/desc are not equally
   * meaningful (rare).
   */
  onActiveClick?: 'toggle' | 'reverse';
  /** Optional extra classes for the underlying <th>. */
  className?: string;
  /** Tailwind text-alignment for the header content. Defaults to left. */
  align?: 'left' | 'right' | 'center';
}

function buildHref(
  column: string,
  nextDir: SortDir,
  searchParams: AnySearchParams | undefined,
): string {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams as Record<string, unknown>)) {
      if (key === 'sortBy' || key === 'sortDir') continue;
      if (key === 'cursor' || key === 'stack') continue; // sorting invalidates cursor pagination
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v === undefined || v === null || v === '') continue;
          params.append(key, String(v));
        }
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        params.set(key, String(value));
      }
      // Anything else (objects, functions) is silently dropped — searchParams
      // should be a flat key-value bag from a URL.
    }
  }
  params.set('sortBy', column);
  params.set('sortDir', nextDir);
  return `?${params.toString()}`;
}

export function SortableHeader({
  column,
  label,
  currentSort,
  currentDir,
  searchParams,
  onActiveClick = 'toggle',
  className,
  align = 'left',
}: Props) {
  const isActive = currentSort === column;
  const activeDir: SortDir | undefined = isActive ? currentDir : undefined;

  const nextDir: SortDir = !isActive
    ? 'asc'
    : onActiveClick === 'reverse'
      ? activeDir === 'asc' ? 'desc' : 'asc'
      : activeDir === 'asc' ? 'desc' : 'asc';

  const href = buildHref(column, nextDir, searchParams);

  const Icon = isActive
    ? activeDir === 'desc' ? ArrowDown : ArrowUp
    : ArrowUpDown;

  const alignClass = align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';

  return (
    <th
      scope="col"
      aria-sort={
        isActive ? (activeDir === 'desc' ? 'descending' : 'ascending') : 'none'
      }
      className={className}
    >
      <Link
        href={href}
        className={`group inline-flex items-center gap-1.5 ${alignClass} w-full text-left font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded`}
        scroll={false}
      >
        <span>{label}</span>
        <Icon
          className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
            isActive
              ? 'text-foreground opacity-100'
              : 'text-muted-foreground opacity-40 group-hover:opacity-100'
          }`}
          aria-hidden="true"
        />
      </Link>
    </th>
  );
}
