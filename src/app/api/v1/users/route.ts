import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listUsers, createUser, CreateUserDto, ListUsersDto } from '@/server/modules/users';

export const GET = async (req: NextRequest) => {
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor }) => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const input = ListUsersDto.parse(params);
      const result = await listUsers(input, actor);
      return NextResponse.json(result);
    },
  })(req);
};

export const POST = withRoute({
  role: 'ADMIN',
  body: CreateUserDto,
  handler: async ({ actor, req }, body) => {
    const ip = req.headers.get('x-forwarded-for') ?? undefined;
    const requestId = req.headers.get('x-request-id') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;
    const user = await createUser(body, actor, { ip, requestId, userAgent });
    return NextResponse.json(user, { status: 201 });
  },
});
