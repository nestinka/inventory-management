import { vi } from 'vitest';
import type { Actor } from '@/server/auth/rbac';

export type MockRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

/**
 * Mock `getActor` (imported by the withRoute helper) to return a fixed actor.
 * Call this at the top of a describe block BEFORE importing route handlers.
 *
 * Because vi.mock is hoisted, the factory receives the desired actor via a
 * module-level variable that is set before each test.
 */
export function mockActor(actor: Actor | null) {
  vi.mocked(getActorMock).mockResolvedValue(actor);
}

// A stable reference to the mocked function — tests import this after calling
// setupActorMock() in a vi.mock factory.
let getActorMock: () => Promise<Actor | null>;

export function setupActorMock(fn: () => Promise<Actor | null>) {
  getActorMock = fn;
}

export function makeActor(
  id: string,
  role: MockRole,
  name = 'Test User',
  email = 'test@example.com',
): Actor {
  return { id, role, name, email };
}
