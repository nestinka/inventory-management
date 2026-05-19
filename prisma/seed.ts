import { PrismaClient, UserRole, ItemStatus, AdjustmentReason, RequestStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ────────────────────────────────────────────────────────────────
  const pw = (plain: string) => bcrypt.hashSync(plain, 12);

  const [admin, editor, _viewer] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@inventory.local' },
      update: {},
      create: {
        email: 'admin@inventory.local',
        name: 'Alice Admin',
        passwordHash: pw('Admin1234!'),
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: 'editor@inventory.local' },
      update: {},
      create: {
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
        email: 'viewer@inventory.local',
        name: 'Carol Viewer',
        passwordHash: pw('Viewer1234!'),
        role: UserRole.VIEWER,
      },
    }),
  ]);

  // ── Categories ───────────────────────────────────────────────────────────
  const [laptops, networking, peripherals, consumables] = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Laptops' },
      update: {},
      create: { name: 'Laptops', description: 'Portable computers' },
    }),
    prisma.category.upsert({
      where: { name: 'Networking' },
      update: {},
      create: { name: 'Networking', description: 'Switches, routers, cabling' },
    }),
    prisma.category.upsert({
      where: { name: 'Peripherals' },
      update: {},
      create: { name: 'Peripherals', description: 'Monitors, keyboards, mice' },
    }),
    prisma.category.upsert({
      where: { name: 'Consumables' },
      update: {},
      create: { name: 'Consumables', description: 'Toner, batteries, cleaning supplies' },
    }),
  ]);

  const thirtyDaysFromNow = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
  const sixMonthsFromNow = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  // ── Items ─────────────────────────────────────────────────────────────────
  const itemDefs = [
    // Healthy stock
    { name: 'Dell Latitude 7430', category: laptops, stock: 12, threshold: 3 },
    { name: 'Lenovo ThinkPad X1 Carbon', category: laptops, stock: 8, threshold: 2 },
    { name: 'Cisco 24-Port Switch', category: networking, stock: 6, threshold: 2 },
    { name: 'Cat6 Patch Cable 1m', category: networking, stock: 150, threshold: 30 },
    { name: 'Dell 27" 4K Monitor', category: peripherals, stock: 10, threshold: 3 },
    { name: 'Logitech MX Keys Keyboard', category: peripherals, stock: 20, threshold: 5 },
    { name: 'Logitech MX Master Mouse', category: peripherals, stock: 18, threshold: 5 },
    // Low stock (yellow)
    { name: 'HP EliteBook 840', category: laptops, stock: 2, threshold: 3 },
    { name: 'Cisco ISR 1100 Router', category: networking, stock: 1, threshold: 2 },
    { name: 'HDMI Cable 2m', category: peripherals, stock: 4, threshold: 10 },
    // Out of stock (red)
    { name: 'MacBook Pro 14"', category: laptops, stock: 0, threshold: 2 },
    { name: 'USB-C Docking Station', category: peripherals, stock: 0, threshold: 3 },
    // Consumables with expiry
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

  // ── Sample adjustment history ─────────────────────────────────────────────
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

  // ── Sample request ────────────────────────────────────────────────────────
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
              {
                itemId: kbItem.id,
                requestedQty: 5,
                approvedQty: 5,
                fulfilledQty: 0,
              },
              {
                itemId: mouseItem.id,
                requestedQty: 3,
                approvedQty: 3,
                fulfilledQty: 0,
              },
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

  console.log('✅ Seed complete.');
  console.log('   admin@inventory.local  / Admin1234!');
  console.log('   editor@inventory.local / Editor1234!');
  console.log('   viewer@inventory.local / Viewer1234!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
