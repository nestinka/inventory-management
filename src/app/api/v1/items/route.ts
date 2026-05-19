import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listItems, createItem, CreateItemDto, ListItemsDto, type CreateItemInput } from '@/server/modules/items';

export async function GET(req: NextRequest) {
  return withRoute({
    handler: async () => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const input = ListItemsDto.parse(params);
      const result = await listItems(input);
      return NextResponse.json(result);
    },
  })(req);
}

export const POST = withRoute({
  role: ['ADMIN', 'EDITOR'],
  body: CreateItemDto,
  handler: async ({ actor }, body) => {
    const item = await createItem(body as CreateItemInput, actor);
    return NextResponse.json(item, { status: 201 });
  },
});
