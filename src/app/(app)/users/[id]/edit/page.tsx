import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getUser } from '@/server/modules/users';
import type { Actor } from '@/server/auth/rbac';
import { ApiError } from '@/server/lib/errors';
import { EditUserForm } from '../../_components/edit-user-form';

export const metadata: Metadata = { title: 'Edit User' };
export const dynamic = 'force-dynamic';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/dashboard');

  const { id } = await params;

  let user;
  try {
    user = await getUser(id, actor);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/users" className="hover:text-foreground transition-colors">
            Users
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">Edit</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Edit User</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>
      <EditUserForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
