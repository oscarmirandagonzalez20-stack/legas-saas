'use client';

import { Bell, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/auth/hooks';

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const user = useCurrentUser();
  const initials = (user.orgName ?? 'DE').slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menú</span>
      </Button>

      <div className="flex-1" />

      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
        <span className="sr-only">Notificaciones</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.orgName ?? 'Despacho'}</p>
              <p className="text-xs leading-none text-muted-foreground truncate">{user.userId}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings/social-accounts">Cuentas Meta</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <SignOutItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// Rendered only when IS_CLERK=true (build-time constant) — hook called unconditionally.
function ClerkSignOutItem() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useClerk } = require('@clerk/nextjs') as {
    useClerk: () => { signOut: (opts: { redirectUrl: string }) => Promise<void> };
  };
  const { signOut } = useClerk();
  return (
    <DropdownMenuItem onClick={() => { void signOut({ redirectUrl: '/sign-in' }); }}>
      <LogOut className="mr-2 h-4 w-4" />
      Cerrar sesión
    </DropdownMenuItem>
  );
}

function SignOutItem() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <DropdownMenuItem className="text-muted-foreground text-xs">
        Modo desarrollo
      </DropdownMenuItem>
    );
  }
  return <ClerkSignOutItem />;
}
