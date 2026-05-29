import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { getSettingsForClient } from '@/server/modules/settings';
import { SettingsForm } from './_components/settings-form';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/');

  const settings = await getSettingsForClient();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Notification settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outbound SMTP and the email addresses that receive inventory alerts.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
