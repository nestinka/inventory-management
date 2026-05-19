import { prisma } from '@/server/db/client';
import type { Subscriber } from '@/server/events/types';
import type { DomainEvent } from '@/server/events/types';
import { sendMail } from '@/server/lib/mail';
import { logger } from '@/server/lib/logger';

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface LowStockPayload   { itemId: string; name: string; currentStock: number; threshold: number }
interface OutOfStockPayload { itemId: string; name: string; currentStock: number; threshold: number }
interface NearExpiryPayload { itemId: string; name: string; expiryDate: string | Date }
interface RequestPayload    { requestId: string; requesterName?: string; lineCount?: number; note?: string }

// ─── Inbox subscriber ─────────────────────────────────────────────────────────

/** Writes an in-app notification row for each admin or targeted user. */
export class InboxSubscriber implements Subscriber {
  readonly topics = [
    'item.lowStock', 'item.nearExpiry', 'item.outOfStock',
    'request.submitted', 'request.approved', 'request.rejected', 'request.fulfilled',
  ];

  async handle(event: DomainEvent): Promise<void> {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, deletedAt: null },
      select: { id: true },
    });

    // For request-lifecycle events, also notify the requester
    const extra: string[] = [];
    if (
      event.topic === 'request.approved' ||
      event.topic === 'request.rejected' ||
      event.topic === 'request.fulfilled'
    ) {
      const p = event.payload as RequestPayload;
      if (p.requestId) {
        const req = await prisma.request.findFirst({
          where: { id: p.requestId },
          select: { requesterId: true },
        });
        if (req) extra.push(req.requesterId);
      }
    }

    const adminIds = admins.map((u) => u.id);
    const allIds = [...new Set([...adminIds, ...extra])];

    await prisma.notification.createMany({
      data: allIds.map((userId) => ({
        userId,
        topic: event.topic,
        payload: event.payload as object,
      })),
      skipDuplicates: true,
    });
  }
}

// ─── Email subscriber ─────────────────────────────────────────────────────────

/** Sends email for key topics with formatted HTML bodies. */
export class EmailSubscriber implements Subscriber {
  readonly topics = [
    'item.lowStock',
    'item.outOfStock',
    'item.nearExpiry',
    'request.approved',
    'request.rejected',
    'request.fulfilled',
  ];

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (
        event.topic === 'item.lowStock' ||
        event.topic === 'item.outOfStock' ||
        event.topic === 'item.nearExpiry'
      ) {
        // Inventory alerts → all admins
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true, deletedAt: null },
          select: { email: true, name: true },
        });
        const { subject, html, text } = buildEmail(event);
        for (const admin of admins) {
          await sendMail({ to: admin.email, subject, html, text });
        }
      } else if (
        event.topic === 'request.approved' ||
        event.topic === 'request.rejected' ||
        event.topic === 'request.fulfilled'
      ) {
        // Request lifecycle → requester
        const p = event.payload as RequestPayload;
        if (!p.requestId) return;
        const req = await prisma.request.findFirst({
          where: { id: p.requestId },
          select: { requester: { select: { email: true, name: true } } },
        });
        if (!req) return;
        const { subject, html, text } = buildEmail(event);
        await sendMail({ to: req.requester.email, subject, html, text });
      }
    } catch (err) {
      logger.error({ err, topic: event.topic }, 'email subscriber error');
      throw err;
    }
  }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildEmail(event: DomainEvent): { subject: string; html: string; text: string } {
  const subject = subjectFor(event.topic);

  switch (event.topic) {
    case 'item.lowStock': {
      const p = event.payload as LowStockPayload;
      const text =
        `Low Stock Alert\n\n` +
        `Item: ${p.name}\n` +
        `Current stock: ${p.currentStock}\n` +
        `Reorder threshold: ${p.threshold}\n\n` +
        `Please restock this item soon.`;
      const html = emailLayout(subject, `
        <h2 style="color:#d97706;margin:0 0 16px">⚠️ Low Stock Alert</h2>
        <p>The following item has fallen below its reorder threshold:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Item</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(p.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Current Stock</td><td style="padding:8px;border:1px solid #e5e7eb;color:#d97706;font-weight:bold">${p.currentStock}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Reorder Threshold</td><td style="padding:8px;border:1px solid #e5e7eb">${p.threshold}</td></tr>
        </table>
        <p>Please restock this item to avoid disruption.</p>
      `);
      return { subject, html, text };
    }

    case 'item.outOfStock': {
      const p = event.payload as OutOfStockPayload;
      const text =
        `OUT OF STOCK Alert\n\n` +
        `Item: ${p.name}\n` +
        `Stock has reached 0.\n\n` +
        `Immediate restocking is required.`;
      const html = emailLayout(subject, `
        <h2 style="color:#dc2626;margin:0 0 16px">🚨 Out of Stock</h2>
        <p>The following item has run out of stock:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Item</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(p.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Current Stock</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold">0 — OUT OF STOCK</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Reorder Threshold</td><td style="padding:8px;border:1px solid #e5e7eb">${p.threshold}</td></tr>
        </table>
        <p style="color:#dc2626;font-weight:bold">Immediate restocking is required.</p>
      `);
      return { subject, html, text };
    }

    case 'item.nearExpiry': {
      const p = event.payload as NearExpiryPayload;
      const expiryStr = p.expiryDate
        ? new Date(p.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Unknown';
      const text =
        `Near Expiry Alert\n\n` +
        `Item: ${p.name}\n` +
        `Expiry date: ${expiryStr}\n\n` +
        `Please review this item and take appropriate action.`;
      const html = emailLayout(subject, `
        <h2 style="color:#ea580c;margin:0 0 16px">🕐 Near Expiry Alert</h2>
        <p>The following item is approaching its expiry date:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Item</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(p.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Expiry Date</td><td style="padding:8px;border:1px solid #e5e7eb;color:#ea580c;font-weight:bold">${esc(expiryStr)}</td></tr>
        </table>
        <p>Please review this item and take appropriate action before it expires.</p>
      `);
      return { subject, html, text };
    }

    case 'request.approved': {
      const p = event.payload as RequestPayload;
      const short = p.requestId?.slice(0, 8) ?? '';
      const text = `Your request #${short} has been approved.`;
      const html = emailLayout(subject, `
        <h2 style="color:#059669;margin:0 0 16px">✅ Request Approved</h2>
        <p>Your inventory request <strong>#${esc(short)}</strong> has been approved.</p>
        <p>You can view and track your request in the system.</p>
      `);
      return { subject, html, text };
    }

    case 'request.rejected': {
      const p = event.payload as RequestPayload;
      const short = p.requestId?.slice(0, 8) ?? '';
      const text = `Your request #${short} has been rejected${p.note ? `\n\nNote: ${p.note}` : ''}.`;
      const html = emailLayout(subject, `
        <h2 style="color:#dc2626;margin:0 0 16px">❌ Request Rejected</h2>
        <p>Your inventory request <strong>#${esc(short)}</strong> has been rejected.</p>
        ${p.note ? `<p><strong>Reason:</strong> ${esc(p.note)}</p>` : ''}
        <p>Please contact your administrator for further information.</p>
      `);
      return { subject, html, text };
    }

    case 'request.fulfilled': {
      const p = event.payload as RequestPayload;
      const short = p.requestId?.slice(0, 8) ?? '';
      const text = `Your request #${short} has been fulfilled.`;
      const html = emailLayout(subject, `
        <h2 style="color:#0d9488;margin:0 0 16px">📦 Request Fulfilled</h2>
        <p>Your inventory request <strong>#${esc(short)}</strong> has been fulfilled.</p>
        <p>Your items are ready for collection.</p>
      `);
      return { subject, html, text };
    }

    default: {
      const text = JSON.stringify(event.payload, null, 2);
      const html = emailLayout(subject, `<pre style="background:#f3f4f6;padding:16px;border-radius:4px;font-size:12px">${esc(text)}</pre>`);
      return { subject, html, text };
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function subjectFor(topic: string): string {
  const map: Record<string, string> = {
    'item.lowStock':      '[Inventory] Low Stock Alert',
    'item.outOfStock':    '[Inventory] ⚠️ Out of Stock',
    'item.nearExpiry':    '[Inventory] Near Expiry Warning',
    'request.approved':  '[Inventory] Your Request Has Been Approved',
    'request.rejected':  '[Inventory] Your Request Has Been Rejected',
    'request.fulfilled': '[Inventory] Your Request Has Been Fulfilled',
  };
  return map[topic] ?? `[Inventory] ${topic}`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:#1e293b;padding:20px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700">📦 Inventory Management</span>
        </td></tr>
        <tr><td style="padding:32px">
          ${body}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="font-size:12px;color:#6b7280;margin:0">This is an automated notification from your inventory management system.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Notification queries ─────────────────────────────────────────────────────

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
