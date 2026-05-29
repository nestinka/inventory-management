import { NextResponse } from 'next/server';
import { withRoute } from '@/server/lib/route';
import {
  NotificationSettingsDto,
  getSettingsForClient,
  updateSettings,
} from '@/server/modules/settings';

export const GET = withRoute({
  role: ['ADMIN'],
  handler: async () => {
    const settings = await getSettingsForClient();
    return NextResponse.json(settings);
  },
});

export const PUT = withRoute({
  role: ['ADMIN'],
  body: NotificationSettingsDto,
  handler: async ({ actor, req, requestId, ip }, body) => {
    const ctx = {
      ip: ip ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      requestId,
    };
    await updateSettings(body, actor, ctx);
    const safe = await getSettingsForClient();
    return NextResponse.json(safe);
  },
});
