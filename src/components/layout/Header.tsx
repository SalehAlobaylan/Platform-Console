'use client';

import { Button } from '@/components/ui/button';
import { Breadcrumb } from './Breadcrumb';
import { WorkspaceHeader } from './workspace-header';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';
import { useUIStore } from '@/lib/stores/ui-store';
import { Menu } from 'lucide-react';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const locale = useWorkspaceSession((state) => state.locale);
  const openNavigation = useUIStore((state) => state.setMobileSidebarOpen);

  return (
    <WorkspaceHeader workspace="console" locale={locale} className={className}>
      <Button
        id="console-navigation-trigger"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 lg:hidden"
        onClick={() => openNavigation(true)}
        aria-label={locale === 'ar' ? 'فتح التنقل' : 'Open navigation'}
      >
        <Menu className="size-4" />
      </Button>
      <div className="hidden min-w-0 flex-1 overflow-hidden md:block">
        <Breadcrumb />
      </div>
    </WorkspaceHeader>
  );
}
