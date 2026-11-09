'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/lib/console-link';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import {
    AlertCircle,
    AudioLines,
    Check,
    ExternalLink,
    FileSearch,
    Gauge,
    Loader2,
    PanelRightOpen,
    Plus,
    Radar,
    RefreshCw,
    Settings2,
    SlidersHorizontal,
    Upload,
    Video,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaFindingPage, MediaSettings, YouTubeImportPanel } from '@/components/platform/media/finding/media-finding-page';
import { MediaOutputChart } from '@/components/platform/media/sources/media-output-chart';
import { MediaSourcesSummary } from '@/components/platform/media/sources/media-sources-summary';
import { PodsPipelineControl } from '@/components/platform/media/pods-pipeline-control';
import { MediaAcquisitionSettingsCard } from '@/components/platform/media/media-acquisition-settings-card';
import { MediaSourcesManager } from '@/components/platform/sources/manage/media-sources-manager';
import { useAllSources, useSourceStats, sourceKeys } from '@/hooks/use-sources';
import { useApproveSuggestion, useMediaSourcesContext, useRejectSuggestion } from '@/hooks/use-discovery';
import { isMediaSource } from '@/lib/sources/media';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';
import type {
    MediaSourcesContext,
    MediaSourceApprovalHandoff,
    NewsSource,
    SourceSuggestion,
    SuggestionRelationship,
} from '@/types/platform/discovery';

const RETURN_TO = '/platform/media/sources';
const TABS = ['overview', 'finding', 'sources', 'import', 'policy', 'diagnostics'] as const;
type MediaSourcesTab = (typeof TABS)[number];

function readTab(raw: string | null): MediaSourcesTab {
    return TABS.includes(raw as MediaSourcesTab) ? (raw as MediaSourcesTab) : 'overview';
}

function scoreOf(suggestion?: SourceSuggestion) {
    if (!suggestion) return null;
    return suggestion.relevance_score ?? suggestion.confidence ?? null;
}

export default function MediaSourcesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const [bulkBusy, setBulkBusy] = useState(false);

    const tab = readTab(searchParams.get('tab'));
    const selectedProfile = searchParams.get('profile');
    const selectedSource = searchParams.get('source');
    const selectedSuggestion = searchParams.get('suggestion');

    const context = useMediaSourcesContext({
        profile: selectedProfile,
        source: selectedSource,
        suggestion: selectedSuggestion,
    });
    const fleet = useAllSources({ paused: bulkBusy });
    const stats = useSourceStats({ category: 'media' });
    const sources = useMemo(() => (fleet.data ?? []).filter(isMediaSource), [fleet.data]);
    const outputByName = useMemo(() => {
        const map = new Map<string, { items: number; failed: number }>();
        for (const s of stats.data?.top_sources ?? context.data?.source_stats.top_sources ?? []) {
            map.set(s.name, { items: s.items, failed: s.failed });
        }
        return map;
    }, [stats.data, context.data]);
    const sourceContextById = useMemo(() => {
        const map = new Map<string, NewsSource>();
        for (const source of context.data?.sources ?? []) map.set(source.id, source);
        return map;
    }, [context.data]);
    const profileNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const profile of context.data?.profiles ?? []) map.set(profile.id, profile.name);
        return map;
    }, [context.data]);

    const setTab = (next: MediaSourcesTab) => {
        const params = new URLSearchParams(searchParams);
        if (next === 'overview') params.delete('tab');
        else params.set('tab', next);
        router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
    };

    const selectSource = (id: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', 'sources');
        params.set('source', id);
        params.delete('suggestion');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const hasInvalidSelection =
            (selectedProfile && context.data && !context.data.selected_profile) ||
            (selectedSuggestion && context.data && !context.data.selected_suggestion) ||
            (selectedSource && context.data && !context.data.selected_source);
        if (!hasInvalidSelection) return;
        const params = new URLSearchParams(searchParams);
        params.delete('profile');
        params.delete('suggestion');
        params.delete('source');
        params.delete('tab');
        router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
    }, [context.data, pathname, router, searchParams, selectedProfile, selectedSource, selectedSuggestion]);

    const isRefreshing = fleet.isFetching || stats.isFetching || context.isFetching;
    const lastUpdated = context.dataUpdatedAt ? new Date(context.dataUpdatedAt) : null;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                    <span className="brand-overline text-gold">Pods supply</span>
                    <h1 className="text-3xl font-bold tracking-tight">Media Sources</h1>
                    <p className="text-sm text-muted-foreground">
                        Discover audio-first channels, approve candidates, and manage the live source roster feeding Pods.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/platform/media/sources/new">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add source
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: sourceKeys.all });
                            context.refetch();
                        }}
                        disabled={isRefreshing}
                        aria-label="Refresh media sources"
                    >
                        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin motion-reduce:animate-none')} />
                    </Button>
                </div>
            </div>

            <PodsPipelineControl />

            {context.isError && !context.data ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <AlertCircle className="h-7 w-7 text-destructive" />
                        <p className="text-sm text-muted-foreground">Couldn&apos;t load the media source context.</p>
                        <Button variant="outline" size="sm" onClick={() => context.refetch()} className="gap-1">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <SourceSignalSpine context={context.data} isLoading={context.isLoading} lastUpdated={lastUpdated} />
                    <ApprovalHandoffStrip approvals={context.data?.recent_approvals ?? []} />

                    <Tabs value={tab} onValueChange={(value) => setTab(value as MediaSourcesTab)} className="space-y-4">
                        <TabsList className="flex h-auto flex-wrap justify-start">
                            <TabsTrigger value="overview" className="gap-1.5"><Gauge className="h-3.5 w-3.5" />Overview</TabsTrigger>
                            <TabsTrigger value="finding" className="gap-1.5"><Radar className="h-3.5 w-3.5" />Finding</TabsTrigger>
                            <TabsTrigger value="sources" className="gap-1.5"><Video className="h-3.5 w-3.5" />Sources</TabsTrigger>
                            <TabsTrigger value="import" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Import</TabsTrigger>
                            <TabsTrigger value="policy" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Policy</TabsTrigger>
                            <TabsTrigger value="diagnostics" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Diagnostics</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-5">
                            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                                <MediaSourcesSummary sources={sources} isLoading={fleet.isLoading} />
                                <MediaOutputChart stats={stats.data ?? context.data?.source_stats} isLoading={stats.isLoading && !context.data} />
                            </div>
                            <SourceSupplyMap context={context.data} />
                        </TabsContent>

                        <TabsContent value="finding" className="space-y-5">
                            <MediaFindingPage
                                embedded
                                relationships={context.data?.suggestion_relationships}
                                intelligence={<SourceIntelligencePanel context={context.data} />}
                            />
                        </TabsContent>

                        <TabsContent value="sources" className="space-y-5">
                            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                                <MediaSourcesSummary sources={sources} isLoading={fleet.isLoading} />
                                <MediaOutputChart stats={stats.data ?? context.data?.source_stats} isLoading={stats.isLoading && !context.data} />
                            </div>
                            <MediaSourcesManager
                                sources={sources}
                                outputByName={outputByName}
                                isLoading={fleet.isLoading}
                                onBusyChange={setBulkBusy}
                                refetch={fleet.refetch}
                                returnTo={RETURN_TO}
                                selectedSourceId={selectedSource}
                                onSelectSource={selectSource}
                                sourceContextById={sourceContextById}
                                profileNameById={profileNameById}
                            />
                        </TabsContent>

                        <TabsContent value="import" className="max-w-4xl">
                            <YouTubeImportPanel
                                profiles={context.data?.profiles ?? []}
                                defaultProfileId={selectedProfile ?? context.data?.profiles[0]?.id ?? ''}
                                onDone={() => setTab('finding')}
                            />
                        </TabsContent>

                        <TabsContent value="policy" forceMount hidden={tab !== 'policy'} className="space-y-5 data-[state=inactive]:hidden">
                            <MediaAcquisitionSettingsCard />
                            {context.data?.config ? (
                                <MediaSettings config={context.data.config} />
                            ) : (
                                <Card><CardContent className="py-10 text-sm text-muted-foreground">Loading discovery policy…</CardContent></Card>
                            )}
                        </TabsContent>

                        <TabsContent value="diagnostics" className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                            <DiagnosticsPanel context={context.data} isLoading={context.isLoading} />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}

function SourceSignalSpine({
    context,
    isLoading,
    lastUpdated,
}: {
    context?: MediaSourcesContext;
    isLoading: boolean;
    lastUpdated: Date | null;
}) {
    const r = context?.rollups;
    const max = Math.max(r?.pending ?? 0, r?.active ?? 0, r?.healthy ?? 0, r?.stale ?? 0, 1);
    const rows = [
        { label: 'Pending', value: r?.pending ?? 0, color: 'bg-[#13B5C8]', hint: `${r?.imported ?? 0} imported` },
        { label: 'Approved roster', value: r?.active ?? 0, color: 'bg-[#DAA428]', hint: `${r?.healthy ?? 0} healthy` },
        { label: 'Needs attention', value: (r?.stale ?? 0) + (r?.never_run ?? 0) + (r?.failed ?? 0), color: 'bg-[#EF4444]', hint: `${r?.failed ?? 0} failing` },
        { label: 'Audio fit risk', value: (r?.non_audio_first ?? 0) + (r?.no_transcript ?? 0), color: 'bg-[#11100D] dark:bg-[#FCFCFB]', hint: `${r?.needs_trimming ?? 0} need trims` },
    ];

    return (
        <Card className="overflow-hidden border-[#11100D]/15 dark:border-[#FCFCFB]/15">
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[220px_1fr_auto] lg:items-center">
                <div>
                    <p className="brand-overline text-gold">Source signal spine</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Discovery candidates, approved channels, and production health in one line of sight.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {rows.map((row) => (
                        <div key={row.label} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium">{row.label}</span>
                                <span className="font-mono tabular-nums">{isLoading && !context ? '…' : formatNumber(row.value)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div className={cn('h-full rounded-full', row.color)} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                        </div>
                    ))}
                </div>
                <div className="text-xs text-muted-foreground lg:text-right">
                    <Badge variant={context ? 'success' : 'secondary'}>{context ? 'Live snapshot' : 'Loading'}</Badge>
                    <p className="mt-1">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for data'}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function SourceSupplyMap({ context }: { context?: MediaSourcesContext }) {
    const r = context?.rollups;
    const facts = [
        { label: 'Interests', value: context?.profiles.length ?? 0, icon: Radar },
        { label: 'Pending candidates', value: r?.pending ?? 0, icon: AudioLines },
        { label: 'Approved sources', value: r?.active ?? 0, icon: Check },
        { label: 'Stale or never run', value: (r?.stale ?? 0) + (r?.never_run ?? 0), icon: AlertCircle },
    ];
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Signal map</CardTitle>
                <p className="text-xs text-muted-foreground">The route from discovery intent to live Pods supply.</p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {facts.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                            <Icon className="h-4 w-4 text-gold" />
                            <span className="font-mono text-lg tabular-nums">{formatNumber(value)}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function ApprovalHandoffStrip({ approvals }: { approvals: MediaSourceApprovalHandoff[] }) {
    if (approvals.length === 0) return null;
    const steps: { key: MediaSourceApprovalHandoff['status']; label: string }[] = [
        { key: 'approved', label: 'Approved' },
        { key: 'first_fetch_queued', label: 'First fetch queued' },
        { key: 'waiting_for_items', label: 'Waiting for first items' },
        { key: 'producing', label: 'Producing' },
        { key: 'needs_attention', label: 'Needs attention' },
    ];
    const newest = approvals.slice(0, 4);

    return (
        <Card className="border-[#13B5C8]/25">
            <CardContent className="grid gap-4 p-4 xl:grid-cols-[220px_1fr]">
                <div>
                    <p className="brand-overline text-gold">Approval handoff</p>
                    <p className="mt-1 text-sm text-muted-foreground">Recently approved candidates stay visible while they become producing sources.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {newest.map((approval) => {
                        const activeIndex = steps.findIndex((step) => step.key === approval.status);
                        return (
                            <div key={approval.suggestion_id} className="rounded-md border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium" dir="auto">{approval.source_name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {approval.profile_name ? `from ${approval.profile_name}` : 'from discovery'}
                                        </p>
                                    </div>
                                    <Badge variant={approval.status === 'needs_attention' ? 'destructive' : approval.status === 'producing' ? 'success' : 'secondary'}>
                                        {steps[activeIndex]?.label ?? 'Approved'}
                                    </Badge>
                                </div>
                                <div className="mt-3 grid grid-cols-5 gap-1">
                                    {steps.map((step, index) => (
                                        <span
                                            key={step.key}
                                            className={cn(
                                                'h-1.5 rounded-full',
                                                index <= activeIndex ? 'bg-[#13B5C8]' : 'bg-muted',
                                                approval.status === 'needs_attention' && index === activeIndex && 'bg-[#EF4444]',
                                            )}
                                            title={step.label}
                                        />
                                    ))}
                                </div>
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                    {formatNumber(approval.items_count)} items · {formatNumber(approval.failed)} failed
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function relationshipBadge(relationship?: SuggestionRelationship): {
    label: string;
    variant: 'secondary' | 'warning' | 'destructive' | 'success' | 'info';
} {
    if (!relationship || relationship.relationship === 'new') return { label: 'New candidate', variant: 'secondary' };
    if (relationship.relationship === 'duplicate') return { label: 'Duplicate source', variant: 'destructive' };
    if (relationship.relationship === 'already_approved') return { label: 'Already approved', variant: 'success' };
    if (relationship.relationship === 'improves_existing') return { label: 'Improves existing', variant: 'info' };
    return { label: 'Similar source', variant: 'warning' };
}

const RELATIONSHIP_REASON_LABELS: Record<string, string> = {
    same_feed_url: 'Same feed URL',
    same_normalized_name: 'Same creator/name',
    same_site_url: 'Same site URL',
    same_interest_profile: 'Same interest',
    approved_source: 'Approved source link',
    stronger_audio_evidence: 'Stronger audio signal',
    transcript_available: 'Transcript available',
    richer_sample_items: 'Richer samples',
    existing_source_disabled: 'Existing source disabled',
    existing_source_failed: 'Existing source failed',
    existing_source_stale: 'Existing source stale',
};

function relationReasonLabel(reason: string) {
    return RELATIONSHIP_REASON_LABELS[reason] ?? reason.replaceAll('_', ' ');
}

function matchedProfileKeywords(suggestion: SourceSuggestion, context?: MediaSourcesContext) {
    const profile = suggestion.profile_id
        ? context?.profiles.find((p) => p.id === suggestion.profile_id)
        : context?.selected_profile;
    if (!profile) return [];
    const haystack = [
        suggestion.name,
        suggestion.health?.bio,
        ...(suggestion.sample_items ?? []).map((item) => item.title),
    ].filter(Boolean).join(' ').toLowerCase();
    return profile.keywords
        .filter((keyword) => keyword.trim().length > 1 && haystack.includes(keyword.trim().toLowerCase()))
        .slice(0, 6);
}

function compactNumber(value?: number) {
    if (!value || value <= 0) return '—';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
    return String(value);
}

function captionLabel(state?: string) {
    if (state === 'youtube_human') return 'Human captions';
    if (state === 'youtube_auto') return 'Auto-captions';
    if (state === 'stt_done') return 'STT transcript';
    if (state === 'none') return 'No transcript';
    return 'Unknown';
}

function formatDuration(seconds?: number) {
    if (!seconds || seconds <= 0) return '—';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function SourceIntelligencePanel({ context }: { context?: MediaSourcesContext }) {
    const suggestion = context?.selected_suggestion;
    const source = context?.selected_source;
    const profile = context?.selected_profile;
    const hasSelection = Boolean(suggestion || source || profile);
    const renderContent = () => <SourceIntelligenceContent context={context} />;

    return (
        <>
            <Card className="hidden h-fit border-[#13B5C8]/25 lg:block">
                {renderContent()}
            </Card>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2 lg:hidden" disabled={!hasSelection}>
                        <PanelRightOpen className="h-4 w-4" />
                        {hasSelection ? 'Open selection details' : 'Select an interest or candidate'}
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Selection details</SheetTitle>
                    </SheetHeader>
                    <div className="pt-4">{renderContent()}</div>
                </SheetContent>
            </Sheet>
        </>
    );
}

function SourceIntelligenceContent({ context }: { context?: MediaSourcesContext }) {
    const suggestion = context?.selected_suggestion;
    const source = context?.selected_source;
    const profile = context?.selected_profile;
    const selectedScore = scoreOf(suggestion);
    const relationship = suggestion ? context?.suggestion_relationships?.[suggestion.id] : undefined;
    const relation = relationshipBadge(relationship);
    const approve = useApproveSuggestion();
    const reject = useRejectSuggestion();
    const approveBlocked = relationship?.relationship === 'duplicate' || relationship?.relationship === 'already_approved';
    const profileName = source?.discovery_profile_id
        ? context?.profiles.find((p) => p.id === source.discovery_profile_id)?.name
        : undefined;
    const sourceRecentItems = context?.selected_source_recent_items ?? [];
    const matchedKeywords = suggestion ? matchedProfileKeywords(suggestion, context) : [];
    const graphLinks = (suggestion?.evidence?.cocitation_count ?? 0) || (suggestion?.evidence?.citation_count ?? 0);
    const subscriberCount = suggestion?.evidence?.subscribers ?? suggestion?.health?.subscribers;
    const episodeCount = suggestion?.health?.episode_count;
    const captionState = suggestion?.evidence?.caption_state;
    const risks = suggestion
        ? ([
            suggestion.health?.audio_first === false ? 'Visual-first' : null,
            captionState === 'none' ? 'No transcript' : null,
            suggestion.evidence?.needs_chaptering ? 'Needs trimming' : null,
        ].filter(Boolean) as string[])
        : [];
    const panelTitle = suggestion ? 'Candidate proof' : source ? 'Source health' : profile ? 'Interest brief' : 'Selection details';
    const panelCopy = suggestion
        ? 'Relationship, evidence, and approval preview for the selected candidate.'
        : source
          ? 'Production health and recent output for the selected source.'
          : profile
            ? 'Discovery scope and run limits for the selected interest.'
            : 'Pick an interest or candidate to show its evidence here.';

    return (
        <>
            <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#13B5C8]" />
                    <CardTitle className="text-base">{panelTitle}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">{panelCopy}</p>
            </CardHeader>
            <CardContent className="space-y-5">
                {!suggestion && !source && !profile && (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        The detail bench follows your selection from the interests list and candidate cards.
                    </div>
                )}
                {profile && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Interest</p>
                        <p className="font-semibold" dir="auto">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile.keywords.join(', ') || 'No keywords'}</p>
                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs lg:grid-cols-1">
                            <span className="rounded-md border p-2"><b className="block font-mono">{profile.max_suggestions_per_run}</b>max/run</span>
                            <span className="rounded-md border p-2"><b className="block font-mono">{profile.languages.length || 'all'}</b>languages</span>
                        </div>
                    </div>
                )}
                {suggestion && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">Candidate</p>
                            <p className="font-semibold" dir="auto">{suggestion.health?.bio || suggestion.name}</p>
                            <p className="truncate text-xs text-muted-foreground" dir="ltr">{suggestion.feed_url}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{suggestion.type}</Badge>
                            {selectedScore !== null && <Badge variant="secondary">score {(selectedScore * 100).toFixed(0)}%</Badge>}
                            {suggestion.discovered_via === 'youtube-import' && <Badge variant="warning">imported</Badge>}
                            <Badge variant={relation.variant}>{relation.label}</Badge>
                            {suggestion.health?.audio_first === false && <Badge variant="destructive">visual-first</Badge>}
                            {suggestion.health?.audio_first === true && <Badge variant="success">audio-first</Badge>}
                            {suggestion.evidence?.caption_state && <Badge variant="outline">{suggestion.evidence.caption_state.replace('_', ' ')}</Badge>}
                        </div>
                        <div className="rounded-md border border-[#13B5C8]/30 bg-[#13B5C8]/5 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={relation.variant}>{relation.label}</Badge>
                                {relationship?.matched_source_name && <span className="font-medium">Matched to {relationship.matched_source_name}</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {(relationship?.reasons?.length ? relationship.reasons : ['new_candidate']).map((reason) => (
                                    <Badge key={reason} variant="outline" className="font-normal">
                                        {reason === 'new_candidate' ? 'No existing source match' : relationReasonLabel(reason)}
                                    </Badge>
                                ))}
                            </div>
                            {relationship?.matched_source_id && (
                                <Button asChild size="sm" variant="outline" className="mt-3">
                                    <Link href={`/platform/media/sources?tab=sources&source=${relationship.matched_source_id}`}>
                                        Open existing source
                                    </Link>
                                </Button>
                            )}
                        </div>
                        <div className="space-y-3 rounded-md border p-3">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Why this source?</p>
                            <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-1">
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">{matchedKeywords.length ? matchedKeywords.join(', ') : 'No exact keyword hit'}</b>
                                    matched keywords
                                </span>
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">{graphLinks ? formatNumber(graphLinks) : '—'}</b>
                                    linked by sources
                                </span>
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">{compactNumber(subscriberCount)}</b>
                                    subscribers
                                </span>
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">{episodeCount ?? '—'}</b>
                                    episodes
                                </span>
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">{captionLabel(captionState)}</b>
                                    transcript
                                </span>
                                <span className="rounded-md bg-muted/60 p-2">
                                    <b className="block text-foreground">
                                        {suggestion.health?.audio_first === true ? 'High' : suggestion.health?.audio_first === false ? 'Low' : 'Unknown'}
                                    </b>
                                    audio-first confidence
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {risks.length ? (
                                    risks.map((risk) => <Badge key={risk} variant="warning">{risk}</Badge>)
                                ) : (
                                    <Badge variant="success">No major review risks</Badge>
                                )}
                            </div>
                        </div>
                        {suggestion.sample_items?.length ? (
                            <div className="space-y-2">
                                <p className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                                    <FileSearch className="h-3.5 w-3.5" /> Sample items
                                </p>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    {suggestion.sample_items.slice(0, 3).map((item, index) => (
                                        <li key={`${item.title}-${index}`} className="truncate" dir="auto">{item.title}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {context?.approval_preview && (
                            <div className="space-y-2 rounded-md border p-3">
                                <p className="text-xs font-medium uppercase text-muted-foreground">Approval preview</p>
                                <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-1">
                                    <span><b className="block text-foreground">{context.approval_preview.source_type}</b>type</span>
                                    <span><b className="block text-foreground">{context.approval_preview.attached_profile_name ?? 'None'}</b>interest</span>
                                    <span><b className="block text-foreground">{context.approval_preview.initial_episode_cap || 'All'}</b>episode cap</span>
                                    <span><b className="block text-foreground">{context.approval_preview.fetch_interval_minutes}m</b>fetch interval</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    First fetch queues immediately; approved media defaults to contextual chaptering with audio-only fallback allowed.
                                </p>
                            </div>
                        )}
                        <div className="grid gap-2">
                            {approveBlocked && relationship?.matched_source_id ? (
                                <Button asChild>
                                    <Link href={`/platform/media/sources?tab=sources&source=${relationship.matched_source_id}`}>
                                        Open existing source
                                    </Link>
                                </Button>
                            ) : (
                                <Button disabled={approve.isPending || approveBlocked} onClick={() => approve.mutate(suggestion.id)}>
                                    {approve.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                                    Approve source
                                </Button>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" asChild>
                                    <a href={suggestion.feed_url} target="_blank" rel="noreferrer">
                                        <ExternalLink className="mr-1.5 h-4 w-4" /> Open feed
                                    </a>
                                </Button>
                                <Button variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate({ id: suggestion.id })}>
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {source && (
                    <div className="space-y-4">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Live source</p>
                        <div>
                            <p className="font-semibold" dir="auto">{source.name}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <Badge variant={source.is_active ? 'success' : 'secondary'}>{source.is_active ? 'active' : 'disabled'}</Badge>
                                <Badge variant="outline">{source.type}</Badge>
                                {source.discovery_profile_id && <Badge variant="secondary">from discovery{profileName ? ` · ${profileName}` : ''}</Badge>}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs lg:grid-cols-1">
                            <span className="rounded-md border p-2"><b className="block font-mono">{formatNumber(source.items_count)}</b>items</span>
                            <span className="rounded-md border p-2"><b className="block font-mono">{formatNumber(source.ready)}</b>ready</span>
                            <span className="rounded-md border p-2"><b className="block font-mono">{formatNumber(source.failed)}</b>failed</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-1">
                            <span className="rounded-md border p-2"><b className="block">{source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleString() : 'Never'}</b>last fetch</span>
                            <span className="rounded-md border p-2"><b className="block">{source.fetch_interval_minutes}m</b>cadence</span>
                        </div>
                        <div className="space-y-2 rounded-md border p-3">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Recent output</p>
                            {sourceRecentItems.length ? (
                                <div className="space-y-2">
                                    {sourceRecentItems.map((item) => (
                                        <div key={item.id} className="rounded-md bg-muted/50 p-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="line-clamp-2 text-xs font-medium" dir="auto">{item.title || 'Untitled media item'}</p>
                                                <Badge variant={item.status === 'READY' ? 'success' : item.status === 'FAILED' ? 'destructive' : 'secondary'}>
                                                    {item.status.toLowerCase()}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                                <span>{formatDuration(item.duration_sec)}</span>
                                                {item.caption_state && <span>{captionLabel(item.caption_state)}</span>}
                                                {item.chaptering_status && <span>{item.chaptering_status.replaceAll('_', ' ')}</span>}
                                                <span>{item.feed_visibility.replaceAll('_', ' ')}</span>
                                                {item.published_at && <span>{new Date(item.published_at).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                    No recent media items matched this source yet.
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button asChild size="sm" variant="outline">
                                <Link href={`/platform/sources/${source.id}?from=${encodeURIComponent('/platform/media/sources')}`}>
                                    Edit source
                                </Link>
                            </Button>
                            {source.feed_url && (
                                <Button asChild size="sm" variant="ghost">
                                    <a href={source.feed_url} target="_blank" rel="noreferrer">
                                        <ExternalLink className="mr-1.5 h-4 w-4" /> Open feed
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </>
    );
}

function DiagnosticsPanel({ context, isLoading }: { context?: MediaSourcesContext; isLoading: boolean }) {
    const stats = context?.source_stats;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Diagnostics</CardTitle>
                <p className="text-xs text-muted-foreground">Schema readiness, health buckets, and attention sources.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && !context ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading diagnostics…
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(context?.schema_status ?? {}).map(([key, ok]) => (
                                <Badge key={key} variant={ok ? 'success' : 'destructive'}>{key}</Badge>
                            ))}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(stats?.by_health ?? {}).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                    <span className="capitalize text-muted-foreground">{key.replace('_', ' ')}</span>
                                    <span className="font-mono tabular-nums">{formatNumber(value)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Attention queue</p>
                            {(stats?.recent_failures ?? []).length === 0 ? (
                                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No stale media sources in the current snapshot.</p>
                            ) : (
                                stats?.recent_failures.map((source) => (
                                    <div key={source.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                        <span className="truncate" dir="auto">{source.name}</span>
                                        <Badge variant="warning">{source.health.replace('_', ' ')}</Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
