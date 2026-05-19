import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { approveRequest, ApproveRequestDto } from '@/server/modules/requests';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    body: ApproveRequestDto,
    handler: async ({ actor }, body) => NextResponse.json(await approveRequest(id, body, actor)),
  })(req);
}
