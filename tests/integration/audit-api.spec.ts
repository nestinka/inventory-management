import { describe, it, expect, beforeEach } from 'vitest';
import { listAuditLogs } from '@/server/modules/audit';
import { resetDatabase, prisma } from '../helpers/db';
import { TestFactory } from '../helpers/factories';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000001';

describe('audit log — friendly target names', () => {
  // Isolation comes from resetDatabase() (TRUNCATE ... CASCADE), matching the
  // other integration specs; no per-test factory teardown needed.
  let factory: TestFactory;

  beforeEach(async () => {
    await resetDatabase();
    factory = new TestFactory();
  });

  it('resolves item, category and user targets to their name, with an id fallback otherwise', async () => {
    const admin = await factory.createUser({ role: 'ADMIN', name: 'Ada Admin' });
    const target = await factory.createUser({ role: 'EDITOR', name: 'Ed Editor' });
    const category = await factory.createCategory({ name: 'Laptops' });
    const item = await factory.createItem(category.id, admin.id, { name: 'Dell Latitude 5540' });

    await prisma.auditLog.createMany({
      data: [
        { actorId: admin.id, action: 'item.update', targetType: 'item', targetId: item.id },
        { actorId: admin.id, action: 'category.update', targetType: 'category', targetId: category.id },
        { actorId: admin.id, action: 'user.update', targetType: 'user', targetId: target.id },
        // request targets have no name → keep null (UI falls back to the id)
        { actorId: admin.id, action: 'request.create', targetType: 'request', targetId: UNKNOWN_ID },
        // an item id that no longer resolves → null (UI falls back to the id)
        { actorId: admin.id, action: 'item.delete', targetType: 'item', targetId: UNKNOWN_ID },
      ],
    });

    const { data } = await listAuditLogs({ limit: 50 });
    const byAction = Object.fromEntries(data.map((l) => [l.action, l]));

    expect(byAction['item.update']?.targetName).toBe('Dell Latitude 5540');
    expect(byAction['category.update']?.targetName).toBe('Laptops');
    expect(byAction['user.update']?.targetName).toBe('Ed Editor');
    expect(byAction['request.create']?.targetName).toBeNull();
    expect(byAction['item.delete']?.targetName).toBeNull();
  });

  it('resolves the name even after the item is soft-deleted', async () => {
    const admin = await factory.createUser({ role: 'ADMIN' });
    const category = await factory.createCategory();
    const item = await factory.createItem(category.id, admin.id, { name: 'Retired Scanner' });

    await prisma.auditLog.create({
      data: { actorId: admin.id, action: 'item.delete', targetType: 'item', targetId: item.id },
    });
    await prisma.item.update({ where: { id: item.id }, data: { deletedAt: new Date() } });

    const { data } = await listAuditLogs({ limit: 50 });
    expect(data[0]?.targetName).toBe('Retired Scanner');
  });
});
