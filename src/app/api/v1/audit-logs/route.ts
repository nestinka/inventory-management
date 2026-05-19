import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listAuditLogs, ListAuditLogsDto } from '@/server/modules/audit';
import { toCsv } from '@/server/modules/reports';

export async function GET(req: NextRequest) {
  return withRoute({
    role: ['ADMIN', 'VIEWER'],
    handler: async () => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const format = params.format === 'csv' ? 'csv' : 'json';
      // Remove format from the audit dto parse
      const { format: _f, ...rest } = params;
      // Fetch a large page for CSV exports
      const input = ListAuditLogsDto.parse(format === 'csv' ? { ...rest, limit: 200 } : rest);
      const result = await listAuditLogs(input);

      if (format === 'csv') {
        const csv = toCsv(
          ['Time', 'Actor', 'Actor Email', 'Action', 'Target Type', 'Target ID', 'IP'],
          result.data.map((log) => [
            log.createdAt.toISOString(),
            log.actor?.name ?? 'System',
            log.actor?.email ?? '',
            log.action,
            log.targetType,
            log.targetId ?? '',
            log.ip ?? '',
          ]),
        );
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="audit-log.csv"',
          },
        });
      }

      return NextResponse.json(result);
    },
  })(req);
}
