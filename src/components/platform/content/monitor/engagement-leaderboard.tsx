'use client';

import { useState } from 'react';
import Link from '@/lib/console-link';
import { Eye, Heart, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useContent } from '@/hooks/use-content';
import { formatNumber } from '@/lib/utils/format';
import type { ContentItem } from '@/types/platform/content';

type Metric = 'view_count' | 'like_count' | 'share_count';

const METRICS: { key: Metric; label: string; icon: typeof Eye }[] = [
    { key: 'view_count', label: 'Views', icon: Eye },
    { key: 'like_count', label: 'Likes', icon: Heart },
    { key: 'share_count', label: 'Shares', icon: Share2 },
];

interface EngagementLeaderboardProps {
    typeFilter: `in:${string}`;
}

export function EngagementLeaderboard({ typeFilter }: EngagementLeaderboardProps) {
    const [metric, setMetric] = useState<Metric>('view_count');
    const { data, isLoading } = useContent({
        type: typeFilter,
        status: 'READY',
        sort: metric,
        order: 'desc',
        limit: 5,
    });

    const items = data?.data ?? [];

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1">
                {METRICS.map(({ key, label, icon: Icon }) => (
                    <Button
                        key={key}
                        size="sm"
                        variant={key === metric ? 'default' : 'outline'}
                        onClick={() => setMetric(key)}
                        className="h-7 gap-1 px-2 text-xs"
                    >
                        <Icon className="h-3 w-3" />
                        {label}
                    </Button>
                ))}
            </div>

            {isLoading ? (
                <Skeleton className="h-32 w-full" />
            ) : items.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No engagement data yet.
                </div>
            ) : (
                <div className="space-y-1.5">
                    {items.map((item, i) => (
                        <LeaderRow key={item.id} item={item} metric={metric} rank={i + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

function LeaderRow({ item, metric, rank }: { item: ContentItem; metric: Metric; rank: number }) {
    const href =
        item.type === 'VIDEO' || item.type === 'PODCAST'
            ? `/platform/media/atomization?tab=studio&item=${item.id}`
            : `/platform/content/${item.id}`;
    return (
        <Link
            href={href}
            className="flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
        >
            <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">{rank}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{item.title || '(untitled)'}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums">{formatNumber(item[metric])}</span>
        </Link>
    );
}
