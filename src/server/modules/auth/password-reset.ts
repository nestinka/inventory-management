import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/client';
import { sendMail } from '@/server/lib/mail';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import { env } from '@/env';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function generateResetToken(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, email: true },
  });

  // Silent return — do not leak user existence
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing tokens for this user (rate-limit: one active token at a time)
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your Inventory password',
    text: [
      'You requested a password reset for your Inventory account.',
      `Visit the link below to reset your password (expires in 1 hour):`,
      resetUrl,
      "If you didn't request this, ignore this email.",
    ].join('\n\n'),
    html: `
      <p>You requested a password reset for your Inventory account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> — this link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}

export async function validateResetToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.used) return null;
  if (record.expiresAt < new Date()) return null;

  return { userId: record.userId };
}

export async function consumeResetToken(token: string, newPassword: string): Promise<void> {
  const valid = await validateResetToken(token);
  if (!valid) {
    throw new ApiError('NOT_FOUND', 404, 'This reset link is invalid or has expired.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const tokenHash = hashToken(token);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: valid.userId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // Mark token as used (soft-delete approach)
    await tx.passwordResetToken.update({
      where: { tokenHash },
      data: { used: true },
    });

    await writeAudit(tx, {
      actorId: valid.userId,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: valid.userId,
      diff: { after: { passwordHash: '[REDACTED]', failedLoginCount: 0, lockedUntil: null } },
    });
  });
}
