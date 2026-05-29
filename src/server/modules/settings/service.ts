import { prisma } from '@/server/db/client';
import type { PrismaTransaction } from '@/server/db/client';
import { env } from '@/env';
import { writeAudit } from '@/server/lib/audit';
import { invalidateMailTransporter } from '@/server/lib/mail';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import type { NotificationSettingsInput } from './dto';

const SETTINGS_ID = 'default';

export type NotificationSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  mailFrom: string;
  alertRecipients: string[];
  updatedAt: Date | null;
  updatedById: string | null;
};

/** Seeds the singleton row from env on first read. */
export async function getSettings(): Promise<NotificationSettings> {
  const existing = await prisma.notificationSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return rowToSettings(existing);

  const created = await prisma.notificationSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
      smtpSecure: env.SMTP_SECURE,
      smtpUser: env.SMTP_USER || null,
      smtpPassword: env.SMTP_PASS || null,
      mailFrom: env.MAIL_FROM,
      alertRecipients: [],
    },
  });
  return rowToSettings(created);
}

/** Same as getSettings but redacts the password — safe to send to the client. */
export async function getSettingsForClient(): Promise<
  Omit<NotificationSettings, 'smtpPassword'> & { smtpPasswordSet: boolean }
> {
  const s = await getSettings();
  const { smtpPassword, ...rest } = s;
  return { ...rest, smtpPasswordSet: Boolean(smtpPassword) };
}

export async function updateSettings(
  input: NotificationSettingsInput,
  actor: Actor,
  ctx?: AuditContext,
): Promise<NotificationSettings> {
  // Ensure the row exists (seeds from env if first time).
  const current = await getSettings();

  const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
    const next = await tx.notificationSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword:
          input.smtpPassword === undefined ? current.smtpPassword : input.smtpPassword,
        mailFrom: input.mailFrom,
        alertRecipients: input.alertRecipients,
        updatedById: actor.id,
      },
      update: {
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        ...(input.smtpPassword !== undefined && { smtpPassword: input.smtpPassword }),
        mailFrom: input.mailFrom,
        alertRecipients: input.alertRecipients,
        updatedById: actor.id,
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'settings.update',
      targetType: 'settings',
      targetId: SETTINGS_ID,
      diff: {
        before: { ...current, smtpPassword: current.smtpPassword ? '[set]' : '[unset]' },
        after: { ...input, smtpPassword: input.smtpPassword === undefined ? '[unchanged]' : input.smtpPassword ? '[set]' : '[unset]' },
      },
      ctx,
    });

    return rowToSettings(next);
  });

  // Drop the cached nodemailer transport so the next email uses the new SMTP host/port/creds.
  invalidateMailTransporter();

  return updated;
}

/** Recipient list for the inventory-alert subscriber. */
export async function getAlertRecipients(): Promise<string[]> {
  const s = await getSettings();
  return s.alertRecipients;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSettings(row: any): NotificationSettings {
  return {
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPassword: row.smtpPassword,
    mailFrom: row.mailFrom,
    alertRecipients: Array.isArray(row.alertRecipients) ? (row.alertRecipients as string[]) : [],
    updatedAt: row.updatedAt ?? null,
    updatedById: row.updatedById ?? null,
  };
}
