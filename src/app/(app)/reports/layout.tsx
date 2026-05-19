import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role === 'VIEWER') redirect('/');
  return <>{children}</>;
}
