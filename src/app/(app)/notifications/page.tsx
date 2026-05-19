import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getActor } from '@/server/auth/session';
import { listNotifications } from '@/server/modules/notifications';
import { NotificationsPage } from './_components/notifications-page';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

interface SearchParams {
  filter?: string;
}

export default async function NotificationsServerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getActor();
  if (!actor) redirect('/login');

  const sp = await searchParams;
  const filter = sp.filter === 'unread' ? 'unread' : 'all';

  const notifications = await listNotifications(actor.id, 100);

  return <NotificationsPage notifications={notifications} filter={filter} />;
}
