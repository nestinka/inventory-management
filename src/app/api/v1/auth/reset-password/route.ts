import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ResetPasswordDto } from '@/server/modules/auth';
import { consumeResetToken } from '@/server/modules/auth';
import { ApiError, toErrorResponse, getStatusCode } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = ResetPasswordDto.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_FAILED', 422, 'Validation failed', parsed.error.flatten());
    }

    await consumeResetToken(parsed.data.token, parsed.data.password);

    return NextResponse.json({ message: 'Password updated.' }, { status: 200 });
  } catch (err) {
    const statusCode = getStatusCode(err);
    const body = toErrorResponse(err);
    if (statusCode >= 500) {
      logger.error({ err, requestId, url: req.url }, 'reset-password error');
    } else {
      logger.warn({ code: body.error.code, url: req.url, requestId }, 'reset-password client error');
    }
    return NextResponse.json(body, { status: statusCode });
  }
}
