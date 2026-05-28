import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replace mail BEFORE EmailSubscriber loads. The factory cannot reference any
// outer binding (TDZ during hoisted execution); install a plain vi.fn() and
// reach back for it via vi.mocked(sendMail) after imports settle.
vi.mock('@/server/lib/mail', () => ({ sendMail: vi.fn() }));

import { sendMail } from '@/server/lib/mail';
import { prisma, resetDatabase } from '../helpers/db';
import { TestFactory } from '../helpers/factories';
import { eventBus } from '@/server/events/bus';
import { poll } from '@/server/events/dispatcher';
import { InboxSubscriber, EmailSubscriber } from '@/server/modules/notifications';
import { runLowStockScan } from '@/server/jobs/scanners';

type MailArgs = { to: string; subject: string; text?: string; html?: string };
const mailSpy = vi.mocked(sendMail) as unknown as ReturnType<
  typeof vi.fn<(args: MailArgs) => Promise<void>>
>;

let admin1: { id: string; email: string };
let admin2: { id: string; email: string };
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  mailSpy.mockClear();
  // Reset bus subscribers so suites don't double-dispatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (eventBus as any).subscribers = [];
  eventBus.register(new InboxSubscriber());
  eventBus.register(new EmailSubscriber());

  const f = new TestFactory();
  admin1 = await f.createUser({ role: 'ADMIN', name: 'Admin One', email: `admin1-${Date.now()}@test.local` });
  admin2 = await f.createUser({ role: 'ADMIN', name: 'Admin Two', email: `admin2-${Date.now()}@test.local` });
  categoryId = (await f.createCategory()).id;
});

// ───────────────────────────────────────────────────────────────────────────────
// Outbox → dispatcher → subscribers
// ───────────────────────────────────────────────────────────────────────────────

describe('event dispatcher poll', () => {
  it('marks the outbox row dispatched and fans out to inbox + email subscribers', async () => {
    await prisma.$transaction(async (tx) => {
      await eventBus.emit(tx, 'item.lowStock', {
        itemId: '11111111-1111-1111-1111-111111111111',
        name: 'Widget',
        currentStock: 2,
        threshold: 5,
      });
    });

    const before = await prisma.eventOutbox.findFirst({ where: { topic: 'item.lowStock' } });
    expect(before).not.toBeNull();
    expect(before!.dispatchedAt).toBeNull();

    await poll();

    const after = await prisma.eventOutbox.findUniqueOrThrow({ where: { id: before!.id } });
    expect(after.dispatchedAt).not.toBeNull();

    const notifs = await prisma.notification.findMany({ where: { topic: 'item.lowStock' } });
    expect(notifs.map((n) => n.userId).sort()).toEqual([admin1.id, admin2.id].sort());

    expect(mailSpy).toHaveBeenCalledTimes(2);
    const subjects = mailSpy.mock.calls.map((c) => c[0].subject);
    expect(subjects).toEqual([
      '[Inventory] Low Stock Alert',
      '[Inventory] Low Stock Alert',
    ]);
    const recipients = mailSpy.mock.calls.map((c) => c[0].to).sort();
    expect(recipients).toEqual([admin1.email, admin2.email].sort());
  });

  it('uses the out-of-stock template for item.outOfStock', async () => {
    await prisma.$transaction(async (tx) => {
      await eventBus.emit(tx, 'item.outOfStock', {
        itemId: '22222222-2222-2222-2222-222222222222',
        name: 'Empty Widget',
        currentStock: 0,
        threshold: 5,
      });
    });

    await poll();

    expect(mailSpy).toHaveBeenCalled();
    const subject = mailSpy.mock.calls[0]![0].subject;
    expect(subject).toBe('[Inventory] ⚠️ Out of Stock');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Scanner: low-stock vs out-of-stock split + dedup
// ───────────────────────────────────────────────────────────────────────────────

describe('runLowStockScan', () => {
  it('emits item.outOfStock for stock=0 and item.lowStock for non-zero below threshold', async () => {
    const f = new TestFactory();
    const out     = await f.createItem(categoryId, admin1.id, { name: 'Empty' });
    const low     = await f.createItem(categoryId, admin1.id, { name: 'Low' });
    const healthy = await f.createItem(categoryId, admin1.id, { name: 'Healthy' });
    await prisma.item.update({ where: { id: out.id },     data: { currentStock: 0,  reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: low.id },     data: { currentStock: 2,  reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: healthy.id }, data: { currentStock: 10, reorderThreshold: 5 } });

    await runLowStockScan();

    const outbox = await prisma.eventOutbox.findMany({ orderBy: { createdAt: 'asc' } });
    expect(outbox).toHaveLength(2);

    const byTopic = Object.fromEntries(
      outbox.map((row) => [row.topic, row.payload as { itemId: string; name: string }]),
    );
    expect(byTopic['item.outOfStock']?.name).toBe('Empty');
    expect(byTopic['item.lowStock']?.name).toBe('Low');
    expect(outbox.find((row) => (row.payload as { name: string }).name === 'Healthy')).toBeUndefined();
  });

  it('dedupes within the 24h window (second run emits nothing)', async () => {
    const f = new TestFactory();
    const item = await f.createItem(categoryId, admin1.id, { name: 'Low' });
    await prisma.item.update({ where: { id: item.id }, data: { currentStock: 1, reorderThreshold: 5 } });

    await runLowStockScan();
    const after1 = await prisma.eventOutbox.count();
    expect(after1).toBe(1);

    await runLowStockScan();
    const after2 = await prisma.eventOutbox.count();
    expect(after2).toBe(1);
  });
});
