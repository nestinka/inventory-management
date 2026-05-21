import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', ...opts }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null): string {
  return formatDate(date, { dateStyle: 'medium', timeStyle: 'short' });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `date` falls before `windowDays` from the current request time
 * (already-elapsed dates count as within the window too). Returns false for null.
 * Centralises the request-time read so component render stays free of `Date.now()`.
 */
export function isWithinDays(date: Date | string | null, windowDays: number): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now() + windowDays * DAY_MS;
}

/** Whole days from the current request time until `date` (negative once past). */
export function daysUntil(date: Date | string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / DAY_MS);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}
