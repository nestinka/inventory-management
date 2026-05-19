import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { getActor } from '@/server/auth/session';
import type { Actor, Role } from '@/server/auth/rbac';
import { requireRole } from '@/server/auth/rbac';
import { ApiError, toErrorResponse, getStatusCode } from './errors';
import { logger } from './logger';
import { rateLimit } from './rate-limit';
import { env } from '@/env';

type RouteContext = {
  actor: Actor;
  req: NextRequest;
  requestId: string;
  ip: string | null;
};

type RouteHandler<TBody = undefined> = (ctx: RouteContext, body: TBody) => Promise<NextResponse | Response>;

export function withRoute<TBody = undefined>(options: {
  role?: Role | Role[];
  body?: ZodSchema<TBody>;
  handler: RouteHandler<TBody>;
}) {
  return async function (req: NextRequest): Promise<NextResponse | Response> {
    const requestId = crypto.randomUUID();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const start = Date.now();

    try {
      const actor = await getActor();

      if (options.role) {
        requireRole(options.role, actor);
      } else if (!actor) {
        throw new ApiError('AUTH_REQUIRED', 401);
      }

      const limitKey = actor ? `user:${actor.id}` : `ip:${ip}`;
      rateLimit(limitKey, env.RATE_LIMIT_API_PER_MIN);

      let body = undefined as TBody;
      if (options.body) {
        const raw = await req.json().catch(() => ({}));
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          throw new ApiError('VALIDATION_FAILED', 422, 'Validation failed', parsed.error.flatten());
        }
        body = parsed.data;
      }

      const response = await options.handler({ actor: actor!, req, requestId, ip }, body);
      logger.info({ method: req.method, url: req.url, userId: actor?.id, requestId, ms: Date.now() - start }, 'request');
      return response;
    } catch (err) {
      const statusCode = getStatusCode(err);
      const body = toErrorResponse(err);

      if (statusCode >= 500) {
        logger.error({ err, requestId, url: req.url }, 'unhandled error');
      } else {
        logger.warn({ code: body.error.code, url: req.url, requestId }, 'client error');
      }

      return NextResponse.json(body, { status: statusCode });
    }
  };
}
