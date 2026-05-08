'use client';

import type { ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Users,
  Settings,
  LayoutDashboard,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SystemStatus } from './system-status';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: LayoutDashboard },
  { href: '/inbox', label: 'Bandeja', icon: Inbox },
  { href: '/contacts', label: 'Contactos', icon: Users },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: '/settings/social-accounts', label: 'Cuentas Meta', icon: Settings },
  { href: '/settings/queue', label: 'Cola', icon: Activity },
];

interface SidebarProps {
  orgName?: string;
  status?: SystemStatus;
}

export function Sidebar({ orgName, status }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar-background">
      {/* Org header */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          {(orgName ?? 'D').charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold truncate text-sidebar-foreground">
          {orgName ?? 'Despacho'}
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>

      <ScrollArea className="flex-1 py-3">
        {/* Main navigation */}
        <nav className="px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        <Separator className="my-3 mx-2" />

        {/* Settings */}
        <div className="px-2">
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Configuración</p>
          {SETTINGS_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </div>
      </ScrollArea>

      {/* System status footer */}
      {status && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <StatusDots status={status} />
        </div>
      )}
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function StatusDots({ status }: { status: SystemStatus }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StatusRow label="Queue" ok={status.queueHealthy} />
      <StatusRow label="Webhook" ok={status.webhookConnected} />
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          ok ? 'bg-emerald-500' : 'bg-red-500',
        )}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('ml-auto text-xs', ok ? 'text-emerald-600' : 'text-red-500')}>
        {ok ? 'OK' : 'Error'}
      </span>
    </div>
  );
}
