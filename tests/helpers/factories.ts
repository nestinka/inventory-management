import { prisma } from '@/server/db/client';
import { ItemStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class TestFactory {
  private cleanups: Array<() => Promise<void>> = [];

  async createUser(overrides?: Partial<{ name: string; email: string; role: UserRole }>) {
    const user = await prisma.user.create({
      data: {
        name: overrides?.name ?? 'Test User',
        email: overrides?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: await bcrypt.hash('Password1!', 10),
        role: overrides?.role ?? UserRole.EDITOR,
      },
    });
    this.cleanups.push(() =>
      prisma.user.delete({ where: { id: user.id } }).then(() => {}),
    );
    return user;
  }

  async createCategory(overrides?: Partial<{ name: string; description: string }>) {
    const cat = await prisma.category.create({
      data: {
        name: overrides?.name ?? `Cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: overrides?.description,
      },
    });
    this.cleanups.push(() =>
      prisma.category.delete({ where: { id: cat.id } }).then(() => {}),
    );
    return cat;
  }

  async createItem(
    categoryId: string,
    createdById: string,
    overrides?: Partial<{ name: string; unitOfMeasure: string }>,
  ) {
    const item = await prisma.item.create({
      data: {
        name: overrides?.name ?? `Item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        unitOfMeasure: overrides?.unitOfMeasure ?? 'pcs',
        categoryId,
        currentStock: 10,
        reorderThreshold: 2,
        createdById,
        status: ItemStatus.ACTIVE,
      },
    });
    this.cleanups.push(() =>
      prisma.item
        .update({ where: { id: item.id }, data: { deletedAt: new Date() } })
        .then(() => {}),
    );
    return item;
  }

  async teardown() {
    // Run cleanups in reverse order (LIFO)
    for (const fn of [...this.cleanups].reverse()) {
      try {
        await fn();
      } catch {
        // ignore — row may already be gone
      }
    }
    this.cleanups = [];
  }
}
