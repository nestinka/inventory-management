import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { ReportFormatDto, inventorySnapshot, toCsv } from '@/server/modules/reports';

export async function GET(req: NextRequest) {
  return withRoute({
    role: ['ADMIN', 'EDITOR'],
    handler: async () => {
      const { format } = ReportFormatDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      const data = await inventorySnapshot();

      if (format === 'csv') {
        const headers = ['Name', 'Category', 'Unit', 'Current Stock', 'Reorder Threshold', 'Stock State', 'Status', 'Expiry Date'];
        const rows = data.map((row) => [
          row.name,
          row.category,
          row.unitOfMeasure,
          row.currentStock,
          row.reorderThreshold,
          row.stockState,
          row.status,
          row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : null,
        ]);
        const csv = toCsv(headers, rows);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="inventory-snapshot.csv"',
          },
        });
      }

      return NextResponse.json(data);
    },
  })(req);
}
