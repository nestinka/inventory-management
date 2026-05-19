import { env } from '@/env';
import { logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _transporter: any = null;

async function getTransporter() {
  if (_transporter) return _transporter;
  // Lazy-import so the bundler doesn't try to resolve Node.js built-ins at compile time
  const nodemailer = (await import('nodemailer')).default;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }),
  });
  return _transporter;
}

export async function sendMail(options: { to: string; subject: string; text?: string; html?: string }) {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from: env.MAIL_FROM, ...options });
    logger.info({ messageId: (info as { messageId?: string }).messageId, to: options.to }, 'email sent');
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, 'email send failed');
    throw err;
  }
}
