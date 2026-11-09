'use client';

import Link from '@/lib/console-link';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  useWorkspaceSession,
  rememberConsoleLocation,
} from '@/lib/stores/workspace-session';
import { cn } from '@/lib/utils';
import { OperatorActivityBadge } from '@/components/operator/operator-activity-badge';
import { WorkspaceAccountMenu } from './workspace-account-menu';

export function WorkspaceHeader({
  children,
  workspace,
  locale = 'en',
  className,
  actions,
}: {
  children: ReactNode;
  workspace: 'console' | 'operator';
  locale?: 'en' | 'ar';
  className?: string;
  actions?: ReactNode;
}) {
  const operator = workspace === 'operator';
  const consoleHref = useWorkspaceSession((state) => state.consoleHref);
  const operatorHref = useWorkspaceSession((state) => state.operatorHref);
  const activeLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (useWorkspaceSession.getState().focusAfterSwitch === workspace && activeLink.current) {
      activeLink.current.focus({ preventScroll: true });
      useWorkspaceSession.setState({ focusAfterSwitch: undefined });
    }
  }, [workspace]);
  return (
    <header
      role="banner"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 sm:gap-3 sm:px-4',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="hidden size-6 shrink-0 bg-[url('/images/wahb_mark_transparent.png')] bg-contain bg-center bg-no-repeat dark:bg-[url('/images/wahb_mark_transparent_dark.png')] sm:block"
      />
      <nav
        aria-label={locale === 'ar' ? 'مساحة العمل' : 'Workspace'}
        className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 text-xs font-medium"
      >
        {(
          [
            [
              'console',
              consoleHref,
              locale === 'ar' ? 'الإدارة' : 'Console',
              !operator,
            ],
            [
              'operator',
              operatorHref,
              locale === 'ar' ? 'المشغّل' : 'Operator',
              operator,
            ],
          ] as const
        ).map(([mode, href, label, active]) => (
          <Link
            key={mode}
            ref={active ? activeLink : undefined}
            href={href}
            scroll={false}
            data-workspace={mode}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              if (active) {
                event.preventDefault();
                return;
              }
              if (
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                if (!operator) rememberConsoleLocation();
                useWorkspaceSession.setState({ focusAfterSwitch: mode });
              }
            }}
            className={cn(
              'relative flex h-9 items-center justify-center rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-2.5',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {mode === 'operator' ? (
              <OperatorActivityBadge locale={locale} />
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 items-center gap-1 border-s ps-2 sm:gap-2 sm:ps-3">
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <WorkspaceAccountMenu locale={locale} />
      </div>
    </header>
  );
}
