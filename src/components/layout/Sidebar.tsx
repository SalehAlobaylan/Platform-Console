'use client';

import Link from '@/lib/console-link';
import { usePathname } from '@/lib/navigation';
import { X, PanelLeftClose, PanelLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navigation, NavigationSection } from '@/lib/constants/routes';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useUIStore();

  const matches = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');
  const activeHref = navigation
    .flatMap((section) => section.items)
    .map((item) => item.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {mobile ? (
        <div className="flex h-14 items-center justify-between border-b px-4">
          <SheetTitle className="text-sm font-semibold">Console navigation</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto py-3">
        {navigation.map((section: NavigationSection) => (
          <div key={section.title} className="mb-1">
            {(mobile || !sidebarCollapsed) && (
              <h3 className="mb-1 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </h3>
            )}
            {sidebarCollapsed && !mobile && (
              <div className="mx-auto my-2 h-px w-6 bg-border" />
            )}
            <ul
              className={cn(
                'space-y-0.5',
                mobile || !sidebarCollapsed ? 'px-2' : 'px-1.5'
              )}
            >
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => mobile && setMobileSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        !mobile && sidebarCollapsed && 'justify-center px-2'
                      )}
                      title={
                        sidebarCollapsed && !mobile ? item.name : undefined
                      }
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {(mobile || !sidebarCollapsed) && (
                        <span>{item.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle - Desktop Only */}
      {!mobile && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden h-8 w-full justify-center text-muted-foreground hover:text-foreground lg:flex"
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r bg-card transition-all duration-200 lg:flex',
          sidebarCollapsed ? 'w-[52px]' : 'w-60',
          className
        )}
      >
        <NavContent />
      </aside>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="w-60 p-0"
          showClose={false}
          finalFocus={() => document.getElementById('console-navigation-trigger')}
        >
          <div className="flex h-full flex-col">
            <NavContent mobile />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
