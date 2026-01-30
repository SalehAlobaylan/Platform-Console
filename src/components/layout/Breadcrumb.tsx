'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items?: BreadcrumbItem[];
    className?: string;
}

// Generate breadcrumb items from pathname
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    let currentPath = '';
    for (const segment of segments) {
        currentPath += `/${segment}`;
        items.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
            href: currentPath,
        });
    }

    return items;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
    const pathname = usePathname();
    const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname);

    if (breadcrumbItems.length === 0) {
        return null;
    }

    return (
        <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <li>
                    <Link
                        href="/"
                        className="flex items-center hover:text-foreground transition-colors"
                    >
                        <Home className="h-4 w-4" />
                        <span className="sr-only">Home</span>
                    </Link>
                </li>
                {breadcrumbItems.map((item, index) => {
                    const isLast = index === breadcrumbItems.length - 1;
                    return (
                        <li key={item.href || index} className="flex items-center gap-1.5">
                            <ChevronRight className="h-4 w-4" />
                            {isLast || !item.href ? (
                                <span className="font-medium text-foreground">{item.label}</span>
                            ) : (
                                <Link
                                    href={item.href}
                                    className="hover:text-foreground transition-colors"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
