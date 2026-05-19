import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ForgotPasswordDto } from '@/server/modules/auth';
import { generateResetToken } from '@/server/modules/auth';
import { toErrorResponse, getStatusCode } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = ForgotPasswordDto.safeParse(raw);
    if (!parsed.success) {
      // Still return 200 to avoid leaking info
      return NextResponse.json(
        { message: 'If that address is registered, a reset link has been sent.' },
        { status: 200 },
      );
    }

    await generateResetToken(parsed.data.email);

    return NextResponse.json(
      { message: 'If that address is registered, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (err) {
    const statusCode = getStatusCode(err);
    const body = toErrorResponse(err);
    if (statusCode >= 500) {
      logger.error({ err, requestId, url: req.url }, 'forgot-password error');
    }
    return NextResponse.json(body, { status: statusCode });
  }
}
