import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { ConsumptionReportDto, consumptionReport, toCsv } from '@/server/modules/reports';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async () => {
      const input = ConsumptionReportDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      const data = await consumptionReport(input);

      if (input.format === 'csv') {
        const headers = ['Date', 'Reason', 'Total Consumed', 'Count'];
        const rows = data.map((row) => [
          row.date,
          row.reason,
          row.totalDelta,
          row.count,
        ]);
        const csv = toCsv(headers, rows);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="consumption-report.csv"',
          },
        });
      }

      return NextResponse.json(data);
    },
  })(req);
}
