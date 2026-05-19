import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listRequests, createRequest, CreateRequestDto, ListRequestsDto } from '@/server/modules/requests';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async ({ actor }) => {
      const input = ListRequestsDto.parse(Object.fromEntries(req.nextUrl.searchParams));
      return NextResponse.json(await listRequests(input, actor));
    },
  })(req);
}

export const POST = withRoute({
  role: ['ADMIN', 'EDITOR'],
  body: CreateRequestDto,
  handler: async ({ actor }, body) => {
    const request = await createRequest(body, actor);
    return NextResponse.json(request, { status: 201 });
  },
});
