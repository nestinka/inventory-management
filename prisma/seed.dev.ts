/**
 * Dev-only seed. Layered on top of the baseline `prisma/seed.ts`.
 *
 * Adds:
 *   - editor + viewer users (seed creds)
 *   - 16 demo items spanning healthy / low / out-of-stock / expiring
 *   - 3 sample stock adjustments
 *   - 1 sample approved request with status events
 *
 * Idempotent. NEVER run in production — the seed UUIDs and credentials are
 * fixed for dev session continuity and would leak shared accounts.
 */
import { PrismaClient, UserRole, ItemStatus, AdjustmentReason, RequestStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_IDS = {
  admin:  'a0000000-0000-0000-0000-000000000001',
  editor: 'a0000000-0000-0000-0000-000000000002',
  viewer: 'a0000000-0000-0000-0000-000000000003',
} as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed.dev.ts must not run in production');
  }

  console.log('🌱 Seeding dev demo data...');

  const pw = (plain: string) => bcrypt.hashSync(plain, 12);

  const admin = await prisma.user.findUnique({ where: { id: SEED_IDS.admin } });
  if (!admin) {
    throw new Error('Run `pnpm db:seed` first — baseline admin user is missing.');
  }

  const [editor] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'editor@inventory.local' },
      update: {},
      create: {
        id: SEED_IDS.editor,
        email: 'editor@inventory.local',
        name: 'Bob Editor',
        passwordHash: pw('Editor1234!'),
        role: UserRole.EDITOR,
      },
    }),
    prisma.user.upsert({
      where: { email: 'viewer@inventory.local' },
      update: {},
      create: {
        id: SEED_IDS.viewer,
        email: 'viewer@inventory.local',
        name: 'Carol Viewer',
        passwordHash: pw('Viewer1234!'),
        role: UserRole.VIEWER,
      },
    }),
  ]);

  const [laptops, networking, peripherals, consumables] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { name: 'Laptops' } }),
    prisma.category.findUniqueOrThrow({ where: { name: 'Networking' } }),
    prisma.category.findUniqueOrThrow({ where: { name: 'Peripherals' } }),
    prisma.category.findUniqueOrThrow({ where: { name: 'Consumables' } }),
  ]);

  const thirtyDaysFromNow = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
  const sixMonthsFromNow = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const itemDefs = [
    { name: 'Dell Latitude 7430', category: laptops, stock: 12, threshold: 3 },
    { name: 'Lenovo ThinkPad X1 Carbon', category: laptops, stock: 8, threshold: 2 },
    { name: 'Cisco 24-Port Switch', category: networking, stock: 6, threshold: 2 },
    { name: 'Cat6 Patch Cable 1m', category: networking, stock: 150, threshold: 30 },
    { name: 'Dell 27" 4K Monitor', category: peripherals, stock: 10, threshold: 3 },
    { name: 'Logitech MX Keys Keyboard', category: peripherals, stock: 20, threshold: 5 },
    { name: 'Logitech MX Master Mouse', category: peripherals, stock: 18, threshold: 5 },
    { name: 'HP EliteBook 840', category: laptops, stock: 2, threshold: 3 },
    { name: 'Cisco ISR 1100 Router', category: networking, stock: 1, threshold: 2 },
    { name: 'HDMI Cable 2m', category: peripherals, stock: 4, threshold: 10 },
    { name: 'MacBook Pro 14"', category: laptops, stock: 0, threshold: 2 },
    { name: 'USB-C Docking Station', category: peripherals, stock: 0, threshold: 3 },
    {
      name: 'HP LaserJet Toner Black', category: consumables,
      stock: 5, threshold: 2, expiryDate: sixMonthsFromNow,
    },
    {
      name: 'HP LaserJet Toner Cyan', category: consumables,
      stock: 3, threshold: 2, expiryDate: thirtyDaysFromNow,
    },
    {
      name: 'AA Batteries (pack of 10)', category: consumables,
      stock: 8, threshold: 5, expiryDate: sixMonthsFromNow,
    },
    {
      name: 'Screen Cleaning Wipes (50pk)', category: consumables,
      stock: 2, threshold: 5, expiryDate: thirtyDaysFromNow,
    },
  ];

  const itemsByName: Record<string, { id: string }> = {};
  for (const def of itemDefs) {
    const existing = await prisma.item.findFirst({
      where: { name: def.name, deletedAt: null },
    });
    const item = existing
      ? await prisma.item.update({
          where: { id: existing.id },
          data: { currentStock: def.stock },
        })
      : await prisma.item.create({
          data: {
            name: def.name,
            unitOfMeasure: 'pcs',
            categoryId: def.category.id,
            currentStock: def.stock,
            reorderThreshold: def.threshold,
            expiryDate: 'expiryDate' in def ? def.expiryDate : null,
            status: ItemStatus.ACTIVE,
            createdById: admin.id,
          },
        });
    itemsByName[def.name] = item;
  }

  const laptop = itemsByName['Dell Latitude 7430'];
  if (laptop) {
    const count = await prisma.stockAdjustment.count({ where: { itemId: laptop.id } });
    if (count === 0) {
      await prisma.stockAdjustment.createMany({
        data: [
          { itemId: laptop.id, delta: 20, balanceAfter: 20, reason: AdjustmentReason.RECEIVED, actorId: admin.id },
          { itemId: laptop.id, delta: -3, balanceAfter: 17, reason: AdjustmentReason.FULFILMENT, actorId: admin.id },
          { itemId: laptop.id, delta: -5, balanceAfter: 12, reason: AdjustmentReason.CONSUMPTION, actorId: editor.id, note: 'Issued to new starters' },
        ],
      });
    }
  }

  const existingRequest = await prisma.request.findFirst({ where: { requesterId: editor.id } });
  if (!existingRequest) {
    const kbItem = itemsByName['Logitech MX Keys Keyboard'];
    const mouseItem = itemsByName['Logitech MX Master Mouse'];
    if (kbItem && mouseItem) {
      const req = await prisma.request.create({
        data: {
          requesterId: editor.id,
          status: RequestStatus.APPROVED,
          reason: 'Re-stocking helpdesk drawer for Q1',
          approverId: admin.id,
          approvedAt: new Date(),
          lines: {
            create: [
              { itemId: kbItem.id, requestedQty: 5, approvedQty: 5, fulfilledQty: 0 },
              { itemId: mouseItem.id, requestedQty: 3, approvedQty: 3, fulfilledQty: 0 },
            ],
          },
        },
      });
      await prisma.requestStatusEvent.createMany({
        data: [
          { requestId: req.id, fromStatus: null, toStatus: RequestStatus.PENDING, actorId: editor.id },
          { requestId: req.id, fromStatus: RequestStatus.PENDING, toStatus: RequestStatus.APPROVED, actorId: admin.id },
        ],
      });
    }
  }

  console.log('✅ Dev seed complete.');
  console.log('   editor@inventory.local / Editor1234!');
  console.log('   viewer@inventory.local / Viewer1234!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
