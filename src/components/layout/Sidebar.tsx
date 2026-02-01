'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navigation, NavigationSection } from '@/lib/constants/routes';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo / Brand */}
      <div
        className={cn(
          'flex h-16 items-center border-b px-4',
          mobile
            ? 'justify-between'
            : sidebarCollapsed
              ? 'justify-center'
              : 'justify-between'
        )}
      >
        {mobile || !sidebarCollapsed ? (
          <Link href="/" className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Platform Console</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </Link>
        )}
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigation.map((section: NavigationSection) => (
          <div key={section.title} className="mb-6">
            {(mobile || !sidebarCollapsed) && (
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <ul
              className={cn(
                'space-y-1',
                mobile || !sidebarCollapsed ? 'px-2' : 'px-1'
              )}
            >
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => mobile && setMobileSidebarOpen(false)}
                      className={cn(
                        'flex touch-manipulation items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        !mobile && sidebarCollapsed && 'justify-center px-2'
                      )}
                      title={
                        sidebarCollapsed && !mobile ? item.name : undefined
                      }
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
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
            className="hidden w-full justify-center lg:flex"
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
          >
            {sidebarCollapsed ? '→' : '←'}
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
          'hidden flex-col border-r bg-card transition-all duration-300 lg:flex',
          sidebarCollapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        <NavContent />
      </aside>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 h-10 w-10 border bg-background shadow-sm"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <NavContent mobile />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
