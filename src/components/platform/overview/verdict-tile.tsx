'use client';

import Link from '@/lib/console-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/platform/content/monitor/sparkline';
import type { ContentDailyPoint } from '@/types/platform/content';
import { label, tone } from './overview-logic';

export interface VerdictTileProps {
    href: string;
    title: string;
    verdict?: string | null;
    detail?: React.ReactNode;
    loading?: boolean;
    isError?: boolean;
    /** Optional trend rendered as a small sparkline; hidden under 2 points. */
    trend?: ContentDailyPoint[];
}

export function VerdictTile({ href, title, verdict, detail, loading, isError, trend }: VerdictTileProps) {
    const unavailable = isError || (!loading && verdict == null && detail == null);
    const showTrend = !loading && !unavailable && (trend?.length ?? 0) >= 2;
    return (
        <Link href={href} data-testid={`verdict-tile-${title}`} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:border-primary/30">
                <CardContent className="px-3 py-2.5 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <p className="text-sm font-medium">{title}</p>
                        {loading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <Badge variant={unavailable ? 'secondary' : tone(verdict)}>
                                {unavailable ? 'unavailable' : label(verdict)}
                            </Badge>
                        )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 sm:mt-2">
                        <div className="line-clamp-2 min-w-0 flex-1 basis-24 break-words text-xs text-muted-foreground">
                            {loading ? null : unavailable ? 'Could not load status.' : detail}
                        </div>
                        {showTrend ? (
                            <div data-testid={`verdict-trend-${title}`} className="shrink-0">
                                <Sparkline daily={trend!} width={72} height={24} />
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
