import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { getUser, updateUser, deleteUser, UpdateUserDto } from '@/server/modules/users';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor }) => NextResponse.json(await getUser(id, actor)),
  })(req);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    body: UpdateUserDto,
    handler: async ({ actor, req: request }, body) => {
      const ip = request.headers.get('x-forwarded-for') ?? undefined;
      const requestId = request.headers.get('x-request-id') ?? undefined;
      const userAgent = request.headers.get('user-agent') ?? undefined;
      return NextResponse.json(await updateUser(id, body, actor, { ip, requestId, userAgent }));
    },
  })(req);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor, req: request }) => {
      const ip = request.headers.get('x-forwarded-for') ?? undefined;
      const requestId = request.headers.get('x-request-id') ?? undefined;
      const userAgent = request.headers.get('user-agent') ?? undefined;
      await deleteUser(id, actor, { ip, requestId, userAgent });
      return new NextResponse(null, { status: 204 });
    },
  })(req);
}
