import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listAuditLogs, ListAuditLogsDto } from '@/server/modules/audit';
import { toCsv } from '@/server/modules/reports';

const ACTION_DESCRIPTIONS: Record<string, string> = {
  'item.create':           'Item created',
  'item.update':           'Item updated',
  'item.delete':           'Item deleted',
  'stock.adjust':          'Stock adjusted',
  'category.create':       'Category created',
  'category.update':       'Category updated',
  'category.activate':     'Category activated',
  'category.deactivate':   'Category deactivated',
  'request.create':        'Request submitted',
  'request.approve':       'Request approved',
  'request.reject':        'Request rejected',
  'request.cancel':        'Request cancelled',
  'request.fulfil':        'Request fulfilled',
  'user.create':           'User created',
  'user.update':           'User updated',
  'user.delete':           'User deleted',
  'user.password_reset':   'Password reset',
};

export async function GET(req: NextRequest) {
  return withRoute({
    role: ['ADMIN', 'EDITOR'],
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
          ['Time', 'Actor', 'Actor Email', 'Action', 'Description', 'IP'],
          result.data.map((log) => [
            log.createdAt.toISOString(),
            log.actor?.name ?? 'System',
            log.actor?.email ?? '',
            log.action,
            `${ACTION_DESCRIPTIONS[log.action] ?? log.action} (${log.targetType}${log.targetId ? ` · ${log.targetId}` : ''})`,
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
