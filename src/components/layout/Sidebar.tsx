'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { navigation, NavigationSection } from '@/lib/constants/routes';
import { Button } from '@/components/ui/button';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                'flex flex-col border-r bg-card transition-all duration-300',
                collapsed ? 'w-16' : 'w-64',
                className
            )}
        >
            {/* Logo / Brand */}
            <div className="flex h-16 items-center justify-between border-b px-4">
                {!collapsed && (
                    <Link href="/" className="flex items-center gap-2">
                        <LayoutDashboard className="h-6 w-6 text-primary" />
                        <span className="font-semibold text-lg">Platform Console</span>
                    </Link>
                )}
                {collapsed && (
                    <Link href="/" className="mx-auto">
                        <LayoutDashboard className="h-6 w-6 text-primary" />
                    </Link>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                {navigation.map((section: NavigationSection) => (
                    <div key={section.title} className="mb-6">
                        {!collapsed && (
                            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {section.title}
                            </h3>
                        )}
                        <ul className="space-y-1 px-2">
                            {section.items.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                const Icon = item.icon;
                                return (
                                    <li key={item.name}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                                collapsed && 'justify-center px-2'
                                            )}
                                            title={collapsed ? item.name : undefined}
                                        >
                                            <Icon className="h-5 w-5 flex-shrink-0" />
                                            {!collapsed && <span>{item.name}</span>}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Collapse Toggle */}
            <div className="border-t p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full justify-center"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </aside>
    );
}
