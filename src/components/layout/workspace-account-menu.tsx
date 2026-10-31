'use client';

import { ChevronDown, LogOut, Moon, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useConsoleTheme } from '@/hooks/use-console-theme';

export function WorkspaceAccountMenu({ locale }: { locale: 'en' | 'ar' }) {
  const { user, logout } = useAuth();
  const { theme, mounted, toggleTheme } = useConsoleTheme();
  const ar = locale === 'ar';
  const label = ar ? 'خيارات الحساب' : 'Account options';
  return (
    <DropdownMenu dir={ar ? 'rtl' : 'ltr'}>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
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
          <DropdownMenuItem onSelect={toggleTheme}>
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
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="me-2 size-4" />
          {ar ? 'تسجيل الخروج' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
