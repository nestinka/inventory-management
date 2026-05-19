import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { NewRequestForm } from '@/components/requests/new-request-form';

export const metadata: Metadata = { title: 'New Request' };

export default async function NewRequestPage() {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/requests" className="hover:text-foreground transition-colors">Requests</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">New request</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">New Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">Submit a request for inventory items.</p>
      </div>
      <NewRequestForm />
    </div>
  );
}
