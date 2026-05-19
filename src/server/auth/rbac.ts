import { ApiError } from '@/server/lib/errors';

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function requireRole(allowed: Role | Role[], actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new ApiError('AUTH_REQUIRED', 401, 'Authentication required');
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(actor.role)) {
    throw new ApiError('FORBIDDEN', 403, `Role '${actor.role}' is not permitted for this action`);
  }
}

export function requireOwnerOrAdmin(ownerId: string, actor: Actor): void {
  if (actor.role === 'ADMIN' || actor.id === ownerId) return;
  throw new ApiError('FORBIDDEN', 403, 'You can only access your own resources');
}

export function isAtLeast(role: Role, actor: Actor): boolean {
  const hierarchy: Role[] = ['VIEWER', 'EDITOR', 'ADMIN'];
  return hierarchy.indexOf(actor.role) >= hierarchy.indexOf(role);
}
