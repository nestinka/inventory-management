import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listUsers } from '@/server/modules/users';
import type { Actor } from '@/server/auth/rbac';
import { UserList } from './_components/user-list';
import type { UserRole } from '@/server/modules/users';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; cursor?: string }>;
}) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/dashboard');

  const { q, role, cursor } = await searchParams;

  const validRoles: UserRole[] = ['ADMIN', 'EDITOR', 'VIEWER'];
  const roleFilter = validRoles.includes(role as UserRole) ? (role as UserRole) : undefined;

  const { data: users, nextCursor } = await listUsers(
    { q, role: roleFilter, limit: 50, cursor },
    actor,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</p>
      </div>
      <UserList
        initialUsers={users}
        nextCursor={nextCursor ?? null}
        currentActorId={actor.id}
        initialQ={q ?? ''}
        initialRole={roleFilter ?? ''}
      />
    </div>
  );
}
