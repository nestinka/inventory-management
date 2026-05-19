import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { ReportFormatDto, lowStockReport, toCsv } from '@/server/modules/reports';

export async function GET(req: NextRequest) {
  return withRoute({
    role: ['ADMIN', 'EDITOR'],
    handler: async () => {
      const { format } = ReportFormatDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      const data = await lowStockReport();

      if (format === 'csv') {
        const headers = ['Name', 'Category', 'Current Stock', 'Reorder Threshold', 'Stock State'];
        const rows = data.map((row) => [
          row.name,
          row.category,
          row.currentStock,
          row.reorderThreshold,
          row.stockState,
        ]);
        const csv = toCsv(headers, rows);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="low-stock.csv"',
          },
        });
      }

      return NextResponse.json(data);
    },
  })(req);
}
