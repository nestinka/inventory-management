import pino from 'pino';
import { env } from '@/env';

const redactPaths = [
  'password',
  'passwordHash',
  'token',
  'secret',
  'apiKey',
  'authorization',
  '*.password',
  '*.passwordHash',
  '*.token',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

export type Logger = typeof logger;
