import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listNotifications, markAllRead } from '@/server/modules/notifications';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async ({ actor }) => NextResponse.json(await listNotifications(actor.id)),
  })(req);
}

export const POST = withRoute({
  handler: async ({ actor }) => {
    await markAllRead(actor.id);
    return new NextResponse(null, { status: 204 });
  },
});
