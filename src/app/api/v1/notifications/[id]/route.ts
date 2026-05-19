import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { markRead } from '@/server/modules/notifications';

// PATCH /api/v1/notifications/:id  — mark single notification as read
export function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRoute({
    handler: async ({ actor }) => {
      const { id } = await params;
      await markRead(id, actor.id);
      return new NextResponse(null, { status: 204 });
    },
  })(req);
}
