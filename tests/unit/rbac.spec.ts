import { describe, it, expect } from 'vitest';
import { requireRole, requireOwnerOrAdmin, isAtLeast } from '@/server/auth/rbac';
import type { Actor } from '@/server/auth/rbac';
import { ApiError } from '@/server/lib/errors';

const make = (role: Actor['role']): Actor => ({ id: 'u1', email: 'a@b.com', name: 'Test', role });

/** Catch the thrown ApiError and return it, or throw if nothing was thrown. */
function catchApiError(fn: () => void): ApiError {
  try { fn(); } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('Expected function to throw an ApiError but it did not');
}

describe('requireRole', () => {
  it('passes when role matches', () => {
    expect(() => requireRole('ADMIN', make('ADMIN'))).not.toThrow();
  });

  it('passes when role is in array', () => {
    expect(() => requireRole(['ADMIN', 'EDITOR'], make('EDITOR'))).not.toThrow();
  });

  it('throws FORBIDDEN when role insufficient', () => {
    const err = catchApiError(() => requireRole('ADMIN', make('VIEWER')));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.statusCode).toBe(403);
  });

  it('throws AUTH_REQUIRED when no actor', () => {
    const err = catchApiError(() => requireRole('ADMIN', null));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.statusCode).toBe(401);
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
