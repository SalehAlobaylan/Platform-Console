'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    Clock3,
    ExternalLink,
    Eye,
    Filter,
    Loader2,
    Play,
    RefreshCw,
    Search,
    Scissors,
    ShieldCheck,
    SlidersHorizontal,
    Radio,
    Waves,
    X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MediaStudioWorkbench } from '@/components/platform/media/studio/media-studio-workbench';
import { StudioAutopilotPanel } from '@/components/platform/media/studio/studio-autopilot-panel';
import { MediaJourneyGuide, MediaJourneyList, EpisodeJourney, useJourneyLocale } from '@/components/platform/media/studio/media-journey';
import { PublishedJourney } from '@/components/platform/media/studio/published-journey';
import { JourneyActions } from '@/components/platform/media/studio/journey-actions';
import { EpisodeContextTab } from '@/components/platform/media/studio/episode-context-tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useApproveAtomizedChapter,
    useAtomizeMediaParent,
    useMediaAtomizationFeedUnits,
    useMediaAtomizationPolicy,
    useMediaAtomizationChapters,
    useMediaAtomizationOverview,
    useMediaAtomizationParentContext,
    useMediaAtomizationParents,
    useMediaAtomizationPipeline,
    useMediaAtomizationRuns,
    useMediaAtomizationSources,
    useReatomizeMediaParent,
    useRepairMediaAtomizationLeaks,
    useRejectAtomizedChapter,
    useRunMediaAtomizationSweep,
    useUpdateMediaAtomizationParentOverride,
    useUpdateMediaAtomizationPolicy,
    useUpdateMediaAtomizationSourcePolicy,
} from '@/hooks/use-media-atomization';
import { useTriggerStt } from '@/hooks/use-transcription';
import { useRequestMediaAcquisition } from '@/hooks/use-media-acquisition';
import { cn } from '@/lib/utils';
import { getMediaAtomizationPipeline } from '@/lib/api/cms/media-atomization';
import type {
    AtomizationFilters,
    MediaAtomizationChapter,
    MediaAtomizationFeedUnit,
    MediaAtomizationOverview,
    MediaAtomizationParent,
    MediaAtomizationParentContext,
    MediaAtomizationPipeline,
    MediaAtomizationPipelineColumn,
    MediaAtomizationPipelineItem,
    MediaAtomizationPolicy,
    MediaPublicationPath,
    MediaAtomizationRun,
    MediaAtomizationSourcePolicy,
} from '@/types/platform/media-atomization';

const buckets = ['5m', '10m', '15m', '20m', '30m', '40m'];
const statusOptions = ['all', 'schema_missing', 'queued', 'waiting_media', 'waiting_transcript', 'planning', 'cutting', 'embedding', 'needs_review', 'completed', 'failed'];
const reviewOptions = ['all', 'needed', 'published', 'embedding_pending', 'rejected'];
const MIN_FEED_UNIT_SECONDS = 270;
const HARD_MAX_SECONDS = 2400;
const publicationPathOptions: Array<MediaPublicationPath | 'all'> = ['all', 'atomized', 'direct_transcript', 'direct_no_transcript', 'blocked_transcript', 'invalid'];
const publicationTracks: MediaPublicationPath[] = ['atomized', 'direct_transcript', 'direct_no_transcript', 'blocked_transcript'];
const missionTabs = ['publish', 'workflow', 'review', 'studio', 'autopilot', 'policy', 'diagnostics'] as const;
type MissionTab = typeof missionTabs[number];

function readMissionTab(params: URLSearchParams): MissionTab {
    const raw = params.get('tab');
    return missionTabs.includes(raw as MissionTab) ? raw as MissionTab : 'workflow';
}

function missionTabLabel(tab: MissionTab): string {
    switch (tab) {
        case 'publish': return 'Published';
        case 'workflow': return 'Workflow';
        case 'review': return 'Review';
        case 'studio': return 'Studio';
        case 'autopilot': return 'Autopilot';
        case 'policy': return 'Policy';
        case 'diagnostics': return 'Diagnostics';
    }
}

function readFilters(params: URLSearchParams): AtomizationFilters {
    return {
        status: params.get('status') || undefined,
        source: params.get('source') || undefined,
        bucket: params.get('bucket') || undefined,
        review: params.get('review') || undefined,
        path: params.get('path') || undefined,
        q: params.get('q') || undefined,
    };
}

function publicationPathLabel(path?: string | null): string {
    switch (path) {
        case 'atomized': return 'Published chapters';
        case 'direct_transcript': return 'Published direct + transcript';
        case 'direct_no_transcript': return 'Published direct, no transcript';
        case 'blocked_transcript': return 'Blocked for transcript';
        case 'invalid': return 'Invalid visible media';
        default: return 'All publication paths';
    }
}

function publicationPathReason(path?: string | null): string {
    switch (path) {
        case 'atomized': return 'Chapter from long podcast';
        case 'direct_transcript': return 'Short enough, transcript ready';
        case 'direct_no_transcript': return 'Short enough, transcript missing';
        case 'blocked_transcript': return 'Long media needs transcript before atomization';
        case 'invalid': return 'Visible item breaks feed rules';
        default: return 'Publication path is still being classified';
    }
}

function publicationPathColor(path?: string | null): string {
    switch (path) {
        case 'atomized': return '#2CBAC6';
        case 'direct_transcript': return '#D7A83E';
        case 'direct_no_transcript': return '#5BA86B';
        case 'blocked_transcript':
        case 'invalid':
            return '#C94B4B';
        default: return '#2F3437';
    }
}

function publicationPathCount(overview: MediaAtomizationOverview | undefined, path: MediaPublicationPath): number {
    const summary = overview?.publication_summary;
    switch (path) {
        case 'atomized': return summary?.atomized_published_count ?? overview?.auto_published_count ?? 0;
        case 'direct_transcript': return summary?.direct_with_transcript_count ?? 0;
        case 'direct_no_transcript': return summary?.direct_without_transcript_count ?? 0;
        case 'blocked_transcript': return summary?.blocked_waiting_transcript_count ?? 0;
        case 'invalid': return summary?.invalid_visible_count ?? overview?.duration_violation_count ?? 0;
        default: return 0;
    }
}

function compactNumber(value: number | undefined | null): string {
    const n = value ?? 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function formatDurationMs(ms?: number | null): string {
    if (!ms || ms <= 0) return '0:00';
    return formatDurationSec(Math.round(ms / 1000));
}

function formatDurationSec(seconds?: number | null): string {
    if (!seconds || seconds <= 0) return 'n/a';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatAge(seconds?: number | null): string {
    if (!seconds || seconds < 60) return '<1m';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

function formatSeconds(seconds?: number | null): string {
    if (!seconds || seconds <= 0) return 'n/a';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m`;
}

function formatCoverage(percent?: number | null): string {
    if (percent === null || percent === undefined || Number.isNaN(percent)) return 'n/a';
    return `${Math.round(percent)}%`;
}

function childVisibilityCount(data: MediaAtomizationOverview | undefined, visibility: string): number {
    return data?.child_state_counts
        ?.filter((row) => row.feed_visibility === visibility)
        .reduce((sum, row) => sum + row.count, 0) ?? 0;
}

function statusVariant(status?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'info' {
    if (status === 'completed' || status === 'published' || status === 'visible') return 'success';
    if (status === 'failed' || status === 'rejected') return 'destructive';
    if (status === 'needs_review' || status === 'review') return 'warning';
    if (status === 'embedding_pending' || status === 'embedding' || status === 'planning' || status === 'cutting') return 'info';
    return 'secondary';
}

function StatusBadge({ value }: { value?: string | null }) {
    if (!value) return <Badge variant="secondary">unstarted</Badge>;
    return <Badge variant={statusVariant(value)}>{value.replaceAll('_', ' ')}</Badge>;
}

function KpiCard({ label, value, sub, tone = 'neutral' }: { label: string; value: number | string; sub?: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
    return (
        <div className="rounded-md border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
            <div className="mt-2 flex min-h-9 items-end justify-between gap-3">
                <p className={cn(
                    'font-mono text-2xl font-semibold tabular-nums',
                    tone === 'ok' && 'text-[#2CBAC6]',
                    tone === 'warn' && 'text-[#D7A83E]',
                    tone === 'bad' && 'text-[#C94B4B]',
                    tone === 'neutral' && 'text-foreground',
                )}>
                    {typeof value === 'number' ? compactNumber(value) : value}
                </p>
                {sub && <p className="max-w-28 text-right text-xs leading-tight text-muted-foreground">{sub}</p>}
            </div>
        </div>
    );
}

function SummaryStrip({ children }: { children: ReactNode }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {children}
        </div>
    );
}

function TabLoading({ label }: { label: string }) {
    return (
        <div className="flex items-center rounded-md border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {label}
        </div>
    );
}

function FilterBar({
    filters,
    setFilter,
    resetFilters,
}: {
    filters: AtomizationFilters;
    setFilter: (key: keyof AtomizationFilters, value?: string) => void;
    resetFilters: () => void;
}) {
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    value={filters.q ?? ''}
                    onChange={(event) => setFilter('q', event.target.value || undefined)}
                    placeholder="Search parent, chapter, source"
                    className="pl-9"
                />
            </div>
            <Input
                value={filters.source ?? ''}
                onChange={(event) => setFilter('source', event.target.value || undefined)}
                placeholder="Source"
            />
            <Select value={filters.status ?? 'all'} onValueChange={(value) => setFilter('status', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                    {statusOptions.map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_', ' ')}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.bucket ?? 'all'} onValueChange={(value) => setFilter('bucket', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All durations</SelectItem>
                    {buckets.map((bucket) => <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.review ?? 'needed'} onValueChange={(value) => setFilter('review', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
                <SelectContent>
                    {reviewOptions.map((option) => <SelectItem key={option} value={option}>{option.replaceAll('_', ' ')}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters}>
                <Filter className="mr-2 h-4 w-4" /> Reset
            </Button>
        </div>
    );
}

function PolicyStrip({
    overview,
    onRepair,
    repairing,
    disabled,
}: {
    overview?: MediaAtomizationOverview;
    onRepair: () => void;
    repairing: boolean;
    disabled: boolean;
}) {
    const invariants = overview?.invariants;
    const violations = (invariants?.visible_under_floor_feed_units ?? overview?.visible_under_floor_count ?? 0)
        + (invariants?.visible_over_hard_max_feed_units ?? overview?.visible_over_hard_max_count ?? 0)
        + (invariants?.parents_under_40m_with_children ?? overview?.short_parent_active_child_count ?? 0);
    const policy = overview?.policy;
    return (
        <section className="rounded-md border border-foreground/15 bg-foreground p-3 text-background dark:bg-card dark:text-card-foreground">
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex flex-wrap gap-2">
                    <PolicyPill label="Atomize only" value={`>${Math.round((policy?.atomization_min_parent_seconds ?? 2400) / 60)}m`} />
                    <PolicyPill label="Feed floor" value={formatDurationSec(policy?.min_feed_unit_seconds ?? MIN_FEED_UNIT_SECONDS)} accent="cyan" />
                    <PolicyPill label="Hard max" value={`${Math.round((policy?.hard_max_feed_unit_seconds ?? HARD_MAX_SECONDS) / 60)}m`} />
                    <PolicyPill label="Short chapters" value="merge" accent="amber" />
                </div>
                <Button
                    size="sm"
                    variant={violations > 0 ? 'destructive' : 'outline'}
                    onClick={onRepair}
                    disabled={disabled || repairing || violations === 0}
                    className={cn(violations === 0 && 'border-background/30 bg-transparent text-background hover:bg-background/10 dark:text-card-foreground dark:hover:bg-muted/40')}
                >
                    {repairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Repair invariants
                </Button>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <Invariant label="visible under 4:30" value={invariants?.visible_under_floor_feed_units ?? overview?.visible_under_floor_count ?? 0} />
                <Invariant label="visible over 40m" value={invariants?.visible_over_hard_max_feed_units ?? overview?.visible_over_hard_max_count ?? 0} />
                <Invariant label="short parents with children" value={invariants?.parents_under_40m_with_children ?? overview?.short_parent_active_child_count ?? 0} />
                <Invariant label="short chapters in review" value={invariants?.short_chapters_awaiting_review ?? overview?.short_chapter_review_count ?? 0} />
            </div>
        </section>
    );
}

function PolicyPill({ label, value, accent }: { label: string; value: string; accent?: 'cyan' | 'amber' }) {
    return (
        <div className="rounded-md border border-background/15 px-3 py-2 dark:border-border">
            <span className="block text-[10px] font-semibold uppercase tracking-normal text-background/60 dark:text-muted-foreground">{label}</span>
            <span className={cn('font-mono text-sm tabular-nums', accent === 'cyan' && 'text-[#2CBAC6]', accent === 'amber' && 'text-[#D7A83E]')}>{value}</span>
        </div>
    );
}

function PolicyEditor({
    policy,
    saving,
    onPatch,
}: {
    policy?: MediaAtomizationPolicy;
    saving: boolean;
    onPatch: (patch: Partial<MediaAtomizationPolicy>) => void;
}) {
    if (!policy) return <EmptyBox text="Tenant policy is unavailable. Controls will appear after a successful read." />;
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<SlidersHorizontal className="h-4 w-4 text-[#2CBAC6]" />} title="Policy Controls" sub="Tenant defaults. Source and episode overrides can narrow these rules, but cannot atomize <=40m parents." />
            <div className="grid gap-3 p-4 pt-0 md:grid-cols-2 xl:grid-cols-4">
                <PolicyToggle label="Chaptering" value={policy?.chaptering_enabled ?? true} disabled={saving} onChange={(value) => onPatch({ chaptering_enabled: value })} />
                <PolicyToggle label="Auto-publish" value={policy?.auto_publish_high_confidence ?? true} disabled={saving} onChange={(value) => onPatch({ auto_publish_high_confidence: value })} />
                <PolicyToggle label="Preserve video" value={policy?.preserve_video ?? true} disabled={saving} onChange={(value) => onPatch({ preserve_video: value })} />
                <PolicyToggle label="Remove sponsors" value={policy?.remove_sponsor_segments ?? true} disabled={saving} onChange={(value) => onPatch({ remove_sponsor_segments: value })} />
                <PolicyNumber label="Confidence" value={policy?.high_confidence_threshold ?? 0.82} step={0.01} disabled={saving} onCommit={(value) => onPatch({ high_confidence_threshold: value })} />
                <PolicyNumber label="Max chapters" value={policy?.max_chapters_per_parent ?? 5} disabled={saving} onCommit={(value) => onPatch({ max_chapters_per_parent: Math.round(value) })} />
                <PolicyNumber label="Feed floor sec" value={policy?.min_feed_unit_seconds ?? 270} disabled={saving} onCommit={(value) => onPatch({ min_feed_unit_seconds: Math.round(value) })} />
                <PolicyNumber label="Parent min sec" value={policy?.atomization_min_parent_seconds ?? 2400} disabled={saving} onCommit={(value) => onPatch({ atomization_min_parent_seconds: Math.round(value) })} />
            </div>
        </section>
    );
}

function PolicyToggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={cn('flex items-center justify-between rounded-md border bg-muted/35 px-3 py-2 text-left text-sm transition hover:border-[#2CBAC6]', disabled && 'cursor-not-allowed opacity-60')}
        >
            <span>{label}</span>
            <Badge variant={value ? 'success' : 'secondary'}>{value ? 'on' : 'off'}</Badge>
        </button>
    );
}

function PolicyNumber({ label, value, step = 1, disabled, onCommit }: { label: string; value: number; step?: number; disabled: boolean; onCommit: (value: number) => void }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    return (
        <label className="grid gap-1 rounded-md border bg-muted/35 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Input
                type="number"
                step={step}
                value={draft}
                disabled={disabled}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                    const next = Number(draft);
                    if (Number.isFinite(next)) onCommit(next);
                }}
                className="h-8 font-mono"
            />
        </label>
    );
}

function SourceOverrides({
    sources,
    saving,
    onToggle,
}: {
    sources: MediaAtomizationSourcePolicy[];
    saving: boolean;
    onToggle: (source: MediaAtomizationSourcePolicy) => void;
}) {
    const safeSources = Array.isArray(sources) ? sources : [];
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<ShieldCheck className="h-4 w-4 text-[#D7A83E]" />} title="Source Overrides" sub="Disable automatic atomization for a whole show/source while keeping episodes in the library." />
            <div className="space-y-2 p-4 pt-0">
                {safeSources.length === 0 ? <EmptyBox text="No media sources loaded." /> : safeSources.slice(0, 8).map((source) => (
                    <div key={source.id} className="grid gap-3 rounded-md border bg-muted/35 p-3 md:grid-cols-[1fr_130px_120px] md:items-center">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium" dir="auto">{source.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{source.feed_url ?? source.type}</p>
                        </div>
                        <Badge variant={source.chaptering_enabled ? 'success' : 'secondary'}>{source.chaptering_enabled ? 'atomizing' : 'excluded'}</Badge>
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => onToggle(source)}>
                            {source.chaptering_enabled ? 'Exclude' : 'Enable'}
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Invariant({ label, value }: { label: string; value: number }) {
    return (
        <div className={cn('flex items-center justify-between rounded border px-3 py-2', value > 0 ? 'border-destructive/45 bg-destructive/15 text-background dark:text-destructive' : 'border-background/10 bg-background/5 dark:border-border dark:bg-muted/30')}>
            <span>{label}</span>
            <span className="font-mono font-semibold tabular-nums">{value}</span>
        </div>
    );
}

function PublicationMap({
    overview,
    feedUnits,
    selectedPath,
    actionsDisabled,
    sttPending,
    overridePending,
    onSelectPath,
    onOpenStudio,
    onRequestTranscript,
    onDisableAtomization,
}: {
    overview?: MediaAtomizationOverview;
    feedUnits: MediaAtomizationFeedUnit[];
    selectedPath?: string;
    actionsDisabled: boolean;
    sttPending: boolean;
    overridePending: boolean;
    onSelectPath: (path?: string) => void;
    onOpenStudio: (id: string) => void;
    onRequestTranscript: (id: string) => void;
    onDisableAtomization: (id: string) => void;
}) {
    const safeFeedUnits = Array.isArray(feedUnits) ? feedUnits : [];
    const publishedTotal = publicationPathCount(overview, 'atomized')
        + publicationPathCount(overview, 'direct_transcript')
        + publicationPathCount(overview, 'direct_no_transcript');
    return (
        <section className="overflow-hidden rounded-md border bg-[#171717] text-[#F7F8F6] shadow-sm">
            <div className="grid gap-4 border-b border-white/10 p-4 lg:grid-cols-[1fr_220px] lg:items-end">
                <div>
                    <span className="brand-overline text-[#D7A83E]">Pods output</span>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                        <h2 className="text-xl font-semibold">Publication map</h2>
                        <span className="font-mono text-3xl font-semibold tabular-nums text-[#2CBAC6]">{compactNumber(publishedTotal)}</span>
                        <span className="pb-1 text-sm text-white/60">published feed units</span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-white/65">
                        Three published media paths flow into Pods. Long media without transcript is blocked here until it can be atomized.
                    </p>
                </div>
                <div className="rounded border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Radio className="h-4 w-4 text-[#2CBAC6]" />
                        Pods endpoint
                    </div>
                    <p className="mt-1 text-xs text-white/55">Only visible units from 4:30 to 40:00 can enter playback.</p>
                </div>
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-4">
                {publicationTracks.map((path) => {
                    const items = safeFeedUnits.filter((item) => item.publication_path === path).slice(0, 3);
                    const color = publicationPathColor(path);
                    const active = selectedPath === path;
                    return (
                        <div key={path} className={cn('rounded-md border bg-[#2F3437]/55 p-3', active ? 'border-white/55' : 'border-white/10')}>
                            <button
                                type="button"
                                onClick={() => onSelectPath(path)}
                                className="flex w-full items-start justify-between gap-3 rounded text-left focus:outline-none focus:ring-2 focus:ring-white/40"
                            >
                                <div>
                                    <p className="text-sm font-semibold">{publicationPathLabel(path)}</p>
                                    <p className="mt-1 text-xs text-white/55">{publicationPathReason(path)}</p>
                                </div>
                                <span className="rounded px-2 py-1 font-mono text-lg font-semibold tabular-nums" style={{ color }}>
                                    {compactNumber(publicationPathCount(overview, path))}
                                </span>
                            </button>
                            <div className="mt-3 h-1.5 rounded bg-white/10">
                                <div className="h-1.5 rounded" style={{ width: `${Math.min(100, publicationPathCount(overview, path) * 8)}%`, backgroundColor: color }} />
                            </div>
                            <div className="mt-3 space-y-2">
                                {items.length === 0 ? (
                                    <p className="rounded border border-dashed border-white/15 p-3 text-xs text-white/45">No recent items in this path.</p>
                                ) : items.map((item) => (
                                    <PublicationCard
                                        key={item.id}
                                        item={item}
                                        compact
                                        actionsDisabled={actionsDisabled}
                                        sttPending={sttPending}
                                        overridePending={overridePending}
                                        onOpenStudio={onOpenStudio}
                                        onRequestTranscript={onRequestTranscript}
                                        onDisableAtomization={onDisableAtomization}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function PublicationLedger({
    items,
    selectedPath,
    actionsDisabled,
    sttPending,
    overridePending,
    onSelectPath,
    onOpenStudio,
    onRequestTranscript,
    onDisableAtomization,
}: {
    items: MediaAtomizationFeedUnit[];
    selectedPath?: string;
    actionsDisabled: boolean;
    sttPending: boolean;
    overridePending: boolean;
    onSelectPath: (path?: string) => void;
    onOpenStudio: (id: string) => void;
    onRequestTranscript: (id: string) => void;
    onDisableAtomization: (id: string) => void;
}) {
    const safeItems = Array.isArray(items) ? items : [];
    return (
        <section className="rounded-md border bg-card">
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <SectionHeaderInner icon={<Radio className="h-4 w-4 text-[#5BA86B]" />} title="Publication ledger" sub="Every row says whether it is published, direct, blocked, or invalid." />
                <div className="flex flex-wrap gap-2">
                    {publicationPathOptions.map((path) => (
                        <Button
                            key={path}
                            size="sm"
                            variant={(selectedPath ?? 'all') === path ? 'default' : 'outline'}
                            onClick={() => onSelectPath(path === 'all' ? undefined : path)}
                        >
                            {path === 'all' ? 'All' : publicationPathLabel(path)}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="space-y-2 p-4 pt-0">
                {safeItems.length === 0 ? (
                    <EmptyBox text="No feed units match this publication path." />
                ) : safeItems.map((item) => (
                    <PublicationCard
                        key={item.id}
                        item={item}
                        actionsDisabled={actionsDisabled}
                        sttPending={sttPending}
                        overridePending={overridePending}
                        onOpenStudio={onOpenStudio}
                        onRequestTranscript={onRequestTranscript}
                        onDisableAtomization={onDisableAtomization}
                    />
                ))}
            </div>
        </section>
    );
}

function PublicationCard({
    item,
    compact = false,
    actionsDisabled,
    sttPending,
    overridePending,
    onOpenStudio,
    onRequestTranscript,
    onDisableAtomization,
}: {
    item: MediaAtomizationFeedUnit;
    compact?: boolean;
    actionsDisabled: boolean;
    sttPending: boolean;
    overridePending: boolean;
    onOpenStudio: (id: string) => void;
    onRequestTranscript: (id: string) => void;
    onDisableAtomization: (id: string) => void;
}) {
    const path = item.publication_path;
    const studioId = item.parent_id ?? item.id;
    const canRequestTranscript = path === 'direct_no_transcript' || path === 'blocked_transcript';
    const canDisableAtomization = path === 'blocked_transcript';
    const color = publicationPathColor(path);
    return (
        <div className={cn('rounded-md border bg-background p-3 text-foreground', compact && 'border-white/10 bg-black/20 text-[#F7F8F6]')}>
            <div className={cn('grid gap-3', !compact && 'lg:grid-cols-[1fr_170px_260px] lg:items-center')}>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <p className="min-w-0 truncate text-sm font-medium" dir="auto">{item.title ?? 'Untitled media'}</p>
                    </div>
                    <p className={cn('mt-1 line-clamp-1 text-xs', compact ? 'text-white/55' : 'text-muted-foreground')} dir="auto">
                        {item.source_name ?? 'Unknown source'} · {publicationPathReason(path)}
                    </p>
                    {item.latest_error && <p className="mt-1 line-clamp-1 text-xs text-[#C94B4B]">{item.latest_error}</p>}
                </div>
                <div className={cn('flex flex-wrap gap-1 text-xs', !compact && 'lg:justify-start')}>
                    <Badge variant={path === 'invalid' ? 'destructive' : path === 'blocked_transcript' ? 'warning' : 'success'}>{publicationPathLabel(path)}</Badge>
                    <Badge variant="outline" className={cn(compact && 'border-white/20 text-[#F7F8F6]')}>{formatDurationSec(item.duration_sec)}</Badge>
                    <Badge variant={item.transcript_state === 'ready' ? 'success' : 'secondary'}>{item.transcript_state === 'ready' ? 'transcript' : 'no transcript'}</Badge>
                    <StatusBadge value={item.feed_visibility} />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button size="sm" variant="outline" onClick={() => onOpenStudio(studioId)}>
                        <ExternalLink className="mr-2 h-4 w-4" /> Studio
                    </Button>
                    {canRequestTranscript && (
                        <Button size="sm" variant="outline" disabled={actionsDisabled || sttPending} onClick={() => onRequestTranscript(studioId)}>
                            {sttPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Request transcript
                        </Button>
                    )}
                    {canDisableAtomization && (
                        <Button size="sm" variant="outline" disabled={actionsDisabled || overridePending} onClick={() => onDisableAtomization(studioId)}>
                            Disable atomization
                        </Button>
                    )}
                    {item.playback_url && (
                        <Button size="sm" variant="outline" asChild>
                            <a href={item.playback_url} target="_blank" rel="noreferrer">
                                <Play className="mr-2 h-4 w-4" /> Preview
                            </a>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function AtomizationRail({ pipeline, filters, revision, onOpenStudio }: { pipeline?: MediaAtomizationPipeline; filters: AtomizationFilters; revision: number; onOpenStudio: (id: string) => void }) {
    // A fetched snapshot owns all pagination beneath it. Remounting lanes
    // also isolates in-flight responses from a previous filter/snapshot.
    const snapshotKey = JSON.stringify([filters, revision]);
    const columns = useMemo(() => Array.isArray(pipeline?.columns) ? pipeline.columns : [], [pipeline?.columns]);
    const firstActive = columns.find((column) => column.count > 0)?.key ?? columns[0]?.key ?? 'ready';
    const [selectedStage, setSelectedStage] = useState(firstActive);
    useEffect(() => {
        if (columns.length === 0) return;
        const current = columns.find((column) => column.key === selectedStage);
        if (!current || current.count === 0) {
            setSelectedStage(firstActive);
        }
    }, [columns, firstActive, selectedStage]);
    const selected = columns.find((column) => column.key === selectedStage) ?? columns[0];

    return (
        <section className="rounded-md border bg-muted/25">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-foreground">
                        <Waves className="h-4 w-4 text-[#2CBAC6]" />
                        <h2 className="text-base font-semibold">Atomization workflow</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Preparing media means download → probe → R2 upload → rendition or analysis audio → thumbnail → CMS verification. Every lane is built from CMS durable state.</p>
                </div>
                <div className="md:hidden">
                    <Select value={selected?.key ?? selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {columns.map((column) => (
                                <SelectItem key={column.key} value={column.key}>{column.label} ({column.count})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="hidden overflow-x-auto p-3 md:block">
                <div className="grid min-w-[2900px] grid-cols-10 gap-3">
                    {columns.map((column) => <RailLane key={`${JSON.stringify(filters)}:${column.key}`} column={column} filters={filters} onOpenStudio={onOpenStudio} />)}
                </div>
            </div>
            <div className="p-3 md:hidden">
                {selected ? <RailLane key={`${JSON.stringify(filters)}:${selected.key}`} column={selected} filters={filters} mobile onOpenStudio={onOpenStudio} /> : <EmptyBox text="No pipeline data yet." />}
            </div>
        </section>
    );
}

function RailLane({ column, filters, mobile = false, onOpenStudio }: { column: MediaAtomizationPipelineColumn; filters: AtomizationFilters; mobile?: boolean; onOpenStudio: (id: string) => void }) {
    const [extra, setExtra] = useState<MediaAtomizationPipelineItem[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(column.next_cursor);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const filterKey = JSON.stringify(filters);
    useEffect(() => { setExtra([]); setCursor(column.next_cursor); setError(undefined); }, [filterKey, column.key]);
    useEffect(() => { if (extra.length === 0) setCursor(column.next_cursor); }, [column.next_cursor, extra.length]);
    const items = [...new Map([...extra, ...(column.items ?? [])].map(item => [item.id, item])).values()];
    const loadMore = async () => {
        if (!cursor || loading) return;
        setLoading(true); setError(undefined);
        try {
            const page = await getMediaAtomizationPipeline({ ...filters, lane: column.key, cursor, limit: 100 });
            const lane = page.columns.find(value => value.key === column.key);
            setExtra(previous => [...previous, ...(lane?.items ?? [])]);
            setCursor(lane?.next_cursor);
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this lane'); }
        finally { setLoading(false); }
    };
    return (
        <div className={cn('min-h-64 rounded-md border bg-card', !mobile && 'min-w-0')}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
                <h3 className="truncate text-sm font-semibold text-foreground">{column.label}</h3>
                <span className="rounded bg-foreground px-2 py-0.5 font-mono text-xs tabular-nums text-background">{column.count}</span>
            </div>
            <div className="space-y-2 p-2">
                {items.length === 0 ? (
                    <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">No parents in lane.</p>
                ) : items.map((item) => <div key={item.id}><RailCard item={item} onOpenStudio={onOpenStudio} /><RailActions item={item} /></div>)}
                {column.count > items.length && (
                    <p className="rounded border border-dashed p-2 text-center text-xs text-muted-foreground">
                        +{column.count - items.length} more match this lane
                    </p>
                )}
                {cursor && <Button size="sm" variant="outline" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load more'}</Button>}
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
        </div>
    );
}

function RailActions({ item }: { item: MediaAtomizationPipelineItem }) {
    const retry = useAtomizeMediaParent();
    const transcript = useTriggerStt();
    const acquisition = useRequestMediaAcquisition();
    const actions = item.allowed_actions ?? [];
    const pending = retry.isPending || transcript.isPending || acquisition.isPending;
    return <div className="mt-1 flex flex-wrap gap-1">
        {actions.includes('download') && <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            if (window.confirm(`Download and process 1 episode? Duration: ${item.duration_sec == null ? 'unknown' : `${Math.round(item.duration_sec / 60)} minutes`}. Storage size: unknown until media probe.`)) acquisition.mutate(item.id);
        }}>Download &amp; process</Button>}
        {actions.includes('approve_transcript') && <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            if (window.confirm('Approve transcription for this episode? Generated STT may incur provider charges; available captions are imported first.')) transcript.mutate(item.id);
        }}>Generate transcript</Button>}
        {actions.includes('retry_atomization') && <Button size="sm" variant="outline" disabled={pending} onClick={() => { if (window.confirm('Retry the failed atomization step? Verified work is reused when safe. Planning, cutting, or embedding may incur processing costs. This does not bypass publication checks.')) retry.mutate(item.id); }}>Retry atomization</Button>}
        {actions.includes('review') && <Button size="sm" variant="outline" onClick={() => window.location.assign(`/platform/media/atomization?tab=review&item=${item.id}`)}>Review chapter</Button>}
        {item.blocked_reason && <p className="text-xs text-muted-foreground">{item.blocked_reason}</p>}
    </div>;
}

function RailCard({ item, onOpenStudio }: { item: MediaAtomizationPipelineItem; onOpenStudio: (id: string) => void }) {
    const error = item.latest_error;
    return (
        <button
            type="button"
            onClick={() => onOpenStudio(item.id)}
            className="block w-full rounded-md border bg-muted/35 p-3 text-left text-xs transition hover:border-[#2CBAC6] hover:bg-card focus:outline-none focus:ring-2 focus:ring-[#2CBAC6]"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 font-medium text-foreground" dir="auto">{item.title ?? 'Untitled media'}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatAge(item.age_seconds)}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-muted-foreground" dir="auto">{item.source_name ?? 'Unknown source'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline">{formatDurationSec(item.duration_sec)}</Badge>
                <StatusBadge value={item.chaptering_status} />
                {item.status === 'FAILED' && <Badge variant="destructive">content failed</Badge>}
                {item.failed_or_stuck && item.status !== 'FAILED' && <Badge variant="destructive">stuck</Badge>}
                <Badge variant={item.transcript_state === 'ready' ? 'success' : 'warning'}>{item.transcript_state === 'ready' ? 'transcript' : 'no transcript'}</Badge>
                {item.media_stage_state && <Badge variant="info">media {item.media_stage_state.replaceAll('_', ' ')}</Badge>}
                {item.media_stage_phase && ['running', 'verifying'].includes(item.media_stage_state ?? '') && <Badge variant="outline">media phase {item.media_stage_phase.replaceAll('_', ' ')}</Badge>}
                {item.transcript_stage_state && <Badge variant="info">{item.transcript_stage_state === 'blocked' ? 'Transcript waits for media' : `Transcript ${item.transcript_stage_state.replaceAll('_', ' ')}`}</Badge>}
                {item.run_phase && <Badge variant="outline">phase {item.run_phase.replaceAll('_', ' ')}</Badge>}
                {item.current_phase && <Badge variant="outline">current {item.current_phase.replaceAll('_', ' ')}</Badge>}
                {item.disposition && item.disposition !== 'active' && <Badge variant={item.disposition === 'reconciling' || item.disposition === 'parked_failed' ? 'destructive' : 'secondary'}>{item.disposition.replaceAll('_', ' ')}</Badge>}
                {!!item.expected_chapter_count && <Badge variant="outline">{item.verified_chapter_count ?? 0}/{item.expected_chapter_count} cuts verified</Badge>}
                {item.atomization_override && item.atomization_override !== 'inherit' && (
                    <Badge variant={item.atomization_override === 'disabled' ? 'secondary' : 'info'}>{item.atomization_override}</Badge>
                )}
                {item.manual_atomization_requested_at && <Badge variant="info">manual</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center font-mono tabular-nums text-foreground">
                <MiniStat label="child" value={item.child_count} />
                <MiniStat label="cover" value={formatCoverage(item.coverage_percent)} />
                <MiniStat label="review" value={item.review_count} />
                <MiniStat label="embed" value={item.embedding_pending_count} />
            </div>
            {(error || item.blocking_reason || item.parked_reason) && <p className="mt-2 line-clamp-2 rounded bg-destructive/10 px-2 py-1 text-destructive">{error ?? item.blocking_reason ?? item.parked_reason}</p>}
            <span className="mt-2 inline-flex items-center gap-1 font-medium text-[#2CBAC6]">
                {item.primary_action}
                <ExternalLink className="h-3.5 w-3.5" />
            </span>
        </button>
    );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
    return (
        <span className="rounded bg-background px-1.5 py-1">
            <span className="block text-sm font-semibold">{value}</span>
            <span className="block text-[10px] text-muted-foreground">{label}</span>
        </span>
    );
}

function ReviewQueue({
    chapters,
    approving,
    rejecting,
    actionsDisabled,
    onOpenStudio,
    onApprove,
    onReject,
}: {
    chapters: MediaAtomizationChapter[];
    approving: boolean;
    rejecting: boolean;
    actionsDisabled: boolean;
    onOpenStudio: (id: string, chapterId?: string) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}) {
    const safeChapters = Array.isArray(chapters) ? chapters : [];
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<Scissors className="h-4 w-4 text-[#D7A83E]" />} title="Review Triage" sub="Approve only valid 4:30-40:00 chapters. Shorter cuts need merge or boundary edits in Studio." />
            <div className="space-y-2 p-4 pt-0">
                {safeChapters.length === 0 ? (
                    <EmptyBox text="No chapters in this queue." />
                ) : safeChapters.slice(0, 10).map((chapter) => {
                    const invalidDuration = chapter.duration_ms < MIN_FEED_UNIT_SECONDS * 1000 || chapter.duration_ms > HARD_MAX_SECONDS * 1000;
                    return (
                        <div key={chapter.id} className="grid gap-3 rounded-md border bg-muted/35 p-3 lg:grid-cols-[1fr_170px_280px] lg:items-center">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="min-w-0 truncate font-medium text-foreground" dir="auto">{chapter.title}</h3>
                                    <StatusBadge value={chapter.feed_visibility ?? chapter.status} />
                                    <Badge variant="outline">{chapter.duration_bucket ?? formatDurationMs(chapter.duration_ms)}</Badge>
                                    <Badge variant={chapter.confidence && chapter.confidence >= 0.82 ? 'success' : 'warning'}>
                                        {Math.round((chapter.confidence ?? 0) * 100)}%
                                    </Badge>
                                    {invalidDuration && <Badge variant="destructive">invalid duration</Badge>}
                                </div>
                                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground" dir="auto">
                                    {chapter.parent_title ?? 'Untitled parent'} · {chapter.source_name ?? 'Unknown source'}
                                </p>
                                {chapter.needs_review_reason && (
                                    <p className="mt-1 text-xs text-[#D7A83E]">{chapter.needs_review_reason}</p>
                                )}
                            </div>
                            <div className="font-mono text-sm tabular-nums text-muted-foreground">
                                <p>{formatDurationMs(chapter.duration_ms)}</p>
                                <p>{formatDurationSec(Math.round(chapter.start_ms / 1000))} → {chapter.end_ms ? formatDurationSec(Math.round(chapter.end_ms / 1000)) : 'open'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                {chapter.playback_url && (
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={chapter.playback_url} target="_blank" rel="noreferrer">
                                            <Play className="mr-2 h-4 w-4" /> Preview
                                        </a>
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => onOpenStudio(chapter.parent_id, chapter.id)}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Studio
                                </Button>
                                <Button size="sm" onClick={() => { if (window.confirm('Approve this chapter for publication? This records editorial approval. Required embeddings, verified artifacts, and sibling requirements must still pass before the complete generation publishes.')) onApprove(chapter.id); }} disabled={actionsDisabled || approving || rejecting || invalidDuration}>
                                    <Check className="mr-2 h-4 w-4" /> Approve chapter for publication
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => onReject(chapter.id)} disabled={actionsDisabled || approving || rejecting}>
                                    <X className="mr-2 h-4 w-4" /> Reject
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function DurationDistribution({ overview }: { overview?: MediaAtomizationOverview }) {
    const distribution = Array.isArray(overview?.duration_distribution) ? overview.duration_distribution : [];
    const rows = buckets.map((bucket) => distribution.find((row) => row.bucket === bucket) ?? {
        bucket,
        published: 0,
        needs_review: 0,
        embedding_pending: 0,
    });
    const max = Math.max(1, ...rows.map((row) => row.published + row.needs_review + row.embedding_pending));
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<SlidersHorizontal className="h-4 w-4 text-[#2CBAC6]" />} title="Duration Distribution" sub="Published, review, and embedding-pending chapter units by bucket." />
            <div className="space-y-3 p-4 pt-0">
                {rows.map((row) => {
                    const total = row.published + row.needs_review + row.embedding_pending;
                    return (
                        <div key={row.bucket} className="grid grid-cols-[48px_1fr] items-center gap-3">
                            <span className="font-mono text-sm font-semibold tabular-nums">{row.bucket}</span>
                            <div>
                                <div className="flex h-7 overflow-hidden rounded bg-muted" aria-label={`${row.bucket}: ${total} chapters`}>
                                    <div className="bg-[#2CBAC6]" style={{ width: `${(row.published / max) * 100}%` }} />
                                    <div className="bg-[#D7A83E]" style={{ width: `${(row.needs_review / max) * 100}%` }} />
                                    <div className="bg-foreground/70" style={{ width: `${(row.embedding_pending / max) * 100}%` }} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {total} total · {row.published} published · {row.needs_review} review · {row.embedding_pending} embedding
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function SourcePerformance({ overview }: { overview?: MediaAtomizationOverview }) {
    const rows = Array.isArray(overview?.source_performance) ? overview.source_performance : [];
    const max = Math.max(1, ...rows.map((row) => row.children_produced));
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<Eye className="h-4 w-4 text-[#2CBAC6]" />} title="Source Performance" sub="Which sources produce review pressure, failed runs, and feed-ready chapters." />
            <div className="space-y-3 p-4 pt-0">
                {rows.length === 0 ? (
                    <EmptyBox text="No source output yet." />
                ) : rows.map((row) => {
                    const autoPublishRate = row.children_produced ? Math.round((row.published_count / row.children_produced) * 100) : 0;
                    const reviewRate = row.children_produced ? Math.round((row.review_count / row.children_produced) * 100) : 0;
                    const failureRate = row.parents_processed ? Math.round((row.failed_count / row.parents_processed) * 100) : 0;
                    return (
                        <div key={`${row.source_name}-${row.source_feed_url ?? ''}`} className="grid gap-2 rounded-md border bg-muted/35 p-3 sm:grid-cols-[1fr_190px] sm:items-center">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground" dir="auto">{row.source_name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {row.parents_processed} parents · {row.children_produced} chapters · {autoPublishRate}% auto · {reviewRate}% review · {failureRate}% failed
                                </p>
                            </div>
                            <div>
                                <div className="h-2 rounded bg-muted">
                                    <div className="h-2 rounded bg-[#D7A83E]" style={{ width: `${(row.children_produced / max) * 100}%` }} />
                                </div>
                                <p className="mt-1 text-right text-xs text-muted-foreground">{row.published_count} published</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function ParentLifecycle({ parents, onOpenStudio }: { parents: MediaAtomizationParent[]; onOpenStudio: (id: string) => void }) {
    const safeParents = Array.isArray(parents) ? parents : [];
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<Clock3 className="h-4 w-4 text-muted-foreground" />} title="Parent Lifecycle" sub="Recent parent media and their child chapter output." />
            <div className="space-y-2 p-4 pt-0">
                {safeParents.length === 0 ? (
                    <EmptyBox text="No parents match these filters." />
                ) : safeParents.slice(0, 10).map((parent) => (
                    <div key={parent.id} className="grid gap-3 rounded-md border bg-muted/35 p-3 lg:grid-cols-[1fr_150px_220px] lg:items-center">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => onOpenStudio(parent.id)} className="min-w-0 truncate text-left font-medium text-foreground hover:underline" dir="auto">
                                    {parent.title ?? 'Untitled media'}
                                </button>
                                <StatusBadge value={parent.chaptering_status} />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground" dir="auto">{parent.source_name ?? 'Unknown source'}</p>
                            {parent.latest_error && <p className="mt-1 text-xs text-destructive">{parent.latest_error}</p>}
                        </div>
                        <div className="font-mono text-sm tabular-nums text-muted-foreground">
                            <p>{formatDurationSec(parent.duration_sec)}</p>
                            <p>{formatDurationSec(parent.child_duration_sec)} selected</p>
                            <p>{parent.transcript_id ? 'transcript ready' : 'transcript missing'}</p>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center text-xs">
                            <MetricPill label="children" value={parent.child_count} />
                            <MetricPill label="coverage" value={formatCoverage(parent.coverage_percent)} />
                            <MetricPill label="published" value={parent.published_count} />
                            <MetricPill label="review" value={parent.review_count} />
                            <MetricPill label="embed" value={parent.embedding_pending_count} />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function EpisodeControls({
    parents,
    actionsDisabled,
    mutating,
    onDisable,
    onEnable,
    onInherit,
    onAtomize,
    onReatomize,
}: {
    parents: MediaAtomizationParent[];
    actionsDisabled: boolean;
    mutating: boolean;
    onDisable: (id: string) => void;
    onEnable: (id: string) => void;
    onInherit: (id: string) => void;
    onAtomize: (id: string) => void;
    onReatomize: (id: string) => void;
}) {
    const safeParents = Array.isArray(parents) ? parents : [];
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<Scissors className="h-4 w-4 text-[#2CBAC6]" />} title="Episode Controls" sub="One-off overrides and manual queueing. Parents at or under 40m cannot be atomized." />
            <div className="space-y-2 p-4 pt-0">
                {safeParents.length === 0 ? <EmptyBox text="No parent media loaded." /> : safeParents.slice(0, 8).map((parent) => {
                    const tooShort = (parent.duration_sec ?? 0) <= HARD_MAX_SECONDS;
                    const disabled = parent.atomization_override === 'disabled';
                    return (
                        <div key={parent.id} className="grid gap-3 rounded-md border bg-muted/35 p-3 xl:grid-cols-[1fr_180px_390px] xl:items-center">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium" dir="auto">{parent.title ?? 'Untitled media'}</p>
                                <p className="truncate text-xs text-muted-foreground" dir="auto">{parent.source_name ?? 'Unknown source'}</p>
                                {parent.atomization_override_reason && <p className="mt-1 text-xs text-[#D7A83E]">{parent.atomization_override_reason}</p>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <Badge variant="outline">{formatDurationSec(parent.duration_sec)}</Badge>
                                <Badge variant={disabled ? 'secondary' : 'success'}>{parent.atomization_override ?? 'inherit'}</Badge>
                                {parent.manual_atomization_requested_at && <Badge variant="info">manual</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-2 xl:justify-end">
                                <Button size="sm" variant="outline" disabled={actionsDisabled || mutating || disabled} onClick={() => onDisable(parent.id)}>Exclude</Button>
                                <Button size="sm" variant="outline" disabled={actionsDisabled || mutating} onClick={() => onEnable(parent.id)}>Enable</Button>
                                <Button size="sm" variant="outline" disabled={actionsDisabled || mutating} onClick={() => onInherit(parent.id)}>Inherit</Button>
                                <Button size="sm" disabled={actionsDisabled || mutating || tooShort || disabled} onClick={() => onAtomize(parent.id)}>Queue</Button>
                                <Button size="sm" variant="outline" disabled={actionsDisabled || mutating || tooShort || disabled || parent.child_count === 0} onClick={() => onReatomize(parent.id)}>Re-atomize</Button>
                            </div>
                            {tooShort && <p className="xl:col-span-3 text-xs text-muted-foreground">Manual atomization disabled because this parent is at or under 40 minutes.</p>}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function MetricPill({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded bg-background px-2 py-1 font-mono tabular-nums">
            <p className="font-semibold">{value}</p>
            <p className="truncate text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}

function DiagnosticsOrientation({
    liveUnavailable,
    failedApis,
    lastUpdated,
    schemaDegraded,
    missingSchema,
}: {
    liveUnavailable: boolean;
    failedApis: string[];
    lastUpdated?: string;
    schemaDegraded: boolean;
    missingSchema: string[];
}) {
    const locale = useJourneyLocale();
    const ar = locale === 'ar';
    const text = (en: string, arabic: string) => ar ? arabic : en;
    return (
        <section className="rounded-md border bg-muted/20 p-4" aria-labelledby="diagnostics-how-to-use">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="diagnostics-how-to-use" className="flex items-center gap-2 text-base font-semibold">
                        <ShieldCheck className="h-4 w-4 text-[#2CBAC6]" />
                        {text('How to use diagnostics', 'كيف تستخدم التشخيص')}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        {text('This page explains durable evidence and the safe operator response. It is not a second queue and historical failures do not automatically describe the selected episode.', 'تشرح هذه الصفحة الأدلة الموثقة والإجراء الآمن للمشغل. ليست قائمة انتظار ثانية، ولا تعني الإخفاقات التاريخية تلقائياً أن الحلقة المحددة متوقفة.')}
                    </p>
                </div>
                <Badge variant={liveUnavailable || schemaDegraded ? 'warning' : 'outline'}>
                    {liveUnavailable || schemaDegraded ? text('Action needed', 'يتطلب إجراء') : text('Evidence guide', 'دليل الأدلة')}
                </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                    [text('1. Confirm the snapshot', '١. تحقق من اللقطة'), text('If live data is unavailable, refresh before acting on counts or errors.', 'إذا تعذر الوصول إلى البيانات الحية، حدّث الصفحة قبل التصرف بناءً على الأعداد أو الأخطاء.')],
                    [text('2. Open the episode', '٢. افتح الحلقة'), text('Select a failed or reconciling parent to see the current stage, dependency, and allowed action.', 'اختر الحلقة الفاشلة أو قيد التسوية لرؤية المرحلة الحالية والتبعية والإجراء المسموح.')],
                    [text('3. Follow the next action', '٣. اتبع الإجراء التالي'), text('Waiting for a predecessor or capacity means wait or resolve that dependency; it is not an approval request.', 'انتظار المتطلب السابق أو السعة يعني الانتظار أو حل التبعية؛ وليس طلب موافقة.')],
                    [text('4. Recover deliberately', '٤. نفّذ الاسترداد بقصد'), text('Retry only when CMS offers a safe action. Preserve verified work and reconcile uncertain effects first.', 'أعد المحاولة فقط عندما يعرض CMS إجراءً آمناً. حافظ على العمل المتحقق وسوِّ الآثار غير المؤكدة أولاً.'),],
                ].map(([title, description]) => (
                    <div key={title} className="rounded-md border border-border/70 bg-background/60 p-3">
                        <p className="text-sm font-medium">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                ))}
            </div>
            {liveUnavailable && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm">
                <div>
                    <p className="font-medium">{text(`Live data unavailable from: ${failedApis.join(', ')}`, `البيانات الحية غير متاحة من: ${failedApis.join('، ')}`)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{text(`Cached data may be shown${lastUpdated ? `; last successful update: ${new Date(lastUpdated).toLocaleString()}` : ''}. Refresh before retrying or changing policy.`, `قد تظهر بيانات مخزنة${lastUpdated ? `؛ آخر تحديث ناجح: ${new Date(lastUpdated).toLocaleString()}` : ''}. حدّث الصفحة قبل إعادة المحاولة أو تغيير السياسة.`)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.location.reload()}>{text('Refresh live data', 'تحديث البيانات الحية')}</Button>
                    <Link className="inline-flex items-center rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted" href="/platform/system-health">{text('Open System Health', 'فتح صحة النظام')}</Link>
                </div>
            </div>}
            {schemaDegraded && <div className="mt-4 rounded-md border border-[#D7A83E]/40 bg-[#D7A83E]/10 p-3 text-sm">
                <p className="font-medium">{text('CMS schema is incomplete; queue actions are intentionally disabled.', 'مخطط CMS غير مكتمل؛ تم تعطيل إجراءات الإدراج عمداً.')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{schemaDegraded && missingSchema.length ? `${text('Missing', 'المفقود')}: ${missingSchema.slice(0, 6).join(', ')}${missingSchema.length > 6 ? ` +${missingSchema.length - 6}` : ''}. ` : ''}{text('Apply the canonical CMS migration, then refresh this page before operating the pipeline.', 'طبّق ترحيل CMS المعتمد ثم حدّث الصفحة قبل تشغيل خط المعالجة.')}</p>
                <Link className="mt-2 inline-block text-xs font-medium underline" href="/platform/system-health">{text('Check migration status', 'تحقق من حالة الترحيلات')}</Link>
            </div>}
        </section>
    );
}

function runDiagnosticGuidance(status: string, locale: 'en' | 'ar') {
    const ar = locale === 'ar';
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'failed' || normalized.includes('fail')) {
        return ar
            ? 'افتح الحلقة واقرأ المرحلة الفاشلة في التشخيص. أعد المحاولة فقط إذا ظهر إجراء استرداد آمن.'
            : 'Open the episode and read the failed phase in Diagnostics. Retry only if a safe recovery action is offered.';
    }
    if (normalized === 'reconciling' || normalized.includes('uncertain')) {
        return ar
            ? 'انتظر تسوية الأثر غير المؤكد أو افتح الأدلة؛ لا تعِد التنزيل أو القص أثناء التسوية.'
            : 'Wait for the uncertain effect to reconcile or open its evidence; do not redownload or recut during reconciliation.';
    }
    if (normalized === 'running' || normalized === 'processing') {
        return ar
            ? 'اترك التشغيل مستمراً وراجع آخر تقدم مؤكد؛ لا تنشئ طلباً مكرراً.'
            : 'Leave the run active and review its last confirmed progress; do not submit a duplicate request.';
    }
    if (normalized === 'queued' || normalized === 'pending') {
        return ar
            ? 'الطلب مقبول وينتظر التنفيذ؛ حدّث الرحلة بدلاً من إنشاء طلب ثانٍ.'
            : 'The request is admitted and waiting to execute; refresh the journey instead of creating a second request.';
    }
    return ar
        ? 'افتح الحلقة لمقارنة هذه النتيجة بالحالة الحالية قبل بدء استبدال أو إعادة معالجة.'
        : 'Open the episode to compare this result with its current state before starting replacement or reprocessing.';
}

function RunPanel({ runs, onOpenStudio }: { runs: MediaAtomizationRun[]; onOpenStudio: (id: string) => void }) {
    const safeRuns = Array.isArray(runs) ? runs : [];
    const locale = useJourneyLocale();
    const ar = locale === 'ar';
    return (
        <section className="rounded-md border bg-card">
            <SectionHeader icon={<RefreshCw className="h-4 w-4 text-[#2CBAC6]" />} title="Run Diagnostics" sub="Latest atomization attempts and failure phases." />
            <div className="space-y-2 p-4 pt-0">
                {safeRuns.length === 0 ? (
                    <EmptyBox text="No atomization runs recorded." />
                ) : safeRuns.slice(0, 8).map((run) => (
                    <div key={run.id} className="grid gap-2 rounded-md border bg-muted/35 p-3 sm:grid-cols-[1fr_130px_92px] sm:items-center">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={run.status} />
                                <Badge variant="outline">{run.phase}</Badge>
                                <span className="text-xs text-muted-foreground">{run.child_count} children · {run.review_count} review</span>
                            </div>
                            {run.error_message && <p className="mt-1 line-clamp-2 text-xs text-destructive">{run.error_message}</p>}
                            <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">{ar ? 'الإجراء التالي' : 'Next action'}:</span> {runDiagnosticGuidance(run.status, locale)}</p>
                        </div>
                        <p className="font-mono text-sm tabular-nums text-muted-foreground">{run.started_at ? new Date(run.started_at).toLocaleTimeString() : 'not started'}</p>
                        <Button size="sm" variant="outline" onClick={() => onOpenStudio(run.parent_content_item_id)}>
                            Open
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function StudioContextStrip({
    context,
    loading,
}: {
    context?: MediaAtomizationParentContext;
    loading: boolean;
}) {
    if (loading) {
        return <TabLoading label="Loading studio context" />;
    }
    if (!context?.parent) {
        return null;
    }
    const latestRun = context.recent_runs?.[0];
    return (
        <section className="rounded-md border bg-muted/25 p-3">
            <div className="grid gap-3 md:grid-cols-4">
                <MetricPill label="policy" value={context.policy_source ?? 'tenant'} />
                <MetricPill label="children" value={context.children?.length ?? 0} />
                <MetricPill label="runs" value={context.recent_runs?.length ?? 0} />
                <MetricPill label="latest" value={latestRun?.status ?? 'no run'} />
            </div>
            {(context.atomization_disabled_reason || context.selected_chapter) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {context.atomization_disabled_reason && (
                        <Badge variant="secondary">{context.atomization_disabled_reason}</Badge>
                    )}
                    {context.selected_chapter && (
                        <Badge variant="warning">Selected: {context.selected_chapter.title}</Badge>
                    )}
                </div>
            )}
        </section>
    );
}

function SectionHeader({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
    return (
        <div className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
            </div>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
    );
}

function SectionHeaderInner({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
    return (
        <div>
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
            </div>
            {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
    );
}

function EmptyBox({ text }: { text: string }) {
    return <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">{text}</div>;
}

export function MediaAtomizationDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filters = useMemo(() => readFilters(searchParams), [searchParams]);
    const activeTab = useMemo(() => readMissionTab(searchParams), [searchParams]);
    const publishActive = activeTab === 'publish';
    const workflowActive = activeTab === 'workflow';
    const boardActive = workflowActive && searchParams.get('view') === 'board';
    const reviewActive = activeTab === 'review';
    const studioActive = activeTab === 'studio';
    const policyActive = activeTab === 'policy';
    const diagnosticsActive = activeTab === 'diagnostics';
    const selectedStudioItem = searchParams.get('item');
    const selectedStudioChapter = searchParams.get('chapter');
    const [policyControlsOpen, setPolicyControlsOpen] = useState(!selectedStudioItem);
    const [diagnosticsHistoryOpen, setDiagnosticsHistoryOpen] = useState(!selectedStudioItem);
    const loadPolicyControls = policyActive && policyControlsOpen;
    const loadDiagnosticsHistory = diagnosticsActive && diagnosticsHistoryOpen;

    const overview = useMediaAtomizationOverview({ enabled: boardActive || reviewActive || loadPolicyControls || loadDiagnosticsHistory });
    const policy = useMediaAtomizationPolicy({ enabled: loadPolicyControls });
    const sources = useMediaAtomizationSources({ enabled: loadPolicyControls });
    const pipeline = useMediaAtomizationPipeline(filters, { enabled: boardActive || loadDiagnosticsHistory });
    const parentFilters = useMemo(() => ({ ...filters, review: filters.review === 'needed' ? undefined : filters.review }), [filters]);
    const chapterFilters = useMemo(() => ({ ...filters, parent_id: selectedStudioItem ?? undefined, review: filters.review ?? 'needed' }), [filters, selectedStudioItem]);
    const feedUnitMapFilters = useMemo(() => ({ source: filters.source, q: filters.q }), [filters.source, filters.q]);
    const feedUnitLedgerFilters = useMemo(() => ({ path: filters.path, source: filters.source, q: filters.q }), [filters.path, filters.source, filters.q]);
    const feedUnitMap = useMediaAtomizationFeedUnits(feedUnitMapFilters, { enabled: false });
    const feedUnitLedger = useMediaAtomizationFeedUnits(feedUnitLedgerFilters, { enabled: false });
    const parents = useMediaAtomizationParents(parentFilters, { enabled: loadPolicyControls || loadDiagnosticsHistory || studioActive });
    const studioContext = useMediaAtomizationParentContext(selectedStudioItem, { enabled: studioActive && Boolean(selectedStudioItem) });
    const chapters = useMediaAtomizationChapters(chapterFilters, { enabled: reviewActive });
    const runs = useMediaAtomizationRuns({ enabled: loadDiagnosticsHistory });
    const approve = useApproveAtomizedChapter();
    const reject = useRejectAtomizedChapter();
    const repairLeaks = useRepairMediaAtomizationLeaks();
    const runSweep = useRunMediaAtomizationSweep();
    const updatePolicy = useUpdateMediaAtomizationPolicy();
    const updateSourcePolicy = useUpdateMediaAtomizationSourcePolicy();
    const updateParentOverride = useUpdateMediaAtomizationParentOverride();
    const atomizeParent = useAtomizeMediaParent();
    const reatomizeParent = useReatomizeMediaParent();
    const triggerStt = useTriggerStt();

    const setFilter = (key: keyof AtomizationFilters, value?: string) => {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        if (value && value !== 'all') params.set(key, value);
        else params.delete(key);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    const setTab = (tab: MissionTab) => {
        if (!window.dispatchEvent(new Event('media-studio:navigate', { cancelable: true }))) return;
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('tab', tab);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    const openStudio = (id: string, chapterId?: string) => {
        if (!window.dispatchEvent(new Event('media-studio:navigate', { cancelable: true }))) return;
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('tab', 'studio');
        params.set('item', id);
        if (chapterId) params.set('chapter', chapterId);
        else params.delete('chapter');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };
    const resetFilters = () => { const params = new URLSearchParams(searchParams.toString()); Object.keys(filters).forEach(key => params.delete(key)); router.replace(`${pathname}?${params}`, { scroll: false }); };

    const failedApis = [
        (boardActive || reviewActive || loadPolicyControls || loadDiagnosticsHistory) && overview.isError && 'overview',
        loadPolicyControls && policy.isError && 'policy',
        loadPolicyControls && sources.isError && 'sources',
        publishActive && feedUnitMap.isError && 'publication map',
        publishActive && feedUnitLedger.isError && 'publication ledger',
        boardActive && pipeline.isError && 'pipeline',
        (loadPolicyControls || loadDiagnosticsHistory || studioActive) && parents.isError && 'parents',
        reviewActive && chapters.isError && 'chapters',
        studioActive && studioContext.isError && 'studio context',
        loadDiagnosticsHistory && runs.isError && 'runs',
    ].filter(Boolean) as string[];
    const failed = failedApis.length > 0;
    const publishLoading = publishActive && (feedUnitMap.isLoading || feedUnitLedger.isLoading);
    const workflowLoading = boardActive && pipeline.isLoading;
    const reviewLoading = reviewActive && chapters.isLoading;
    const policyLoading = policyActive && (policy.isLoading || sources.isLoading || parents.isLoading);
    const studioLoading = studioActive && (parents.isLoading || studioContext.isLoading);
    const diagnosticsLoading = diagnosticsActive && (runs.isLoading || parents.isLoading);
    const loading = overview.isLoading || policyLoading || publishLoading || workflowLoading || reviewLoading || studioLoading || diagnosticsLoading;
    const overviewData = overview.data;
    const parentRows = parents.data ?? [];
    const chapterRows = chapters.data ?? [];
    const schemaStatus = overviewData?.schema_status ?? pipeline.data?.schema_status;
    const schemaDegraded = schemaStatus?.ready === false;
    const missingSchema = schemaStatus?.missing ?? [];
    const durationViolations = overviewData?.duration_violation_count ?? 0;
    const lastUpdated = pipeline.data?.updated_at ?? overviewData?.updated_at;
    const actionsDisabled = Boolean(schemaDegraded);
    const resolvedStudioItem = studioContext.data?.parent?.id ?? selectedStudioItem;
    const resolvedStudioChapter = selectedStudioChapter
        ?? studioContext.data?.selected_chapter?.id
        ?? studioContext.data?.selected_child?.id
        ?? null;

    return (
        <div className="space-y-5 text-foreground">
            {((!workflowActive && !policyActive && !diagnosticsActive) || boardActive) && <>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <span className="brand-overline text-[#D7A83E]">Pods Media</span>
                    <h1 className="text-2xl font-semibold">Media Studio</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                        Command center for atomization, transcript readiness, chapter cuts, Pods publication, and duration policy violations.
                    </p>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                    <MediaJourneyGuide />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Waiting for data'}</span>
                        {failed && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> stale</span>}
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runSweep.mutate()}
                        disabled={runSweep.isPending || actionsDisabled}
                    >
                        {runSweep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Queue eligible parents
                    </Button>
                </div>
            </div>

            <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />
            </>}

            {(failed || schemaDegraded) && !diagnosticsActive && (
                <div className={cn(
                    'rounded-md border p-3 text-sm',
                    failed ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-[#D7A83E]/40 bg-[#D7A83E]/10 text-foreground'
                )}>
                    <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        {failed ? `Live data unavailable from: ${failedApis.join(', ')}` : 'Atomization schema is incomplete.'}
                    </div>
                    <p className="mt-1">
                        {failed
                            ? `Showing cached data where available. Last successful update: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'not available'}.`
                            : schemaStatus?.message ?? 'CMS is serving degraded inventory until migrations are applied.'}
                    </p>
                    {schemaDegraded && missingSchema.length > 0 && (
                        <p className="mt-1 text-xs">
                            Missing: {missingSchema.slice(0, 6).join(', ')}{missingSchema.length > 6 ? ` +${missingSchema.length - 6} more` : ''}
                        </p>
                    )}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={(value) => setTab(value as MissionTab)} className="space-y-5">
                <div className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                    <TabsList className="w-max justify-start">
                        {missionTabs.map((tab) => (
                            <TabsTrigger key={tab} value={tab}>
                                {missionTabLabel(tab)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="publish" className="space-y-5">
                    {activeTab === 'publish' && (
                    <PublishedJourney filters={filters} />
                    )}
                </TabsContent>

                <TabsContent value="workflow" className="space-y-5">
                    {activeTab === 'workflow' && (
                    <>
                        {boardActive && <div className="flex gap-2">{['list', 'board'].map(view => <Button key={view} size="sm" variant={view === 'board' ? 'default' : 'outline'} onClick={() => { const next = new URLSearchParams(searchParams.toString()); next.set('view', view); router.push(`${pathname}?${next}`, { scroll: false }); }}>{view === 'list' ? 'List' : 'Board'}</Button>)}</div>}
                        {boardActive ? <AtomizationRail pipeline={pipeline.data} revision={pipeline.dataUpdatedAt} filters={filters} onOpenStudio={openStudio} /> : <MediaJourneyList filters={filters} actions={item => <JourneyActions item={item} compact />} />}
                    </>
                    )}
                </TabsContent>

                <TabsContent value="review" className="space-y-5">
                    {activeTab === 'review' && (
                    <>
                        {selectedStudioItem && <EpisodeJourney id={selectedStudioItem} actions={item => <JourneyActions item={item} />} />}
                        {reviewLoading && !chapters.data && <TabLoading label="Loading review queue" />}
                        <SummaryStrip>
                            <KpiCard label="Needs review" value={overviewData?.review_needed_count ?? 0} tone="warn" />
                            <KpiCard label="Short cuts in review" value={overviewData?.short_chapter_review_count ?? 0} sub="merge/edit" tone="warn" />
                            <KpiCard label="Invalid visible" value={publicationPathCount(overviewData, 'invalid')} tone={publicationPathCount(overviewData, 'invalid') > 0 ? 'bad' : 'ok'} />
                            <KpiCard label="Embedding pending" value={childVisibilityCount(overviewData, 'embedding_pending')} />
                        </SummaryStrip>
                        <ReviewQueue
                            chapters={chapterRows}
                            approving={approve.isPending}
                            rejecting={reject.isPending}
                            actionsDisabled={actionsDisabled}
                            onOpenStudio={openStudio}
                            onApprove={(id) => approve.mutate(id)}
                            onReject={(id) => reject.mutate(id)}
                        />
                    </>
                    )}
                </TabsContent>

                <TabsContent value="studio" className="space-y-5">
                    {activeTab === 'studio' && (
                    <>
                        <SummaryStrip>
                            <KpiCard label="Review pressure" value={overviewData?.review_needed_count ?? 0} sub="chapters" tone="warn" />
                            <KpiCard label="Awaiting transcript" value={pipeline.data?.columns.find(c => c.key === 'transcript')?.count ?? 0} sub="parents" />
                            <KpiCard label="Published in Pods" value={
                                publicationPathCount(overviewData, 'atomized')
                                + publicationPathCount(overviewData, 'direct_transcript')
                                + publicationPathCount(overviewData, 'direct_no_transcript')
                            } tone="ok" />
                            <KpiCard label="Failed or reconciling" value={pipeline.data?.columns.find(c => c.key === 'failed')?.count ?? 0} tone="bad" />
                        </SummaryStrip>
                        <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)]">
                            <section className="rounded-md border bg-card">
                                <SectionHeader icon={<Scissors className="h-4 w-4 text-[#D7A83E]" />} title="Studio Queue" sub="Pick a parent from the atomization workspace, or open recent parent media here." />
                                <div className="space-y-2 p-4 pt-0">
                                    {studioLoading && <TabLoading label="Loading parent media" />}
                                    {!studioLoading && parentRows.length === 0 ? (
                                        <EmptyBox text="No parent media matches the current filters." />
                                    ) : parentRows.slice(0, 12).map((parent) => (
                                        <button
                                            key={parent.id}
                                            type="button"
                                            onClick={() => openStudio(parent.id)}
                                            className={cn(
                                                'w-full rounded-md border bg-muted/35 p-3 text-left transition hover:border-[#2CBAC6] hover:bg-card focus:outline-none focus:ring-2 focus:ring-[#2CBAC6]',
                                                resolvedStudioItem === parent.id && 'border-[#2CBAC6] bg-card'
                                            )}
                                        >
                                            <p className="line-clamp-2 text-sm font-medium" dir="auto">{parent.title ?? 'Untitled media'}</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                <Badge variant="outline">{formatDurationSec(parent.duration_sec)}</Badge>
                                                <StatusBadge value={parent.chaptering_status} />
                                                <Badge variant={parent.transcript_id ? 'success' : 'warning'}>{parent.transcript_id ? 'transcript' : 'no transcript'}</Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section className="min-w-0 rounded-md border bg-card p-4">
                                {selectedStudioItem ? (
                                    <div className="space-y-4">
                                        <StudioContextStrip context={studioContext.data} loading={studioContext.isLoading} />
                                        {resolvedStudioItem ? (
                                            <><EpisodeJourney key={resolvedStudioItem} id={resolvedStudioItem} actions={item => <JourneyActions item={item} />} /><MediaStudioWorkbench
                                                key={resolvedStudioItem}
                                                id={resolvedStudioItem}
                                                selectedChapterId={resolvedStudioChapter}
                                                compact
                                            /></>
                                        ) : (
                                            <TabLoading label="Resolving selected media" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        Select a media item from Publish, Workflow, Review, Diagnostics, or the Studio queue to edit transcripts and chapters here.
                                    </div>
                                )}
                            </section>
                        </div>
                    </>
                    )}
                </TabsContent>

                <TabsContent value="autopilot" className="space-y-5">
                    {activeTab === 'autopilot' && <StudioAutopilotPanel />}
                </TabsContent>

                <TabsContent value="policy" className="space-y-5">
                    {activeTab === 'policy' && (
                    <>
                        <EpisodeContextTab id={selectedStudioItem} mode="policy" />
                        <details open={policyControlsOpen} onToggle={event => setPolicyControlsOpen(event.currentTarget.open)} className="rounded-md border bg-card p-4">
                        <summary className="cursor-pointer font-semibold">Tenant defaults, source overrides, and episode exceptions</summary>
                        {policyControlsOpen && <div className="mt-4 space-y-5">
                        <p className="text-sm text-muted-foreground">These controls cover the tenant and the listed sources or episodes, not only the selected episode. Existing verified media is preserved; policy changes do not apply chapter drafts.</p>
                        <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />
                        {policyLoading && !policy.data && !sources.data && !parents.data && <TabLoading label="Loading policy controls" />}
                        <SummaryStrip>
                            <KpiCard label="Excluded episodes" value={overviewData?.disabled_episode_count ?? 0} sub="manual opt-outs" />
                            <KpiCard label="Excluded sources" value={overviewData?.disabled_source_count ?? 0} sub="source opt-outs" />
                            <KpiCard label="Manual requests" value={overviewData?.manual_requested_count ?? 0} sub="queued by admins" />
                            <KpiCard label="Atomize only" value={`>${Math.round(((overviewData?.policy?.atomization_min_parent_seconds ?? HARD_MAX_SECONDS) / 60))}m`} />
                        </SummaryStrip>
                        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                            <PolicyEditor
                                policy={policy.data}
                                saving={updatePolicy.isPending}
                                onPatch={(patch) => { if (window.confirm(`Change tenant defaults: ${Object.entries(patch).map(([key, value]) => `${key} = ${value}`).join(', ')}? This affects all inheriting episodes. It does not recut existing media or apply a chapter draft.`)) updatePolicy.mutate(patch); }}
                            />
                            <SourceOverrides
                                sources={sources.data ?? []}
                                saving={updateSourcePolicy.isPending}
                                onToggle={(source) => updateSourcePolicy.mutate({
                                    sourceId: source.id,
                                    patch: { chaptering_enabled: !source.chaptering_enabled },
                                })}
                            />
                        </div>
                        <EpisodeControls
                            parents={parentRows}
                            actionsDisabled={actionsDisabled}
                            mutating={updateParentOverride.isPending || atomizeParent.isPending || reatomizeParent.isPending}
                            onDisable={(id) => updateParentOverride.mutate({ parentId: id, override: 'disabled', reason: 'Excluded manually from Atomization dashboard.' })}
                            onEnable={(id) => updateParentOverride.mutate({ parentId: id, override: 'enabled' })}
                            onInherit={(id) => updateParentOverride.mutate({ parentId: id, override: 'inherit' })}
                            onAtomize={(id) => atomizeParent.mutate(id)}
                            onReatomize={(id) => reatomizeParent.mutate(id)}
                        />
                        </div>}
                        </details>
                    </>
                    )}
                </TabsContent>

                <TabsContent value="diagnostics" className="space-y-5">
                    {activeTab === 'diagnostics' && (
                    <>
                        <DiagnosticsOrientation
                            liveUnavailable={failed}
                            failedApis={failedApis}
                            lastUpdated={lastUpdated}
                            schemaDegraded={schemaDegraded}
                            missingSchema={missingSchema}
                        />
                        <EpisodeContextTab id={selectedStudioItem} mode="diagnostics" />
                        <details open={diagnosticsHistoryOpen} onToggle={event => setDiagnosticsHistoryOpen(event.currentTarget.open)} className="rounded-md border bg-card p-4">
                        <summary className="cursor-pointer font-semibold">Tenant diagnostics and historical runs</summary>
                        {diagnosticsHistoryOpen && <div className="mt-4 space-y-5">
                        <p className="text-sm text-muted-foreground">Broader operational reports. Historical failed runs do not mean the selected episode is currently failing. Use its journey above for current state.</p>
                        <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />
                        {diagnosticsLoading && !runs.data && !parents.data && <TabLoading label="Loading diagnostics" />}
                        <SummaryStrip>
                            <KpiCard label="Avg chapters" value={(overviewData?.average_chapters_per_parent ?? 0).toFixed(1)} sub="per parent" />
                            <KpiCard label="Avg run time" value={formatSeconds(overviewData?.average_processing_seconds)} sub="completed runs" />
                            <KpiCard label="Duration violations" value={durationViolations} sub="visible units" tone={durationViolations > 0 ? 'bad' : 'ok'} />
                            <KpiCard label="Failed or reconciling" value={pipeline.data?.columns.find(c => c.key === 'failed')?.count ?? 0} tone="bad" />
                        </SummaryStrip>
                        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                            <RunPanel runs={runs.data ?? []} onOpenStudio={openStudio} />
                            <SourcePerformance overview={overviewData} />
                        </div>
                        <div className="grid gap-5 xl:grid-cols-2">
                            <DurationDistribution overview={overviewData} />
                            <ParentLifecycle parents={parentRows} onOpenStudio={openStudio} />
                        </div>
                        </div>}
                        </details>
                    </>
                    )}
                </TabsContent>
            </Tabs>

            {loading && !overviewData && !pipeline.data && (
                <div className="flex items-center justify-center rounded-md border p-8 text-sm text-muted-foreground">
                    <Clock3 className="mr-2 h-4 w-4" /> Loading atomization state
                </div>
            )}
        </div>
    );
}
