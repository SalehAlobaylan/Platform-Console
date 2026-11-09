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
        <Link href={href} data-testid={`verdict-tile-${title}`}>
            <Card className="h-full transition-colors hover:border-primary/30">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{title}</p>
                        {loading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <Badge variant={unavailable ? 'secondary' : tone(verdict)}>
                                {unavailable ? 'unavailable' : label(verdict)}
                            </Badge>
                        )}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                        <div className="line-clamp-2 text-xs text-muted-foreground">
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
