import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { BottomTabBar } from '@/components/layout/bottom-tab-bar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  const role = (session.user as { role?: string }).role;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" role={role} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar session={session} />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 pb-20 scrollbar-thin lg:p-6 lg:pb-6"
        >
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <BottomTabBar className="lg:hidden" />
      </div>
    </div>
  );
}
