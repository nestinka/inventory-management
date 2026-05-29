import { z } from 'zod';

export const NotificationSettingsDto = z.object({
  smtpHost: z.string().min(1).max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUser: z.string().max(255).nullable(),
  // `null` clears; a present string overwrites. Undefined (not in body)
  // leaves the stored value untouched — handled in the service.
  smtpPassword: z.string().max(255).nullable().optional(),
  mailFrom: z.string().min(1).max(255),
  alertRecipients: z
    .array(z.string().email())
    .max(50, 'No more than 50 alert recipients'),
});

export type NotificationSettingsInput = z.infer<typeof NotificationSettingsDto>;
