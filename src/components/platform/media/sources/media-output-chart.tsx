'use client';

import Link from '@/lib/console-link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';
import type { SourceStats } from '@/types/platform/source';

interface MediaOutputChartProps {
    stats?: SourceStats;
    isLoading: boolean;
}

const pct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const libraryHref = (name: string) => `/platform/media?source_name=${encodeURIComponent(name)}`;

/**
 * Top producing channels — a horizontal bar leaderboard of media sources by
 * items produced, with a ready/failed split. Sorted by volume, labeled directly
 * (data-viz: bars, not pie). Fed by the media-scoped stats endpoint.
 */
export function MediaOutputChart({ stats, isLoading }: MediaOutputChartProps) {
    const rows = stats?.top_sources ?? [];
    const max = Math.max(...rows.map((r) => r.items), 1);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Top producing channels</CardTitle>
                <p className="text-xs text-muted-foreground">Items ingested · ready / failed split</p>
            </CardHeader>
            <CardContent>
                {isLoading && !stats ? (
                    <Skeleton className="h-48 w-full" />
                ) : rows.length === 0 ? (
                    <div className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
                        No media produced yet.
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {rows.map((s) => (
                            <Link
                                key={s.name}
                                href={libraryHref(s.name)}
                                className="block space-y-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50"
                            >
                                <div className="flex items-center justify-between gap-2 text-sm">
                                    <span className="truncate" title={s.name}>
                                        {s.name}
                                    </span>
                                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                                        {formatNumber(s.items)}
                                        {s.failed > 0 && (
                                            <span className="ml-1.5 text-destructive">
                                                ·{formatNumber(s.failed)} failed
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="flex h-full"
                                        style={{ width: `${pct(s.items, max)}%`, minWidth: '4px' }}
                                    >
                                        <div className="bg-success" style={{ width: `${pct(s.ready, s.items)}%` }} />
                                        <div className="bg-destructive" style={{ width: `${pct(s.failed, s.items)}%` }} />
                                        <div className={cn('flex-1 bg-foreground/20')} />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
