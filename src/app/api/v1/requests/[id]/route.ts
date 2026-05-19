import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { getRequest } from '@/server/modules/requests';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    handler: async ({ actor }) => NextResponse.json(await getRequest(id, actor)),
  })(req);
}
