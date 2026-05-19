import type { Session } from 'next-auth';
import { LogOut, User } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { NotificationBell } from '@/components/layout/notification-bell';

interface TopbarProps { session: Session }

export function Topbar({ session }: TopbarProps) {
  const user = session.user as { name?: string; email?: string; role?: string };
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          IN
        </span>
        <span className="font-semibold text-sm text-foreground">Inventory</span>
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <User className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="hidden md:block">
            <p className="font-medium text-foreground leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.role}</p>
          </div>
        </div>

        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
