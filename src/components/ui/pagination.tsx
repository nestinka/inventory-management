import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  prevUrl: string | null;
  nextUrl: string | null;
}

const btnBase =
  'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors';

export function Pagination({ prevUrl, nextUrl }: Props) {
  if (!prevUrl && !nextUrl) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      {prevUrl ? (
        <Link href={prevUrl} className={`${btnBase} text-foreground hover:bg-muted`}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className={`${btnBase} cursor-not-allowed opacity-40 select-none`} aria-disabled="true">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </span>
      )}

      {nextUrl ? (
        <Link href={nextUrl} className={`${btnBase} text-foreground hover:bg-muted`}>
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={`${btnBase} cursor-not-allowed opacity-40 select-none`} aria-disabled="true">
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
