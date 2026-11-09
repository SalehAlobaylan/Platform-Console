'use client';

import Link from '@/lib/console-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/platform/content/monitor/sparkline';
import type { ContentDailyPoint } from '@/types/platform/content';
import type { StatusCounts } from '@/types/platform/pipeline';
import type { StorageHealth } from '@/types/platform/storage';
import { type BadgeTone, label, tone } from './overview-logic';

interface ContentFlowPanelProps {
    counts?: StatusCounts;
    countsLoading: boolean;
    sourcesTotal?: number;
    sourcesLoading: boolean;
    storage?: StorageHealth;
    storageLoading: boolean;
    /** Optional daily-ingestion trend shown in the card header. */
    daily?: ContentDailyPoint[];
}

export function ContentFlowPanel({
    counts,
    countsLoading,
    sourcesTotal,
    sourcesLoading,
    storage,
    storageLoading,
    daily,
}: ContentFlowPanelProps) {
    const proof = storage?.proof;
    const utilization = proof ? Math.min(100, Math.max(0, proof.utilization_pct)) : 0;
    const barColor =
        tone(storage?.state) === 'destructive'
            ? 'bg-destructive'
            : tone(storage?.state) === 'warning'
                ? 'bg-warning'
                : 'bg-success';

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle>Content flow</CardTitle>
                        <CardDescription className="mt-1.5">Pipeline, supply, and storage at a glance.</CardDescription>
                    </div>
                    {(daily?.length ?? 0) >= 2 ? <Sparkline daily={daily!.slice(-14)} /> : null}
                </div>
            </CardHeader>
            <CardContent className="space-y-1">
                <FlowRow href="/platform/pipeline" label="Pending" value={counts?.PENDING} loading={countsLoading} toneOverride={counts && counts.PENDING > 0 ? 'warning' : undefined} />
                <FlowRow href="/platform/pipeline" label="Processing" value={counts?.PROCESSING} loading={countsLoading} />
                <FlowRow href="/platform/content" label="Ready" value={counts?.READY} loading={countsLoading} toneOverride="success" />
                <FlowRow href="/platform/pipeline" label="Failed" value={counts?.FAILED} loading={countsLoading} toneOverride={counts && counts.FAILED > 0 ? 'destructive' : undefined} />
                <FlowRow href="/platform/content" label="Archived" value={counts?.ARCHIVED} loading={countsLoading} />
                <div className="my-3 border-t" />
                <FlowRow href="/platform/sources" label="Sources" value={sourcesTotal} loading={sourcesLoading} />
                <div className="rounded-md px-2 py-1.5">
                    <div className="flex items-center justify-between text-sm">
                        <Link href="/platform/storage" className="text-muted-foreground hover:text-foreground hover:underline">
                            Storage
                        </Link>
                        {storageLoading ? (
                            <Skeleton className="h-4 w-16" />
                        ) : proof ? (
                            <span className="flex items-center gap-2">
                                <Badge variant={tone(storage?.state)}>{label(storage?.state)}</Badge>
                                <span className="font-medium tabular-nums">{proof.utilization_pct.toFixed(0)}%</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </div>
                    {proof ? (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                data-testid="storage-utilization-bar"
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${utilization}%` }}
                            />
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function FlowRow({
    href,
    label: rowLabel,
    value,
    loading,
    toneOverride,
}: {
    href: string;
    label: string;
    value?: number;
    loading?: boolean;
    toneOverride?: BadgeTone;
}) {
    return (
        <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
            <Link href={href} className="text-muted-foreground hover:text-foreground hover:underline">
                {rowLabel}
            </Link>
            {loading ? (
                <Skeleton className="h-4 w-12" />
            ) : (
                <span
                    className={
                        toneOverride === 'destructive'
                            ? 'font-medium tabular-nums text-destructive'
                            : toneOverride === 'warning'
                                ? 'font-medium tabular-nums text-amber-600 dark:text-amber-500'
                                : toneOverride === 'success'
                                    ? 'font-medium tabular-nums text-emerald-600 dark:text-emerald-500'
                                    : 'font-medium tabular-nums'
                    }
                >
                    {value?.toLocaleString() ?? '—'}
                </span>
            )}
        </div>
    );
}
