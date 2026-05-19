import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listAdjustments, ListAdjustmentsDto } from '@/server/modules/stock';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async () => {
      const input = ListAdjustmentsDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      return NextResponse.json(await listAdjustments(input));
    },
  })(req);
}
