import type { PrismaTransaction } from '@/server/db/client';

export type AuditContext = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

const REDACTED_KEYS = new Set(['password', 'passwordHash', 'token', 'secret', 'apiKey']);

export function sanitizeDiff(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDiff);

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACTED_KEYS.has(k) ? '[REDACTED]' : sanitizeDiff(v),
    ]),
  );
}

export async function writeAudit(
  tx: PrismaTransaction,
  params: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    diff?: unknown;
    ctx?: AuditContext;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      diff: params.diff ? (sanitizeDiff(params.diff) as object) : undefined,
      ip: params.ctx?.ip ?? null,
      userAgent: params.ctx?.userAgent ?? null,
      requestId: params.ctx?.requestId ?? null,
    },
  });
}
