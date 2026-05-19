import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { getCategory, updateCategory, deactivateCategory, activateCategory, UpdateCategoryDto } from '@/server/modules/categories';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    handler: async () => NextResponse.json(await getCategory(id)),
  })(req);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    body: UpdateCategoryDto,
    handler: async ({ actor }, body) => NextResponse.json(await updateCategory(id, body, actor)),
  })(req);
}

/** PATCH .../deactivate — soft-delete by setting status = INACTIVE */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor }) => {
      await deactivateCategory(id, actor);
      return new NextResponse(null, { status: 204 });
    },
  })(req);
}

/** POST .../activate — re-activate an INACTIVE category */
export const POST = async (req: NextRequest, { params }: Params) => {
  const { id } = await params;
  return withRoute({
    role: 'ADMIN',
    handler: async ({ actor }) => NextResponse.json(await activateCategory(id, actor)),
  })(req);
};
