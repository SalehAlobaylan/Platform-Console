'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { label: 'Library', href: '/platform/news' },
    { label: 'Sources', href: '/platform/news/sources' },
    { label: 'Feeds Finding', href: '/platform/news/finding' },
    { label: 'Circulation', href: '/platform/news/circulation' },
];

export function NewsSectionNav() {
    const pathname = usePathname();
    return (
        <nav aria-label="News sections" className="flex items-center gap-6 overflow-x-auto border-b">
            {TABS.map((tab) => {
                const active = tab.href === '/platform/news'
                    ? pathname === tab.href
                    : pathname.startsWith(tab.href);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            'whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'border-news font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
