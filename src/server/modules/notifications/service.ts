import { prisma } from '@/server/db/client';
import type { Subscriber } from '@/server/events/types';
import type { DomainEvent } from '@/server/events/types';
import { sendMail } from '@/server/lib/mail';
import { logger } from '@/server/lib/logger';

/** Writes an in-app notification row for each admin or targeted user. */
export class InboxSubscriber implements Subscriber {
  readonly topics = [
    'item.lowStock', 'item.nearExpiry', 'request.submitted',
    'request.approved', 'request.rejected', 'request.fulfilled',
  ];

  async handle(event: DomainEvent): Promise<void> {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, deletedAt: null },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: admins.map((u) => ({
        userId: u.id,
        topic: event.topic,
        payload: event.payload as object,
      })),
    });
  }
}

/** Sends email for key topics. Production adapter — swap transport for real SMTP. */
export class EmailSubscriber implements Subscriber {
  readonly topics = [
    'item.lowStock', 'request.approved', 'request.rejected', 'request.fulfilled',
  ];

  async handle(event: DomainEvent): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true, deletedAt: null },
        select: { email: true, name: true },
      });

      const subject = subjectFor(event.topic);
      const text = JSON.stringify(event.payload, null, 2);

      for (const admin of admins) {
        await sendMail({ to: admin.email, subject, text });
      }
    } catch (err) {
      logger.error({ err, topic: event.topic }, 'email subscriber error');
      throw err;
    }
  }
}

function subjectFor(topic: string): string {
  const map: Record<string, string> = {
    'item.lowStock': '[Inventory] Low Stock Alert',
    'request.approved': '[Inventory] Request Approved',
    'request.rejected': '[Inventory] Request Rejected',
    'request.fulfilled': '[Inventory] Request Fulfilled',
  };
  return map[topic] ?? `[Inventory] ${topic}`;
}

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
