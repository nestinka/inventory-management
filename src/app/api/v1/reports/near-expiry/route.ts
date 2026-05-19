import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/server/lib/route';
import { nearExpiryReport, toCsv } from '@/server/modules/reports';
import { env } from '@/env';

const NearExpiryQueryDto = z.object({
  days: z.coerce.number().int().positive().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async () => {
      const params = NearExpiryQueryDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      const days = params.days ?? env.NEAR_EXPIRY_WINDOW_DAYS;
      const data = await nearExpiryReport(days);

      if (params.format === 'csv') {
        const headers = ['Name', 'Category', 'Current Stock', 'Expiry Date'];
        const rows = data.map((row) => [
          row.name,
          row.category,
          row.currentStock,
          row.expiryDate.toISOString().slice(0, 10),
        ]);
        const csv = toCsv(headers, rows);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="near-expiry.csv"',
          },
        });
      }

      return NextResponse.json(data);
    },
  })(req);
}
