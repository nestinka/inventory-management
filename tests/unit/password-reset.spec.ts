import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/lib/mail', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/env', () => ({
  env: {
    APP_BASE_URL: 'http://localhost:7000',
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { prisma } from '@/server/db/client';
import { sendMail } from '@/server/lib/mail';
import { generateResetToken, validateResetToken, consumeResetToken } from '@/server/modules/auth';
import { ApiError } from '@/server/lib/errors';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  passwordResetToken: {
    findUnique: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockSendMail = sendMail as ReturnType<typeof vi.fn>;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const FAKE_USER = { id: 'user-uuid-1', email: 'test@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── generateResetToken ─────────────────────────────────────────────────────────

describe('generateResetToken', () => {
  it('returns silently when email is not found (no token created, no email sent)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(generateResetToken('unknown@example.com')).resolves.toBeUndefined();

    expect(mockPrisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('creates a token and sends email when email is found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(FAKE_USER);
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    await generateResetToken(FAKE_USER.email);

    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: FAKE_USER.id },
    });

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (mockPrisma.passwordResetToken.create.mock.calls as any[])[0][0] as { data: { userId: string; tokenHash: string; expiresAt: Date } };
    expect(createCall.data.userId).toBe(FAKE_USER.id);
    expect(typeof createCall.data.tokenHash).toBe('string');
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);

    expect(mockSendMail).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mailCall = (mockSendMail.mock.calls as any[])[0][0] as { to: string; html: string };
    expect(mailCall.to).toBe(FAKE_USER.email);
    expect(mailCall.html).toContain('reset-password?token=');
  });

  it('stores a SHA-256 hash of the raw token (not the raw token itself)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(FAKE_USER);
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    await generateResetToken(FAKE_USER.email);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (mockPrisma.passwordResetToken.create.mock.calls as any[])[0][0] as { data: { tokenHash: string } };
    const storedHash = createCall.data.tokenHash;

    // The link in the email contains the raw token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mailCall = (mockSendMail.mock.calls as any[])[0][0] as { html: string };
    const urlMatch = mailCall.html.match(/token=([a-f0-9]+)/);
    expect(urlMatch).not.toBeNull();
    const rawTokenInEmail = urlMatch![1]!;

    // Verify: hash(rawToken) === storedHash
    expect(hashToken(rawTokenInEmail)).toBe(storedHash);
  });
});

// ── validateResetToken ─────────────────────────────────────────────────────────

describe('validateResetToken', () => {
  it('returns userId for a valid unused unexpired token', async () => {
    const raw = 'a'.repeat(64);
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: false,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const result = await validateResetToken(raw);
    expect(result).toEqual({ userId: FAKE_USER.id });
  });

  it('returns null when token is not found', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await validateResetToken('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('returns null when token is already used', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: true,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const result = await validateResetToken('c'.repeat(64));
    expect(result).toBeNull();
  });

  it('returns null when token has expired', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: false,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await validateResetToken('d'.repeat(64));
    expect(result).toBeNull();
  });
});

// ── consumeResetToken ──────────────────────────────────────────────────────────

describe('consumeResetToken', () => {
  it('updates password, clears lock fields, marks token used, and writes audit on success', async () => {
    const raw = 'e'.repeat(64);

    // validateResetToken path
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: false,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    // $transaction mock — invoke the callback with a tx proxy
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await expect(consumeResetToken(raw, 'NewPassword1!')).resolves.toBeUndefined();

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();

    // Inspect what the transaction callback did
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txCb = (mockPrisma.$transaction.mock.calls as any[])[0][0] as (tx: {
      user: { update: ReturnType<typeof vi.fn> };
      passwordResetToken: { update: ReturnType<typeof vi.fn> };
      auditLog: { create: ReturnType<typeof vi.fn> };
    }) => Promise<void>;

    const tx = {
      user: { update: vi.fn().mockResolvedValue({}) },
      passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    await txCb(tx);

    // User password updated and lock cleared
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FAKE_USER.id },
        data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
      }),
    );

    // Token marked as used
    expect(tx.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { used: true },
      }),
    );

    // Audit log written
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('throws NOT_FOUND ApiError when token is expired', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: false,
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    await expect(consumeResetToken('f'.repeat(64), 'NewPassword1!')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND ApiError when token has already been used', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER.id,
      used: true,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    await expect(consumeResetToken('g'.repeat(64), 'NewPassword1!')).rejects.toBeInstanceOf(ApiError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND ApiError when token record does not exist', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(consumeResetToken('h'.repeat(64), 'NewPassword1!')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
