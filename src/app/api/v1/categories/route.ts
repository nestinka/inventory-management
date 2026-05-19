import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import { listCategories, createCategory, CreateCategoryDto, ListCategoriesDto } from '@/server/modules/categories';

export const GET = async (req: NextRequest) => {
  return withRoute({
    handler: async ({ actor }) => {
      void actor; // any authenticated user
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const input = ListCategoriesDto.parse(params);
      const result = await listCategories(input);
      return NextResponse.json(result);
    },
  })(req);
};

export const POST = withRoute({
  role: 'ADMIN',
  body: CreateCategoryDto,
  handler: async ({ actor, req }, body) => {
    const ip = req.headers.get('x-forwarded-for') ?? undefined;
    const category = await createCategory(body, actor, { ip });
    return NextResponse.json(category, { status: 201 });
  },
});
