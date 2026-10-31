'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { WorkspaceNavigation } from './workspace-navigation';
import { OperatorContextProvider } from '@/components/operator/operator-context-provider';

interface DashboardShellProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardShell({ children, className }: DashboardShellProps) {
  const pathname = usePathname();
  if (pathname === '/platform/operator')
    return (
      <OperatorContextProvider>
        <WorkspaceNavigation />
        <main className="h-dvh min-h-0 overflow-hidden bg-background">
          {children}
        </main>
      </OperatorContextProvider>
    );
  return (
    <OperatorContextProvider>
      <WorkspaceNavigation />
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <Header />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />

          <main
            id="console-scroll-region"
            className={cn(
              'scrollbar-thin min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8',
              className
            )}
          >
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </OperatorContextProvider>
  );
}
