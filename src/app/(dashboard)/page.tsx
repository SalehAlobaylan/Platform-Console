'use client';

import { useMemo } from 'react';
import { Database, FileText, Newspaper, Video, Radio } from 'lucide-react';
import { useOpsAttention, useOpsStatus } from '@/hooks/use-operations-command-center';
import { useSystemHealth } from '@/hooks/use-system-health';
import { useFeedIntegrityRuns, useFeedIntegrityStatus } from '@/hooks/use-feed-integrity';
import { useExperienceRuns, useExperienceStatus } from '@/hooks/use-real-experience';
import { useAISpendStatus } from '@/hooks/use-ai-spend';
import { useStatusCounts } from '@/hooks/use-pipeline';
import { useStorageHealth } from '@/hooks/use-storage';
import { useSources } from '@/hooks/use-sources';
import { useContentStats } from '@/hooks/use-content';
import { OverviewHeader } from '@/components/platform/overview/overview-header';
import { VerdictTile } from '@/components/platform/overview/verdict-tile';
import { AttentionPreview } from '@/components/platform/overview/attention-preview';
import { ContentFlowPanel } from '@/components/platform/overview/content-flow-panel';
import { ContentStatStrip } from '@/components/platform/overview/content-stat-strip';
import { AggregationHealthPanel } from '@/components/platform/aggregation-health-panel';
import { isAggregationConfigured } from '@/lib/api/aggregation';
import {
    deriveFleetState,
    deriveServicesDetail,
    deriveSpendState,
    deriveWorstRux,
    feedScoreSeries,
    label,
    ruxHealthSeries,
    topAttention,
} from '@/components/platform/overview/overview-logic';

export default function DashboardPage() {
    const ops = useOpsStatus();
    const attention = useOpsAttention();
    const systemHealth = useSystemHealth();
    const feedIntegrity = useFeedIntegrityStatus();
    const experience = useExperienceStatus();
    const spend = useAISpendStatus();
    const statusCounts = useStatusCounts();
    const storage = useStorageHealth();
    const sources = useSources({ page: 1, limit: 1 });
    const integrityRuns = useFeedIntegrityRuns();
    const experienceRuns = useExperienceRuns();
    const contentStats = useContentStats();

    const attentionItems = useMemo(() => topAttention(attention.data?.items), [attention.data]);
    const integrityTrend = useMemo(() => feedScoreSeries(integrityRuns.data?.items), [integrityRuns.data]);
    const ruxTrend = useMemo(() => ruxHealthSeries(experienceRuns.data), [experienceRuns.data]);
    const spendTrend = useMemo(() => (spend.data?.breakdown?.day ?? []).map(d => ({ day: d.key.slice(0, 10), count: d.cost_usd, failed: 0 })), [spend.data]);

    const servicesDetail = deriveServicesDetail(systemHealth.data?.services);
    const feedResults = Object.entries(feedIntegrity.data?.latest_run?.feed_results ?? {})
        .filter(([key]) => !key.includes(':'))
        .map(([, result]) => result)
        .sort((a, b) => (a.feed === 'pods' ? -1 : b.feed === 'pods' ? 1 : a.feed.localeCompare(b.feed)));
    const openEpisodes = feedIntegrity.data?.open_episodes?.length ?? 0;
    const worstRux = deriveWorstRux(experience.data ? experience.data.surface_verdicts : undefined);
    const spendTotal = spend.data?.totals?.cost_usd ?? 0;
    const spendState = spend.data?.headline ?? deriveSpendState(spend.data?.budgets);
    const fleetSummary = deriveFleetState(ops.data?.fleet);

    const byType = contentStats.data?.by_type;
    const contentStatsLoading = contentStats.isLoading || sources.isLoading;
    const contentScale = [
        { label: 'Content Items', value: contentStats.data?.total, icon: FileText, href: '/platform/content', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { label: 'Sources', value: sources.data?.total, icon: Database, href: '/platform/sources', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'News', value: byType?.NEWS, icon: Newspaper, href: '/platform/news', color: 'text-news', bg: 'bg-news/10' },
        { label: 'Video', value: byType?.VIDEO, icon: Video, href: '/platform/media', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Podcast', value: byType?.PODCAST, icon: Radio, href: '/platform/media', color: 'text-gold', bg: 'bg-gold/10' },
    ];

    return (
        <div className="space-y-8">
            <OverviewHeader status={ops.data} isLoading={ops.isLoading} />

            <ContentStatStrip stats={contentScale} loading={contentStatsLoading} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <VerdictTile
                    href="/platform/system-health"
                    title="Services"
                    loading={systemHealth.isLoading}
                    isError={systemHealth.isError}
                    verdict={systemHealth.data?.overall}
                    detail={servicesDetail}
                />
                <VerdictTile
                    href="/platform/feed-integrity"
                    title="Feed Integrity"
                    loading={feedIntegrity.isLoading}
                    isError={feedIntegrity.isError}
                    verdict={feedIntegrity.data?.latest_run?.headline}
                    detail={
                        feedIntegrity.data
                            ? feedResults.length
                                ? (
                                    <span className="flex flex-wrap gap-x-2">
                                        {feedResults.map((f) => (
                                            <span
                                                key={`${f.feed}:${f.variant}`}
                                                className={`font-medium ${f.feed === 'pods' ? 'text-gold' : f.feed === 'news' ? 'text-news' : ''}`}
                                            >
                                                {f.feed} {label(f.consumer_verdict)}
                                            </span>
                                        ))}
                                        {openEpisodes ? <span>{openEpisodes} open episodes</span> : null}
                                    </span>
                                )
                                : 'No runs yet'
                            : undefined
                    }
                    trend={integrityTrend}
                />
                <VerdictTile
                    href="/platform/real-experience"
                    title="Real Experience"
                    loading={experience.isLoading}
                    isError={experience.isError}
                    verdict={worstRux}
                    detail={
                        experience.data
                            ? `${experience.data.open_incidents} open incidents${experience.data.telemetry_fresh ? '' : ' · telemetry stale'}`
                            : undefined
                    }
                    trend={ruxTrend}
                />
                <VerdictTile
                    href="/platform/economics"
                    title="AI Spend"
                    loading={spend.isLoading}
                    isError={spend.isError}
                    verdict={spendState}
                    detail={spend.data ? `$${spendTotal.toFixed(2)} in selected 30-day period` : undefined}
                    trend={spendTrend}
                />
                <VerdictTile
                    href="/platform/operations"
                    title="Autopilot Fleet"
                    loading={ops.isLoading}
                    isError={ops.isError}
                    verdict={fleetSummary.state}
                    detail={
                        ops.data
                            ? `${fleetSummary.lanes} lanes · ${fleetSummary.stalled} stalled · ${fleetSummary.paused} paused`
                            : undefined
                    }
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <AttentionPreview
                    items={attentionItems}
                    isLoading={attention.isLoading}
                    isError={attention.isError}
                    onRetry={() => attention.refetch()}
                />
                <ContentFlowPanel
                    counts={statusCounts.data}
                    countsLoading={statusCounts.isLoading}
                    sourcesTotal={sources.data?.total}
                    sourcesLoading={sources.isLoading}
                    storage={storage.data}
                    storageLoading={storage.isLoading}
                    daily={contentStats.data?.daily}
                />
            </div>

            {isAggregationConfigured() ? <AggregationHealthPanel /> : null}
        </div>
    );
}
