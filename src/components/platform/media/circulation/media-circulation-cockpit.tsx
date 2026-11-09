'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type {
    MediaCirculationCockpit,
    MediaCirculationCockpitRecommendation,
    MediaCirculationOverride,
    MediaCirculationOverrideRequest,
    MediaCirculationPolicy,
    MediaSupplyEpisodeListResponse,
    MediaSupplyStatusResponse,
    MediaSourceDiversity,
} from '@/types/platform/media-circulation';
import { AutopilotStrip } from './autopilot-strip';
import { CockpitHero } from './cockpit-hero';
import { DeliveryProof } from './delivery-proof';
import { DecisionQueue, recommendationMatchesTab, QUEUE_TABS, type QueueTab } from './decision-queue';
import { Inspector } from './inspector';
import { OverrideManager } from './override-manager';
import { SettingsForm } from './settings-form';
import { SourceRunTraceSheet } from './source-run-trace-sheet';
import { SourceScheduleProof } from './source-schedule-proof';
import { SupplyContinuityPanel } from './supply-continuity-panel';
import { SourceDiversityPanel } from './source-diversity-panel';

interface MediaCirculationCockpitProps {
    cockpit?: MediaCirculationCockpit;
    overrides: MediaCirculationOverride[];
    loading: boolean;
    fetching: boolean;
    generating: boolean;
    acting: boolean;
    savingPolicy: boolean;
    onGenerate: () => void;
    onApply: (id: string) => void;
    onDismiss: (id: string) => void;
    onRevert: (id: string) => void;
    onSavePolicy: (data: Partial<MediaCirculationPolicy>) => void;
    onCreateOverride: (data: MediaCirculationOverrideRequest) => void;
    onDeleteOverride: (id: string) => void;
    supply?: MediaSupplyStatusResponse;
    supplyEpisodes?: MediaSupplyEpisodeListResponse;
    supplyLoading: boolean;
    supplyError?: Error | null;
    supplyEpisodesError?: Error | null;
    diversity?: MediaSourceDiversity;
    diversityLoading: boolean;
    diversityError: boolean;
}

function metricString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function metricArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

function matchesBucket(rec: MediaCirculationCockpitRecommendation, bucket: string): boolean {
    if (bucket === 'all') return true;
    return metricArray(rec.metrics?.matched_thin_buckets).includes(bucket) || metricString(rec.metrics?.duration_bucket) === bucket;
}

function matchesQuery(rec: MediaCirculationCockpitRecommendation, q: string): boolean {
    if (!q) return true;
    return [rec.display_title, rec.display_subtitle, rec.verdict, rec.status, rec.priority_label, ...(rec.proof_points ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q);
}

export function MediaCirculationCockpitView({
    cockpit,
    overrides,
    loading,
    fetching,
    generating,
    acting,
    savingPolicy,
    onGenerate,
    onApply,
    onDismiss,
    onRevert,
    onSavePolicy,
    onCreateOverride,
    onDeleteOverride,
    supply,
    supplyEpisodes,
    supplyLoading,
    supplyError,
    supplyEpisodesError,
    diversity,
    diversityLoading,
    diversityError,
}: MediaCirculationCockpitProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tab = (searchParams.get('tab') || 'attention') as QueueTab;
    const query = searchParams.get('q') || '';
    const bucket = searchParams.get('bucket') || 'all';
    const historyStatus = searchParams.get('hs') || 'all';
    const selectedID = searchParams.get('selected') || '';
    const detailsOpen = searchParams.get('details') === '1';
    const policyOpen = searchParams.get('policy') === '1';
    const traceRequestID = searchParams.get('trace');

    const setParams = (changes: Record<string, string | undefined>) => {
        const next = new URLSearchParams(Array.from(searchParams.entries()));
        Object.entries(changes).forEach(([key, value]) => {
            const isDefault = !value || (key === 'tab' && value === 'attention') || ((key === 'bucket' || key === 'hs') && value === 'all');
            if (isDefault) next.delete(key);
            else next.set(key, value);
        });
        router.replace(`/platform/media/circulation?${next.toString()}`, {
            scroll: false,
        });
    };

    const tabCounts = useMemo(() => {
        const counts = Object.fromEntries(QUEUE_TABS.map(({ value }) => [value, 0])) as Record<QueueTab, number>;
        (cockpit?.recommendations ?? []).forEach((rec) => {
            QUEUE_TABS.forEach(({ value }) => {
                if (recommendationMatchesTab(rec, value)) counts[value] += 1;
            });
        });
        return counts;
    }, [cockpit]);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = (cockpit?.recommendations ?? []).filter((rec) => {
            if (!recommendationMatchesTab(rec, tab)) return false;
            if (tab === 'history' && historyStatus !== 'all' && rec.status !== historyStatus) return false;
            if (!matchesBucket(rec, bucket)) return false;
            return matchesQuery(rec, q);
        });
        if (tab !== 'history') {
            return [...filtered].sort((a, b) => b.score - a.score);
        }
        return filtered;
    }, [bucket, cockpit, historyStatus, query, tab]);

    const selected = useMemo(() => {
        if (!cockpit?.recommendations.length) return undefined;
        return cockpit.recommendations.find((r) => r.id === selectedID) ?? rows[0];
    }, [cockpit, rows, selectedID]);

    if (loading) return <CockpitSkeleton />;

    if (!cockpit) {
        return (
            <div className="space-y-4">
                <SupplyContinuityPanel
                    status={supply}
                    episodes={supplyEpisodes}
                    loading={supplyLoading}
                    statusError={supplyError}
                    episodesError={supplyEpisodesError}
                    onInspectRequest={(requestID) => setParams({ trace: requestID })}
                />
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                    <h2 className="text-lg font-semibold">Media circulation is unavailable</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        The economics cockpit could not load. Supply evidence above remains independently CMS-owned.
                    </p>
                </div>
            </div>
        );
    }

    const toggleEngine = (enabled: boolean) => onSavePolicy({ ...cockpit.policy, enabled });

    return (
        <div className="space-y-4">
            <CockpitHero
                cockpit={cockpit}
                fetching={fetching}
                generating={generating}
                savingPolicy={savingPolicy}
                activeBucket={bucket}
                onBucket={(value) => setParams({ bucket: value })}
                onGenerate={onGenerate}
                onToggleEngine={toggleEngine}
                onOpenPolicy={() => setParams({ policy: '1' })}
            />

            <SupplyContinuityPanel
                status={supply}
                episodes={supplyEpisodes}
                loading={supplyLoading}
                statusError={supplyError}
                episodesError={supplyEpisodesError}
                onInspectRequest={(requestID) => setParams({ trace: requestID })}
            />

            {cockpit.autopilot ? (
                <AutopilotStrip autopilot={cockpit.autopilot} policy={cockpit.policy} savingPolicy={savingPolicy} onSavePolicy={onSavePolicy} />
            ) : null}

            <DeliveryProof proof={cockpit.delivery} onInspect={(requestID) => setParams({ trace: requestID })} />

            <SourceScheduleProof proof={cockpit.schedules} onInspect={(requestID) => setParams({ trace: requestID })} />

            <SourceDiversityPanel data={diversity} isLoading={diversityLoading} isError={diversityError} />

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <DecisionQueue
                    rows={rows}
                    tabCounts={tabCounts}
                    tab={tab}
                    query={query}
                    historyStatus={historyStatus}
                    activeBucket={bucket}
                    selectedID={selected?.id}
                    engineEnabled={cockpit.health.enabled}
                    acting={acting}
                    onTab={(value) => setParams({ tab: value, selected: undefined })}
                    onQuery={(value) => setParams({ q: value })}
                    onHistoryStatus={(value) => setParams({ hs: value })}
                    onClearBucket={() => setParams({ bucket: 'all' })}
                    onSelect={(id, openDetails) =>
                        setParams({
                            selected: id,
                            details: openDetails ? '1' : undefined,
                        })
                    }
                    onApply={onApply}
                    onDismiss={onDismiss}
                    onRevert={onRevert}
                    onGenerate={onGenerate}
                    onToggleEngine={() => toggleEngine(true)}
                />

                <aside className="hidden xl:sticky xl:top-6 xl:block">
                    <Inspector
                        rec={selected}
                        engineEnabled={cockpit.health.enabled}
                        acting={acting}
                        onApply={onApply}
                        onDismiss={onDismiss}
                        onRevert={onRevert}
                    />
                </aside>
            </div>

            {/* Mobile / narrow: proof opens as a bottom sheet */}
            <Sheet open={detailsOpen && Boolean(selected)} onOpenChange={(open) => setParams({ details: open ? '1' : undefined })}>
                <SheetContent side="bottom" className="max-h-[86vh] overflow-y-auto p-4 xl:hidden">
                    <SheetHeader className="mb-3 text-left">
                        <SheetTitle>Recommendation proof</SheetTitle>
                    </SheetHeader>
                    <Inspector
                        rec={selected}
                        engineEnabled={cockpit.health.enabled}
                        acting={acting}
                        onApply={onApply}
                        onDismiss={onDismiss}
                        onRevert={onRevert}
                    />
                </SheetContent>
            </Sheet>

            <Sheet open={policyOpen} onOpenChange={(open) => setParams({ policy: open ? '1' : undefined })}>
                <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-xl">
                    <SheetHeader className="mb-5 text-left">
                        <SheetTitle>Circulation policy</SheetTitle>
                    </SheetHeader>
                    <SettingsForm policy={cockpit.policy} saving={savingPolicy} onSave={onSavePolicy} />
                    <OverrideManager overrides={overrides} acting={acting} onCreate={onCreateOverride} onDelete={onDeleteOverride} />
                </SheetContent>
            </Sheet>

            <SourceRunTraceSheet
                requestID={traceRequestID}
                onOpenChange={(open) =>
                    setParams({
                        trace: open ? (traceRequestID ?? undefined) : undefined,
                    })
                }
            />
        </div>
    );
}

function CockpitSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Skeleton className="h-[540px] rounded-xl" />
                <Skeleton className="hidden h-[420px] rounded-xl xl:block" />
            </div>
        </div>
    );
}
