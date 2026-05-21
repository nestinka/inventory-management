import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { rejectRequest, RejectRequestDto } from '@/server/modules/requests';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: ['ADMIN', 'EDITOR'],
    body: RejectRequestDto,
    handler: async ({ actor }, body) => NextResponse.json(await rejectRequest(id, body, actor)),
  })(req);
}
