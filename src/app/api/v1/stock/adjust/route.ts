import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { adjust, AdjustStockDto } from '@/server/modules/stock';
import { prisma } from '@/server/db/client';

export const POST = withRoute({
  role: ['ADMIN', 'EDITOR'],
  body: AdjustStockDto,
  handler: async ({ actor, req }, body) => {
    const idempotencyKey = req.headers.get('idempotency-key');

    if (idempotencyKey) {
      const cached = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (cached && cached.expiresAt > new Date()) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }

    const result = await adjust(body, actor);

    if (idempotencyKey) {
      await prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        update: {},
        create: {
          key: idempotencyKey,
          statusCode: 200,
          body: result as object,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return NextResponse.json(result);
  },
});
