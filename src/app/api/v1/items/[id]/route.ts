import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { getItem, updateItem, deleteItem, UpdateItemDto } from '@/server/modules/items';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    handler: async () => NextResponse.json(await getItem(id)),
  })(req);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    body: UpdateItemDto,
    handler: async ({ actor }, body) => NextResponse.json(await updateItem(id, body, actor)),
  })(req);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor }) => {
      await deleteItem(id, actor);
      return new NextResponse(null, { status: 204 });
    },
  })(req);
}
