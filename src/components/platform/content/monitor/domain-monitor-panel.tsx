'use client';

import { type ReactNode } from 'react';
import Link from '@/lib/console-link';
import { AlertCircle, ArrowUpRight, Eye, Heart, RefreshCw, Share2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContent, useContentStats } from '@/hooks/use-content';
import { formatNumber } from '@/lib/utils/format';
import {
    CONTENT_STATUS_LABELS,
    CONTENT_STATUS_VARIANTS,
    CONTENT_TYPE_LABELS,
} from '@/types/platform/content';
import type { ContentItem, ContentType } from '@/types/platform/content';

import { TypeStatusMatrix } from './type-status-matrix';
import { SourceLeaderboard } from './source-leaderboard';
import { Sparkline } from './sparkline';
import { CoverageSection } from './coverage-section';
import { EngagementLeaderboard } from './engagement-leaderboard';

interface DomainMonitorPanelProps {
    title: string;
    overline: string;
    /** Tailwind text-color class for the accent rail + title (e.g. 'text-news'). */
    accentClass: string;
    /** Tailwind bg-color class for the accent rail (e.g. 'bg-news'). */
    railClass: string;
    /** CSS color for the header sparkline (e.g. 'hsl(var(--news))'). */
    accentColor: string;
    /** Drill-in destination (the dedicated management page). */
    href: string;
    /** CMS `type` filter scoping this domain (e.g. 'in:VIDEO,PODCAST'). */
    typeFilter: `in:${string}`;
    /** Types rendered in the breakdown matrix. */
    types: ContentType[];
    /** Ingestion-velocity window (days), driven by the page-level range selector. */
    rangeDays: number;
    /** Which coverage panel to render: text embeddings (news) or captions (media). */
    coverageMode: 'embedding' | 'caption';
    /** Builds a per-source drill-down href into the domain page. */
    sourceHref?: (sourceName: string) => string;
    /** Domain-specific extra section (e.g. media storage summary). */
    extra?: ReactNode;
}

export function DomainMonitorPanel({
    title,
    overline,
    accentClass,
    railClass,
    accentColor,
    href,
    typeFilter,
    types,
    rangeDays,
    coverageMode,
    sourceHref,
    extra,
}: DomainMonitorPanelProps) {
    const stats = useContentStats({ type: typeFilter, range_days: rangeDays });
    const failures = useContent({
        type: typeFilter,
        status: 'FAILED',
        limit: 5,
        sort: 'updated_at',
        order: 'desc',
    });

    const data = stats.data;
    const byStatus = data?.by_status ?? {};
    const loading = stats.isLoading && !data;

    const header = (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
                <p className={`brand-overline ${accentClass}`}>{overline}</p>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
                {data && data.daily.length >= 2 && <Sparkline daily={data.daily} color={accentColor} />}
                <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link href={href}>
                        Manage
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            </div>
        </CardHeader>
    );

    if (stats.isError && !data) {
        return (
            <Card className="relative overflow-hidden">
                <span className={`absolute inset-x-0 top-0 h-0.5 ${railClass}`} aria-hidden />
                {header}
                <CardContent>
                    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-10 text-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <p className="text-sm text-muted-foreground">Couldn&apos;t load {title} stats.</p>
                        <Button variant="outline" size="sm" onClick={() => stats.refetch()} className="gap-1">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden">
            <span className={`absolute inset-x-0 top-0 h-0.5 ${railClass}`} aria-hidden />
            {header}
            <CardContent className="space-y-5">
                {/* Mini KPI row */}
                <div className="grid grid-cols-3 gap-2">
                    <MiniKpi label="Total" value={data?.total ?? 0} loading={loading} />
                    <MiniKpi label="Ready" value={byStatus.READY ?? 0} loading={loading} tone="text-success" />
                    <MiniKpi label="Failed" value={byStatus.FAILED ?? 0} loading={loading} tone="text-destructive" />
                </div>

                {/* Type × status breakdown */}
                <Section title="Breakdown by type">
                    {loading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : (
                        <TypeStatusMatrix matrix={data?.by_type_status ?? {}} types={types} />
                    )}
                </Section>

                {/* Coverage (text embeddings for news, captions for media) */}
                <Section title={coverageMode === 'embedding' ? 'Embedding coverage' : 'Caption coverage'}>
                    <CoverageSection mode={coverageMode} byCaptionState={data?.by_caption_state} />
                </Section>

                {/* Engagement — totals + leaderboard */}
                <Section title="Engagement">
                    <div className="grid grid-cols-3 gap-2">
                        <EngagementStat icon={<Heart className="h-3.5 w-3.5" />} label="Likes" value={data?.engagement.likes ?? 0} loading={loading} />
                        <EngagementStat icon={<Eye className="h-3.5 w-3.5" />} label="Views" value={data?.engagement.views ?? 0} loading={loading} />
                        <EngagementStat icon={<Share2 className="h-3.5 w-3.5" />} label="Shares" value={data?.engagement.shares ?? 0} loading={loading} />
                    </div>
                    <EngagementLeaderboard typeFilter={typeFilter} />
                </Section>

                {/* Domain-specific extra (e.g. media storage) */}
                {extra ? <Section title="Storage">{extra}</Section> : null}

                {/* Top sources */}
                <Section title="Top sources">
                    {loading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : (
                        <SourceLeaderboard sources={data?.top_sources ?? []} buildHref={sourceHref} />
                    )}
                </Section>

                {/* Recent failures */}
                <Section title="Recent failures">
                    {failures.isLoading ? (
                        <Skeleton className="h-16 w-full" />
                    ) : (failures.data?.data ?? []).length > 0 ? (
                        <div className="space-y-2">
                            {failures.data!.data.map((item) => (
                                <FailureRow key={item.id} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                            No failures right now.
                        </div>
                    )}
                </Section>
            </CardContent>
        </Card>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5 border-t pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
            {children}
        </div>
    );
}

function MiniKpi({
    label,
    value,
    loading,
    tone = 'text-foreground',
}: {
    label: string;
    value: number;
    loading: boolean;
    tone?: string;
}) {
    return (
        <div className="rounded-md border p-3">
            {loading ? (
                <Skeleton className="h-7 w-12" />
            ) : (
                <div className={`text-xl font-semibold tabular-nums ${tone}`}>{formatNumber(value)}</div>
            )}
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function EngagementStat({
    icon,
    label,
    value,
    loading,
}: {
    icon: ReactNode;
    label: string;
    value: number;
    loading: boolean;
}) {
    return (
        <div className="rounded-md border p-2.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                {icon}
                <span className="text-[10px] uppercase tracking-wide">{label}</span>
            </div>
            {loading ? (
                <Skeleton className="mt-1 h-5 w-10" />
            ) : (
                <div className="mt-0.5 text-base font-semibold tabular-nums">{formatNumber(value)}</div>
            )}
        </div>
    );
}

function FailureRow({ item }: { item: ContentItem }) {
    const href =
        item.type === 'VIDEO' || item.type === 'PODCAST'
            ? `/platform/media/atomization?tab=studio&item=${item.id}`
            : `/platform/content/${item.id}`;
    return (
        <Link
            href={href}
            className="flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
        >
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.title || '(untitled)'}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{CONTENT_TYPE_LABELS[item.type]}</Badge>
                    <Badge variant={CONTENT_STATUS_VARIANTS[item.status]}>
                        {CONTENT_STATUS_LABELS[item.status]}
                    </Badge>
                    {item.source_name && (
                        <span className="text-xs text-muted-foreground">{item.source_name}</span>
                    )}
                </div>
            </div>
        </Link>
    );
}
