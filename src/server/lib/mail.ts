import { logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _transporter: any = null;
let _cachedFrom: string | null = null;

async function getTransporter(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transporter: any;
  from: string;
}> {
  // Imported lazily to avoid a circular bootstrap with the settings module
  // (settings → mail → settings) at instrumentation time.
  const { getSettings } = await import('@/server/modules/settings');
  const settings = await getSettings();

  if (_transporter && _cachedFrom === settings.mailFrom) {
    return { transporter: _transporter, from: _cachedFrom };
  }

  // Lazy-import nodemailer so the bundler doesn't try to resolve Node.js built-ins at compile time
  const nodemailer = (await import('nodemailer')).default;
  _transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    ...(settings.smtpUser && {
      auth: { user: settings.smtpUser, pass: settings.smtpPassword ?? '' },
    }),
  });
  _cachedFrom = settings.mailFrom;
  return { transporter: _transporter, from: _cachedFrom };
}

/** Called by settings.updateSettings — forces the next sendMail to rebuild the transport. */
export function invalidateMailTransporter(): void {
  _transporter = null;
  _cachedFrom = null;
}

export async function sendMail(options: { to: string; subject: string; text?: string; html?: string }) {
  try {
    const { transporter, from } = await getTransporter();
    const info = await transporter.sendMail({ from, ...options });
    logger.info({ messageId: (info as { messageId?: string }).messageId, to: options.to }, 'email sent');
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, 'email send failed');
    throw err;
  }
}
