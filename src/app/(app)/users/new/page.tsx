import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { CreateUserForm } from '../_components/create-user-form';

export const metadata: Metadata = { title: 'New User' };

export default async function NewUserPage() {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/users" className="hover:text-foreground transition-colors">
            Users
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">New</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">New User</h1>
      </div>
      <CreateUserForm />
    </div>
  );
}
