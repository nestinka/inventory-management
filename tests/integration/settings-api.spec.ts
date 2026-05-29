import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Actor } from '@/server/auth/rbac';

const mockSession: { actor: Actor | null } = { actor: null };
vi.mock('@/server/auth/session', () => ({
  getActor: vi.fn(async () => mockSession.actor),
}));

import {
  GET as settingsGet,
  PUT as settingsPut,
} from '@/app/api/v1/settings/notifications/route';
import { prisma, resetDatabase } from '../helpers/db';
import { makeRequest } from '../helpers/http';
import { TestFactory } from '../helpers/factories';

const URL = 'http://localhost:7000/api/v1/settings/notifications';

function actorFrom(u: { id: string; name: string; email: string; role: string }): Actor {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Actor['role'] };
}

let admin: Actor;
let editor: Actor;
let viewer: Actor;

beforeEach(async () => {
  await resetDatabase();
  const f = new TestFactory();
  admin = actorFrom(await f.createUser({ role: 'ADMIN' }));
  editor = actorFrom(await f.createUser({ role: 'EDITOR' }));
  viewer = actorFrom(await f.createUser({ role: 'VIEWER' }));
  mockSession.actor = null;
});

describe('GET /api/v1/settings/notifications', () => {
  it('returns the (seeded-from-env) settings to an ADMIN, with password redacted', async () => {
    mockSession.actor = admin;
    const res = await settingsGet(makeRequest('GET', URL));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.smtpHost).toBeDefined();
    expect(body.smtpPort).toBeDefined();
    expect(body.alertRecipients).toEqual([]);
    expect(body.smtpPasswordSet).toBeDefined();
    // Crucial: the raw password must never reach the client.
    expect(Object.prototype.hasOwnProperty.call(body, 'smtpPassword')).toBe(false);
  });

  it('rejects EDITOR with 403', async () => {
    mockSession.actor = editor;
    const res = await settingsGet(makeRequest('GET', URL));
    expect(res.status).toBe(403);
  });

  it('rejects VIEWER with 403', async () => {
    mockSession.actor = viewer;
    const res = await settingsGet(makeRequest('GET', URL));
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated with 401', async () => {
    const res = await settingsGet(makeRequest('GET', URL));
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/settings/notifications', () => {
  const validBody = () => ({
    smtpHost: 'mail.example.com',
    smtpPort: 587,
    smtpSecure: true,
    smtpUser: 'apikey',
    smtpPassword: 's3cr3t',
    mailFrom: '"Inventory" <no-reply@example.com>',
    alertRecipients: ['ops@example.com', 'manager@example.com'],
  });

  it('persists changes for an ADMIN and writes a settings.update audit row', async () => {
    mockSession.actor = admin;
    const res = await settingsPut(makeRequest('PUT', URL, validBody()));
    expect(res.status).toBe(200);

    const row = await prisma.notificationSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.smtpHost).toBe('mail.example.com');
    expect(row.smtpPort).toBe(587);
    expect(row.smtpSecure).toBe(true);
    expect(row.smtpUser).toBe('apikey');
    expect(row.smtpPassword).toBe('s3cr3t');
    expect(row.alertRecipients).toEqual(['ops@example.com', 'manager@example.com']);
    expect(row.updatedById).toBe(admin.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'settings.update', actorId: admin.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    // smtpPassword must be redacted in the audit diff, not stored plaintext.
    const diff = audit!.diff as { before: { smtpPassword: string }; after: { smtpPassword: string } };
    expect(diff.after.smtpPassword).not.toBe('s3cr3t');
  });

  it('keeps the existing password when the field is omitted', async () => {
    // Seed an existing row with a password.
    await prisma.notificationSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        smtpHost: 'old.example.com', smtpPort: 25, smtpSecure: false,
        smtpUser: null, smtpPassword: 'original-pw',
        mailFrom: 'noreply@old.com', alertRecipients: [],
      },
      update: { smtpPassword: 'original-pw' },
    });

    mockSession.actor = admin;
    const { smtpPassword, ...without } = validBody();
    void smtpPassword;
    const res = await settingsPut(makeRequest('PUT', URL, without));
    expect(res.status).toBe(200);

    const row = await prisma.notificationSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.smtpPassword).toBe('original-pw');
  });

  it('clears the password when null is passed', async () => {
    await prisma.notificationSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        smtpHost: 'old.example.com', smtpPort: 25, smtpSecure: false,
        smtpUser: null, smtpPassword: 'original-pw',
        mailFrom: 'noreply@old.com', alertRecipients: [],
      },
      update: { smtpPassword: 'original-pw' },
    });

    mockSession.actor = admin;
    const res = await settingsPut(makeRequest('PUT', URL, { ...validBody(), smtpPassword: null }));
    expect(res.status).toBe(200);
    const row = await prisma.notificationSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.smtpPassword).toBeNull();
  });

  it('rejects a body with an invalid recipient email (422)', async () => {
    mockSession.actor = admin;
    const res = await settingsPut(
      makeRequest('PUT', URL, { ...validBody(), alertRecipients: ['not-an-email'] }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects EDITOR with 403', async () => {
    mockSession.actor = editor;
    const res = await settingsPut(makeRequest('PUT', URL, validBody()));
    expect(res.status).toBe(403);
  });
});
