import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { RequestAnalyticsDto, requestAnalytics } from '@/server/modules/reports';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async () => {
      const input = RequestAnalyticsDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      const data = await requestAnalytics(input);
      return NextResponse.json(data);
    },
  })(req);
}
