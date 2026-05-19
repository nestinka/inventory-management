import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { getItemHistory, ListItemsDto } from '@/server/modules/items';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    handler: async () => {
      const input = ListItemsDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      return NextResponse.json(await getItemHistory(id, input));
    },
  })(req);
}
