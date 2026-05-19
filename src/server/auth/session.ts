import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import type { Actor } from './rbac';

export async function getActor(): Promise<Actor | null> {
  // Pre-warm Next.js 15 async headers cache before NextAuth v5-beta accesses it.
  // NextAuth beta calls headers() synchronously inside auth(); awaiting it first
  // here satisfies Next.js 15's strict dynamic-API requirement.
  await headers();
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = session.user as { id: string; email: string; name: string; role: string };
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    role: user.role as Actor['role'],
  };
}
