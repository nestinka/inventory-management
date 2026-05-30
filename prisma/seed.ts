/**
 * Production-minimum seed.
 *
 * Run on every environment (including production) to bootstrap the data the
 * app cannot start without: a single ADMIN user and the four base categories.
 * Idempotent — safe to re-run.
 *
 * For local dev demo data (editor/viewer users, sample items, sample request)
 * run `pnpm db:seed:dev` after this.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🌱 Seeding baseline (admin + categories)...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@inventory.local';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administrator';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: SEED_ADMIN_ID,
      email: adminEmail,
      name: adminName,
      passwordHash: bcrypt.hashSync(adminPassword, 12),
      role: UserRole.ADMIN,
    },
  });

  const categories = [
    { name: 'Laptops', description: 'Portable computers' },
    { name: 'Networking', description: 'Switches, routers, cabling' },
    { name: 'Peripherals', description: 'Monitors, keyboards, mice' },
    { name: 'Consumables', description: 'Toner, batteries, cleaning supplies' },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

  console.log('✅ Baseline seed complete.');
  console.log(`   ${adminEmail} / ${adminPassword === 'Admin1234!' ? 'Admin1234!  (CHANGE IN PRODUCTION)' : '<from SEED_ADMIN_PASSWORD>'}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
