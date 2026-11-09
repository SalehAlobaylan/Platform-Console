'use client';

import { useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Moon, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PasskeySettings } from '@/components/auth/passkey-settings';
import { useConsoleAuthCapabilities } from '@/lib/console-auth-capabilities';
import { useAuth } from '@/hooks/use-auth';
import { useConsoleTheme } from '@/hooks/use-console-theme';

export function WorkspaceAccountMenu({ locale }: { locale: 'en' | 'ar' }) {
  const { user, logout } = useAuth();
  const capabilities = useConsoleAuthCapabilities();
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const [passkeysOpen, setPasskeysOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  async function signOut() {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    } finally {
      setLoggingOut(false);
    }
  }
  const { theme, mounted, toggleTheme } = useConsoleTheme();
  const ar = locale === 'ar';
  const label = ar ? 'خيارات الحساب' : 'Account options';
  return (
    <>
      <DropdownMenu dir={ar ? 'rtl' : 'ltr'}>
        <DropdownMenuTrigger
          ref={accountTrigger}
          render={
            <Button
              variant="ghost"
              className="h-10 shrink-0 gap-2 rounded-md px-2"
              aria-label={label}
              title={label}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User aria-hidden="true" className="size-3.5" />
              </span>
              <span className="hidden max-w-24 truncate text-xs font-medium lg:inline">
                {user?.email?.split('@')[0] || (ar ? 'الحساب' : 'Account')}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="hidden size-3 text-muted-foreground lg:block"
              />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-1">
            <span className="block truncate text-xs font-medium" dir="auto">
              {user?.email || (ar ? 'الحساب' : 'Account')}
            </span>
            {user?.role ? (
              <span className="block text-xs font-normal capitalize text-muted-foreground">
                {user.role}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {mounted ? (
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === 'light' ? (
                <Moon className="me-2 size-4" />
              ) : (
                <Sun className="me-2 size-4" />
              )}
              {theme === 'light'
                ? ar
                  ? 'المظهر الداكن'
                  : 'Dark appearance'
                : ar
                  ? 'المظهر الفاتح'
                  : 'Light appearance'}
            </DropdownMenuItem>
          ) : null}
          {capabilities?.passkeys && (
            <DropdownMenuItem onClick={() => setPasskeysOpen(true)}>
              <KeyRound className="me-2 size-4" />
              {ar ? 'مفاتيح المرور' : 'Passkeys'}
            </DropdownMenuItem>
          )}
          {logoutError && (
            <p role="alert" className="px-2 py-1 text-xs text-destructive">
              {ar
                ? 'تعذر تسجيل الخروج. حاول مرة أخرى.'
                : 'Couldn’t sign out. Try again.'}
            </p>
          )}
          <DropdownMenuItem
            disabled={loggingOut}
            closeOnClick={false}
            onClick={() => void signOut()}
          >
            <LogOut className="me-2 size-4" />
            {ar ? 'تسجيل الخروج' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {capabilities?.passkeys && (
        <PasskeySettings
          open={passkeysOpen}
          onOpenChange={setPasskeysOpen}
          returnFocus={accountTrigger}
        />
      )}
    </>
  );
}
