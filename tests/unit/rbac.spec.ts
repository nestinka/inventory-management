import { describe, it, expect } from 'vitest';
import { requireRole, requireOwnerOrAdmin, isAtLeast } from '@/server/auth/rbac';
import type { Actor } from '@/server/auth/rbac';
import { ApiError } from '@/server/lib/errors';

const make = (role: Actor['role']): Actor => ({ id: 'u1', email: 'a@b.com', name: 'Test', role });

describe('requireRole', () => {
  it('passes when role matches', () => {
    expect(() => requireRole('ADMIN', make('ADMIN'))).not.toThrow();
  });

  it('passes when role is in array', () => {
    expect(() => requireRole(['ADMIN', 'EDITOR'], make('EDITOR'))).not.toThrow();
  });

  it('throws FORBIDDEN when role insufficient', () => {
    expect(() => requireRole('ADMIN', make('VIEWER'))).toThrow(ApiError);
    expect(() => requireRole('ADMIN', make('VIEWER'))).toThrow('FORBIDDEN');
  });

  it('throws AUTH_REQUIRED when no actor', () => {
    expect(() => requireRole('ADMIN', null)).toThrow('AUTH_REQUIRED');
  });
});

describe('requireOwnerOrAdmin', () => {
  it('allows admin to access any resource', () => {
    expect(() => requireOwnerOrAdmin('other-user', make('ADMIN'))).not.toThrow();
  });

  it('allows owner to access own resource', () => {
    const actor = make('EDITOR');
    expect(() => requireOwnerOrAdmin(actor.id, actor)).not.toThrow();
  });

  it('blocks editor accessing another user\'s resource', () => {
    expect(() => requireOwnerOrAdmin('other-id', make('EDITOR'))).toThrow(ApiError);
  });
});

describe('isAtLeast', () => {
  it.each([
    ['ADMIN',  'ADMIN',  true],
    ['ADMIN',  'EDITOR', true],
    ['ADMIN',  'VIEWER', true],
    ['EDITOR', 'ADMIN',  false],
    ['EDITOR', 'EDITOR', true],
    ['EDITOR', 'VIEWER', true],
    ['VIEWER', 'ADMIN',  false],
    ['VIEWER', 'EDITOR', false],
    ['VIEWER', 'VIEWER', true],
  ] as const)('%s actor: isAtLeast(%s) → %s', (actorRole, minRole, expected) => {
    expect(isAtLeast(minRole, make(actorRole))).toBe(expected);
  });
});
