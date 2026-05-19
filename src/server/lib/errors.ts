export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'STOCK_BELOW_ZERO'
  | 'STALE_REQUEST'
  | 'RATE_LIMITED'
  | 'INVALID_TRANSITION'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export function toErrorResponse(err: unknown): { error: { code: string; message: string; details?: unknown } } {
  if (err instanceof ApiError) {
    return { error: { code: err.code, message: err.message, details: err.details } };
  }
  return { error: { code: 'INTERNAL', message: 'An unexpected error occurred' } };
}

export function getStatusCode(err: unknown): number {
  if (err instanceof ApiError) return err.statusCode;
  return 500;
}
