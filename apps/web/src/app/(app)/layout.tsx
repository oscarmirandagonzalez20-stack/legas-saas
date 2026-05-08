import type { ReactNode } from 'react';
import { getServerAuth } from '@/auth/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { fetchSystemStatus } from '@/components/layout/system-status';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const auth = await getServerAuth();
  const token = await auth.getToken();
  const [status] = await Promise.allSettled([fetchSystemStatus(token)]);

  const systemStatus = status.status === 'fulfilled' ? status.value : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar orgName="Despacho" status={systemStatus} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
