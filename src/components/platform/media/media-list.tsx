'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from '@/lib/console-link';
import { useRouter } from '@/lib/navigation';
import {
    Loader2, Sparkles, Search, MoreHorizontal, SlidersHorizontal, RefreshCw,
    Clapperboard, Trash2, Copy, ExternalLink, ArrowUpDown, Rss, Layers, ChevronRight, ChevronDown,
    ShieldCheck, X, LayoutGrid, List, HardDrive, Download,
} from 'lucide-react';

import {
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useContent, useDeleteContentByIds, useMediaSizeStats } from '@/hooks/use-content';
import {
    useBulkTriggerStt,
    useCancelTranscriptionBatch,
    useTranscriptionBatches,
    useTriggerStt,
} from '@/hooks/use-transcription';
import { listSourceNames } from '@/lib/api/cms/content';
import { useBulkRequestMediaAcquisition, useRequestMediaAcquisition } from '@/hooks/use-media-acquisition';
import {
    CAPTION_STATE_LABELS, CAPTION_STATE_VARIANTS, CONTENT_STATUS_LABELS, CONTENT_STATUS_VARIANTS,
    type CaptionState, type ContentItem, type ContentStatus, type ContentType, type ListContentParams,
    type TranscriptQualityStatus, type TranscriptionJobStatus, type TranscriptQualitySummary,
    type TranscriptionJobSummary,
} from '@/types/platform/content';

function formatDuration(sec?: number): string {
    if (!sec || sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes?: number, emptyLabel = 'Untracked'): string {
    if (!bytes || bytes <= 0) return emptyLabel;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const precision = value >= 10 || unit === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[unit]}`;
}

function captionStateOf(item: ContentItem): CaptionState {
    if (item.caption_state) return item.caption_state;
    return item.has_transcript ? 'stt_done' : 'none';
}

const UNKNOWN_SOURCE = 'Unknown source';
const STT_ESTIMATED_COST_PER_HOUR_USD = 0.26;
const STATUS_OPTIONS: (ContentStatus | 'all')[] = ['all', 'READY', 'PROCESSING', 'FAILED', 'PENDING'];
const CAPTION_FILTERS: { value: CaptionState | 'all'; label: string }[] = [
    { value: 'all', label: 'All transcripts' },
    { value: 'youtube_auto', label: '⚠️ Needs enrichment' },
    { value: 'youtube_human', label: 'Human caption' },
    { value: 'stt_done', label: 'STT transcript' },
];
const ACQUISITION_FILTERS = [
    { value: 'all', label: 'All acquisition states' },
    { value: 'awaiting_download', label: 'Awaiting download' },
    { value: 'queued', label: 'Queued' },
    { value: 'downloading', label: 'Downloading' },
    { value: 'preparing', label: 'Preparing media' },
    { value: 'ready', label: 'Media ready' },
    { value: 'reconciling', label: 'Reconciling' },
    { value: 'failed', label: 'Acquisition failed' },
] as const;
const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest', sort: 'published_at', order: 'desc' as const },
    { value: 'oldest', label: 'Oldest', sort: 'published_at', order: 'asc' as const },
    { value: 'longest', label: 'Longest', sort: 'duration_sec', order: 'desc' as const },
    { value: 'shortest', label: 'Shortest', sort: 'duration_sec', order: 'asc' as const },
    { value: 'largest', label: 'Largest file', sort: 'file_size_bytes', order: 'desc' as const },
    { value: 'smallest', label: 'Smallest file', sort: 'file_size_bytes', order: 'asc' as const },
    { value: 'title', label: 'Title A–Z', sort: 'title', order: 'asc' as const },
];
type SizeFilterValue = 'all' | 'untracked' | 'lt_100mb' | '100_500mb' | '500mb_1gb' | '1_2gb' | 'gt_2gb';
const MB = 1024 * 1024;
const GB = 1024 * MB;
const LARGE_MEDIA_WARNING_BYTES = 500 * MB;
const SIZE_FILTERS: {
    value: SizeFilterValue;
    label: string;
    min?: number;
    max?: number;
    sizeTracked?: 'tracked' | 'untracked' | 'all';
}[] = [
    { value: 'all', label: 'All sizes', sizeTracked: 'all' },
    { value: 'untracked', label: 'Untracked', sizeTracked: 'untracked' },
    { value: 'lt_100mb', label: '<100 MB', min: 1, max: 100 * MB - 1, sizeTracked: 'tracked' },
    { value: '100_500mb', label: '100-500 MB', min: 100 * MB, max: 500 * MB - 1, sizeTracked: 'tracked' },
    { value: '500mb_1gb', label: '500 MB-1 GB', min: 500 * MB, max: GB - 1, sizeTracked: 'tracked' },
    { value: '1_2gb', label: '1-2 GB', min: GB, max: 2 * GB - 1, sizeTracked: 'tracked' },
    { value: 'gt_2gb', label: '>2 GB', min: 2 * GB, sizeTracked: 'tracked' },
];
type JobFilterValue = TranscriptionJobStatus | 'auto_repair_queued' | 'all';

const JOB_FILTERS: { value: JobFilterValue; label: string }[] = [
    { value: 'all', label: 'All jobs' },
    { value: 'auto_repair_queued', label: 'Auto repair queued' },
    { value: 'queued', label: 'Queued' },
    { value: 'running', label: 'Running' },
    { value: 'failed', label: 'Failed' },
    { value: 'writeback_failed', label: 'Writeback failed' },
    { value: 'canceled', label: 'Canceled' },
];
const QUALITY_FILTERS: { value: TranscriptQualityStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All quality' },
    { value: 'needs_review', label: 'Needs review' },
    { value: 'auto_repair', label: 'Auto repair' },
    { value: 'ok', label: 'OK' },
];
const JOB_STATUS_LABELS: Record<TranscriptionJobStatus, string> = {
    queued: 'Queued',
    running: 'Running',
    skipped: 'Skipped',
    succeeded: 'Succeeded',
    failed: 'Failed',
    writeback_failed: 'Writeback failed',
    canceled: 'Canceled',
};
const JOB_STATUS_VARIANTS: Record<
    TranscriptionJobStatus,
    'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'
> = {
    queued: 'secondary',
    running: 'info',
    skipped: 'outline',
    succeeded: 'success',
    failed: 'destructive',
    writeback_failed: 'destructive',
    canceled: 'outline',
};
const QUALITY_STATUS_LABELS: Record<TranscriptQualityStatus, string> = {
    ok: 'OK',
    needs_review: 'Needs review',
    auto_repair: 'Auto repair',
};
const QUALITY_STATUS_VARIANTS: Record<
    TranscriptQualityStatus,
    'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'
> = {
    ok: 'success',
    needs_review: 'warning',
    auto_repair: 'destructive',
};

function formatUsd(value?: number): string {
    if (!value || value <= 0) return '$0.00';
    return `$${value.toFixed(2)}`;
}

function formatDateShort(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderQualitySummary(quality?: TranscriptQualitySummary) {
    if (!quality) return <span className="text-xs text-muted-foreground">Not scored</span>;
    const issueLabel = quality.issue_codes.length
        ? `${quality.issue_codes.length} issue${quality.issue_codes.length === 1 ? '' : 's'}`
        : 'No issues';
    return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={QUALITY_STATUS_VARIANTS[quality.status]}>
                {QUALITY_STATUS_LABELS[quality.status]} · {Math.round(quality.score * 100)}%
            </Badge>
            <span className="text-xs text-muted-foreground">{issueLabel}</span>
        </div>
    );
}

function renderJobSummary(job?: TranscriptionJobSummary) {
    if (!job) return <span className="text-xs text-muted-foreground">No jobs yet</span>;
    const reason = job.error_message || job.skip_reason;
    const cost = job.actual_cost_usd > 0
        ? formatUsd(job.actual_cost_usd)
        : job.reserved_cost_usd > 0
            ? `${formatUsd(job.reserved_cost_usd)} reserved`
            : formatUsd(job.estimated_cost_usd);
    return (
        <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={JOB_STATUS_VARIANTS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                {job.provider && <span className="text-muted-foreground">{job.provider}</span>}
            </div>
            <div className="text-muted-foreground">
                {formatDateShort(job.completed_at || job.started_at || job.created_at)} · {cost}
            </div>
            {job.writeback_status && (
                <div className="text-muted-foreground">
                    Writeback: {job.writeback_status}
                    {job.writeback_error ? ` · ${job.writeback_error}` : ''}
                </div>
            )}
            {reason && <div className="line-clamp-2 max-w-44 text-muted-foreground" title={reason}>{reason}</div>}
        </div>
    );
}

function estimateSttCost(items: ContentItem[]): number {
    return items.reduce((sum, item) => sum + ((item.duration_sec ?? 0) / 3600) * STT_ESTIMATED_COST_PER_HOUR_USD, 0);
}

export function MediaList({ type }: { type: ContentType }) {
    const router = useRouter();

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ContentStatus | 'all'>('all');
    const [captionFilter, setCaptionFilter] = useState<CaptionState | 'all'>('all');
    const [acquisitionFilter, setAcquisitionFilter] = useState<(typeof ACQUISITION_FILTERS)[number]['value']>('all');
    const [jobFilter, setJobFilter] = useState<JobFilterValue>('all');
    const [qualityFilter, setQualityFilter] = useState<TranscriptQualityStatus | 'all'>('all');
    const [sizeFilter, setSizeFilter] = useState<SizeFilterValue>('all');
    const [source, setSource] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortValue, setSortValue] = useState('newest');
    const [groupBy, setGroupBy] = useState(true);
    const [view, setView] = useState<'gallery' | 'table'>('gallery');
    const [sourceNames, setSourceNames] = useState<string[]>([]);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [sttConfirm, setSttConfirm] = useState<ContentItem[] | null>(null);
    const [acquisitionConfirm, setAcquisitionConfirm] = useState<ContentItem[] | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<ContentItem[] | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const triggerStt = useTriggerStt();
    const bulkTriggerStt = useBulkTriggerStt();
    const cancelBatch = useCancelTranscriptionBatch();
    const { data: activeBatches } = useTranscriptionBatches({ status: 'active', limit: 5 });
    const deleteByIds = useDeleteContentByIds();
    const requestAcquisition = useRequestMediaAcquisition();
    const bulkRequestAcquisition = useBulkRequestMediaAcquisition();

    const activeBatch = activeBatches?.data[0];
    const batchRunning = activeBatch?.status === 'queued' || activeBatch?.status === 'running';
    const activeBatchRunningCount = activeBatch
        ? Math.max(0, activeBatch.accepted_count - activeBatch.completed_count - activeBatch.failed_count - activeBatch.canceled_count)
        : 0;

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
        setSelected(new Set());
    }, [type, search, status, captionFilter, acquisitionFilter, jobFilter, qualityFilter, sizeFilter, source, dateFrom, dateTo, sortValue, groupBy]);

    useEffect(() => {
        listSourceNames().then(setSourceNames).catch(() => setSourceNames([]));
    }, []);

    const sortOpt = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0];
    // When grouping, sort by source first so same-source items cluster, then by
    // the chosen within-group order (multi-sort: the CMS parser pairs them).
    const sortParam = groupBy ? `source_name,${sortOpt.sort}` : sortOpt.sort;
    const orderParam = groupBy ? `asc,${sortOpt.order}` : sortOpt.order;
    const sizeOpt = SIZE_FILTERS.find((option) => option.value === sizeFilter) ?? SIZE_FILTERS[0];

    // Published-date range as CMS operator filters (repeated published_at= keys).
    const publishedRange = useMemo(() => [
        dateFrom ? `gte:${dateFrom}T00:00:00Z` : '',
        dateTo ? `lte:${dateTo}T23:59:59Z` : '',
    ].filter(Boolean), [dateFrom, dateTo]);

    const contentFilters = useMemo<ListContentParams>(() => ({
            type,
            search: search || undefined,
            published_at: publishedRange.length ? publishedRange : undefined,
            status: status === 'all' ? undefined : status,
            caption_state: captionFilter === 'all' ? undefined : captionFilter,
            media_acquisition_state: acquisitionFilter === 'all' ? undefined : acquisitionFilter,
            transcription_status: jobFilter === 'all'
                ? undefined
                : jobFilter === 'auto_repair_queued'
                    ? 'queued'
                    : jobFilter,
            transcription_trigger: jobFilter === 'auto_repair_queued' ? 'auto_quality' : undefined,
            quality_status: qualityFilter === 'all' ? undefined : qualityFilter,
            source_name: source === 'all' ? undefined : source,
            min_size_bytes: sizeOpt.min,
            max_size_bytes: sizeOpt.max,
            size_tracked: sizeOpt.sizeTracked === 'all' ? undefined : sizeOpt.sizeTracked,
        }), [
            type,
            search,
            publishedRange,
            status,
            captionFilter,
            acquisitionFilter,
            jobFilter,
            qualityFilter,
            source,
            sizeOpt.min,
            sizeOpt.max,
            sizeOpt.sizeTracked,
        ]);

    const { data, isLoading } = useContent(
        {
            ...contentFilters,
            page,
            limit: groupBy ? 50 : 20,
            sort: sortParam,
            order: orderParam,
        },
        { paused: bulkBusy }
    );
    const mediaSizeStats = useMediaSizeStats(contentFilters, { paused: bulkBusy });

    const items = useMemo(() => data?.data ?? [], [data?.data]);
    const total = data?.total ?? 0;
    const totalPages = data?.total_pages ?? 1;

    // Ordered groups (items already arrive clustered by source from the sort).
    const groups = useMemo(() => {
        const map = new Map<string, ContentItem[]>();
        for (const it of items) {
            const key = it.source_name || UNKNOWN_SOURCE;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(it);
        }
        return Array.from(map.entries());
    }, [items]);

    const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
    const selectedBytes = selectedItems.reduce((sum, item) => sum + Math.max(0, item.file_size_bytes ?? 0), 0);
    const selectedUntracked = selectedItems.filter((item) => !item.file_size_bytes || item.file_size_bytes <= 0).length;
    const sttConfirmBytes = (sttConfirm ?? []).reduce((sum, item) => sum + Math.max(0, item.file_size_bytes ?? 0), 0);
    const sttConfirmUntracked = (sttConfirm ?? []).filter((item) => !item.file_size_bytes || item.file_size_bytes <= 0).length;
    const sttConfirmEstimatedCost = estimateSttCost(sttConfirm ?? []);
    const acquisitionDuration = (acquisitionConfirm ?? []).reduce((sum, item) => sum + Math.max(0, item.duration_sec ?? 0), 0);
    const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

    const setMany = (ids: string[], on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
            return next;
        });
    const toggleAll = () => setMany(items.map((i) => i.id), !allSelected);
    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleCollapse = (src: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(src)) next.delete(src);
            else next.add(src);
            return next;
        });

    const runStt = async (targets: ContentItem[]) => {
        setSttConfirm(null);
        if (targets.length === 1) {
            triggerStt.mutate(targets[0].id);
            return;
        }
        setBulkBusy(true);
        await bulkTriggerStt.mutateAsync(targets.map((t) => t.id)).catch(() => undefined);
        setBulkBusy(false);
        setSelected(new Set());
    };

    const runDelete = (targets: ContentItem[]) => {
        setDeleteConfirm(null);
        deleteByIds.mutate(targets.map((t) => t.id));
        setSelected(new Set());
    };

    const runAcquisition = async (targets: ContentItem[]) => {
        setAcquisitionConfirm(null);
        if (targets.length === 1) {
            requestAcquisition.mutate(targets[0].id);
            return;
        }
        setBulkBusy(true);
        await bulkRequestAcquisition.mutateAsync(targets.map((item) => item.id)).catch(() => undefined);
        setBulkBusy(false);
        setSelected(new Set());
    };

    const copyId = (id: string) => {
        navigator.clipboard?.writeText(id);
        toast({ title: 'ID copied', variant: 'success' });
    };

    const colSpan = 8;

    /** Row/card actions — shared between the table and gallery views. */
    const renderActions = (item: ContentItem, triggerClassName?: string) => {
        const state = captionStateOf(item);
        const hasMedia = !!item.media_url;
        const isReT = state === 'stt_done' || state === 'youtube_human';
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn('h-8 w-8', triggerClassName)} aria-label="Item actions">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => router.push(`/platform/media/atomization?tab=studio&item=${item.id}`)}>
                        <Clapperboard className="mr-2 h-4 w-4" /> Open in Media Studio
                    </DropdownMenuItem>
                    {item.media_acquisition_state === 'awaiting_download' && (
                        <DropdownMenuItem onClick={() => setAcquisitionConfirm([item])}>
                            <Download className="mr-2 h-4 w-4" /> Download &amp; process
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled={!hasMedia} onClick={() => setSttConfirm([item])}>
                        {isReT ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isReT ? 'Re-transcribe with STT' : 'Enrich with STT'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => copyId(item.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy ID
                    </DropdownMenuItem>
                    {item.original_url && (
                        <DropdownMenuItem asChild>
                            <a href={item.original_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" /> Open original
                            </a>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm([item])}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    /**
     * Gallery card — thumbnail-led, the way the Pods product presents media:
     * duration timecode in monospace, caption/quality chips, gold selection ring.
     */
    const renderCard = (item: ContentItem) => {
        const state = captionStateOf(item);
        const approved = !!item.transcript_approved_at;
        const job = item.latest_transcription_job;
        const jobIsLive = job && ['queued', 'running', 'failed', 'writeback_failed'].includes(job.status);
        const isSelected = selected.has(item.id);
        return (
            <div
                key={item.id}
                className={cn(
                    'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md',
                    isSelected && 'border-gold ring-1 ring-gold'
                )}
            >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    <Link href={`/platform/media/atomization?tab=studio&item=${item.id}`} className="absolute inset-0">
                        {item.thumbnail_url ? (
                            <img
                                src={item.thumbnail_url}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                            />
                        ) : (
                            <Clapperboard className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
                    </Link>
                    <div className="absolute left-1.5 top-1.5 rounded-md bg-black/45 p-1 backdrop-blur-sm">
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(item.id)}
                            aria-label="Select item"
                            className="border-white/70"
                        />
                    </div>
                    {renderActions(
                        item,
                        'absolute right-1.5 top-1.5 h-7 w-7 rounded-md bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 hover:text-white'
                    )}
                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] leading-none text-white">
                        {formatDuration(item.duration_sec)}
                    </span>
                    <span
                        className="pointer-events-none absolute right-1.5 top-10 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] leading-none text-white"
                        title={item.file_size_bytes ? `${item.file_size_bytes.toLocaleString()} bytes` : 'Size not tracked'}
                    >
                        {formatBytes(item.file_size_bytes)}
                    </span>
                    {item.status !== 'READY' && (
                        <Badge
                            variant={CONTENT_STATUS_VARIANTS[item.status]}
                            className="pointer-events-none absolute bottom-1.5 left-1.5"
                        >
                            {CONTENT_STATUS_LABELS[item.status]}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <Link
                        href={`/platform/media/atomization?tab=studio&item=${item.id}`}
                        dir="auto"
                        title={item.title}
                        className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
                    >
                        {item.title || '(untitled)'}
                    </Link>
                    {item.source_name && (
                        <span className="truncate text-xs text-muted-foreground">{item.source_name}</span>
                    )}
                    {item.media_acquisition_state === 'awaiting_download' && (
                        <Button
                            size="sm"
                            className="mt-1 w-full"
                            onClick={() => setAcquisitionConfirm([item])}
                        >
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Download &amp; process
                        </Button>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                        <Badge variant={CAPTION_STATE_VARIANTS[state]} className="text-[10px]">
                            {state === 'youtube_auto' && '⚠️ '}
                            {CAPTION_STATE_LABELS[state]}
                        </Badge>
                        {item.transcript_quality && (
                            <Badge
                                variant={QUALITY_STATUS_VARIANTS[item.transcript_quality.status]}
                                className="text-[10px]"
                            >
                                {QUALITY_STATUS_LABELS[item.transcript_quality.status]} ·{' '}
                                {Math.round(item.transcript_quality.score * 100)}%
                            </Badge>
                        )}
                        {approved && (
                            <Badge
                                variant="outline"
                                className="text-[10px]"
                                title={`Approved by ${item.transcript_approved_by || 'admin'}`}
                            >
                                <ShieldCheck className="mr-0.5 h-3 w-3" /> Approved
                            </Badge>
                        )}
                        {jobIsLive && job && (
                            <Badge variant={JOB_STATUS_VARIANTS[job.status]} className="text-[10px]">
                                {JOB_STATUS_LABELS[job.status]}
                            </Badge>
                        )}
                        {item.media_acquisition_state && item.media_acquisition_state !== 'ready' && (
                            <Badge variant={item.media_acquisition_state === 'failed' ? 'destructive' : item.media_acquisition_state === 'awaiting_download' ? 'warning' : 'secondary'} className="text-[10px]">
                                {item.media_acquisition_phase || item.media_acquisition_state.replaceAll('_', ' ')}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const cardGrid = (cardItems: ContentItem[]) => (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {cardItems.map(renderCard)}
        </div>
    );

    const renderRow = (item: ContentItem) => {
        const state = captionStateOf(item);
        const approved = !!item.transcript_approved_at;
        return (
            <TableRow key={item.id}>
                <TableCell>
                    <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleOne(item.id)}
                        aria-label="Select row"
                    />
                </TableCell>
                <TableCell className="max-w-0">
                    <div className="flex items-center gap-3">
                        <Link href={`/platform/media/atomization?tab=studio&item=${item.id}`} className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                            {item.thumbnail_url ? (
                                <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                                <Clapperboard className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                            )}
                        </Link>
                        <div className="min-w-0">
                            <Link href={`/platform/media/atomization?tab=studio&item=${item.id}`} className="block truncate font-medium hover:underline" title={item.title}>
                                {item.title || '(untitled)'}
                            </Link>
                            {item.source_name && !groupBy && (
                                <span className="block truncate text-xs text-muted-foreground">{item.source_name}</span>
                            )}
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="space-y-1">
                        <Badge variant={CONTENT_STATUS_VARIANTS[item.status]}>{CONTENT_STATUS_LABELS[item.status]}</Badge>
                        {item.media_acquisition_state && item.media_acquisition_state !== 'ready' && (
                            <Badge variant={item.media_acquisition_state === 'failed' ? 'destructive' : item.media_acquisition_state === 'awaiting_download' ? 'warning' : 'secondary'} className="block w-fit text-[10px]">
                                {item.media_acquisition_phase || item.media_acquisition_state.replaceAll('_', ' ')}
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="tabular-nums text-sm">{formatDuration(item.duration_sec)}</TableCell>
                <TableCell className="tabular-nums text-sm" title={item.file_size_bytes ? `${item.file_size_bytes.toLocaleString()} bytes` : 'Size not tracked'}>
                    {formatBytes(item.file_size_bytes)}
                </TableCell>
                <TableCell>
                    <div className="space-y-1">
                        <Badge variant={CAPTION_STATE_VARIANTS[state]}>
                            {state === 'youtube_auto' && '⚠️ '}
                            {CAPTION_STATE_LABELS[state]}
                        </Badge>
                        {renderQualitySummary(item.transcript_quality)}
                        {approved && (
                            <Badge variant="outline" title={`Approved by ${item.transcript_approved_by || 'admin'}`}>
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Approved
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    {renderJobSummary(item.latest_transcription_job)}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                        {item.media_acquisition_state === 'awaiting_download' && (
                            <Button size="sm" onClick={() => setAcquisitionConfirm([item])}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Download &amp; process
                            </Button>
                        )}
                        {renderActions(item)}
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="space-y-3">
            {activeBatch && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Transcription batch</span>
                        <Badge variant={activeBatch.status === 'failed' ? 'destructive' : activeBatch.status === 'canceled' ? 'outline' : 'secondary'}>
                            {activeBatch.status}
                        </Badge>
                        <span className="text-muted-foreground">
                            {activeBatch.accepted_count} accepted · {activeBatchRunningCount} active · {activeBatch.completed_count} done · {activeBatch.skipped_count} skipped · {activeBatch.failed_count} failed · {activeBatch.canceled_count} canceled
                        </span>
                        <div className="flex-1" />
                        {batchRunning && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelBatch.mutate(activeBatch.id)}
                                disabled={cancelBatch.isPending}
                            >
                                {cancelBatch.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                                Cancel
                            </Button>
                        )}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded bg-background">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, Math.round(((activeBatch.completed_count + activeBatch.skipped_count + activeBatch.failed_count + activeBatch.canceled_count) / Math.max(1, activeBatch.total_count)) * 100))}%` }}
                        />
                    </div>
                    {activeBatch.latest_error && (
                        <p className="mt-2 line-clamp-2 text-xs text-destructive">{activeBatch.latest_error}</p>
                    )}
                </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Size bottleneck</span>
                    </div>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <div className="text-sm font-semibold tabular-nums">
                                {mediaSizeStats.isLoading ? 'Loading...' : formatBytes(mediaSizeStats.data?.total_bytes, '0 B')}
                            </div>
                            <div className="text-xs text-muted-foreground">Tracked size</div>
                        </div>
                        <div>
                            <div className="text-sm font-semibold tabular-nums">
                                {mediaSizeStats.isLoading ? 'Loading...' : formatBytes(mediaSizeStats.data?.max_bytes, '0 B')}
                            </div>
                            <div className="text-xs text-muted-foreground">Largest item</div>
                        </div>
                        <div>
                            <div className="text-sm font-semibold tabular-nums">
                                {mediaSizeStats.isLoading ? 'Loading...' : formatBytes(mediaSizeStats.data?.avg_bytes, '0 B')}
                            </div>
                            <div className="text-xs text-muted-foreground">Average tracked size</div>
                        </div>
                        <div>
                            <div className="text-sm font-semibold tabular-nums">
                                {mediaSizeStats.isLoading ? 'Loading...' : mediaSizeStats.data?.untracked_count ?? 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Untracked items</div>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/platform/storage?section=candidates">Storage candidates</Link>
                    </Button>
                </div>
            </div>

            {/* Filter / search bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search title…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8" />
                </div>
                <Button
                    size="sm"
                    variant={groupBy ? 'secondary' : 'outline'}
                    onClick={() => setGroupBy((g) => !g)}
                    title="Group items by their source"
                >
                    <Layers className="mr-1.5 h-3.5 w-3.5" /> Group by source
                </Button>
                <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                    <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                            'h-7 px-2',
                            view === 'gallery' &&
                                'bg-gold text-gold-foreground hover:bg-gold/90 hover:text-gold-foreground'
                        )}
                        onClick={() => setView('gallery')}
                        title="Gallery view"
                        aria-label="Gallery view"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                            'h-7 px-2',
                            view === 'table' &&
                                'bg-gold text-gold-foreground hover:bg-gold/90 hover:text-gold-foreground'
                        )}
                        onClick={() => setView('table')}
                        title="Table view"
                        aria-label="Table view"
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
                <Select value={status} onValueChange={(v) => setStatus(v as ContentStatus | 'all')}>
                    <SelectTrigger className="w-[140px]">
                        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : CONTENT_STATUS_LABELS[s]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={captionFilter} onValueChange={(v) => setCaptionFilter(v as CaptionState | 'all')}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {CAPTION_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={qualityFilter} onValueChange={(v) => setQualityFilter(v as TranscriptQualityStatus | 'all')}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {QUALITY_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={jobFilter} onValueChange={(v) => setJobFilter(v as JobFilterValue)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {JOB_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={sizeFilter} onValueChange={(v) => setSizeFilter(v as SizeFilterValue)}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {SIZE_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={acquisitionFilter} onValueChange={(value) => setAcquisitionFilter(value as (typeof ACQUISITION_FILTERS)[number]['value'])}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {ACQUISITION_FILTERS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                {sourceNames.length > 0 && (
                    <Select value={source} onValueChange={setSource}>
                        <SelectTrigger className="w-[170px]">
                            <Rss className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sources</SelectItem>
                            {sourceNames.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                    </Select>
                )}
                <Select value={sortValue} onValueChange={setSortValue}>
                    <SelectTrigger className="w-[140px]">
                        <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                </Select>
                {/* Published-date range */}
                <div className="flex items-center gap-1.5">
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-[150px]"
                        aria-label="Published from"
                        title="Published from"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-[150px]"
                        aria-label="Published to"
                        title="Published to"
                    />
                </div>
            </div>

            {/* Bulk action bar OR result count */}
            {selected.size > 0 ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="font-medium">{selected.size} selected</span>
                    <span className="text-muted-foreground">
                        {formatBytes(selectedBytes, '0 B')} tracked
                        {selectedUntracked > 0 ? ` · ${selectedUntracked} untracked` : ''}
                    </span>
                    <div className="flex-1" />
                    {selectedItems.some((item) => item.media_acquisition_state === 'awaiting_download') && (
                        <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setAcquisitionConfirm(selectedItems.filter((item) => item.media_acquisition_state === 'awaiting_download'))}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Download &amp; process
                        </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setSttConfirm(selectedItems.filter((i) => i.media_url))}>
                        {bulkBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                        Re-transcribe
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={bulkBusy} onClick={() => setDeleteConfirm(selectedItems)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {view === 'gallery' && items.length > 0 && (
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all on this page" />
                    )}
                    <p>
                        {isLoading ? 'Loading…' : `${total} ${type.toLowerCase()} item${total === 1 ? '' : 's'}${groupBy ? ` · ${groups.length} source${groups.length === 1 ? '' : 's'} on this page` : ''}`}
                    </p>
                </div>
            )}

            {view === 'gallery' ? (
                isLoading ? (
                    <div className="flex justify-center rounded-md border py-16 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-md border py-16 text-center text-sm text-muted-foreground">
                        No matching {type.toLowerCase()} items.
                    </div>
                ) : groupBy ? (
                    <div className="space-y-5">
                        {groups.map(([src, gItems]) => {
                            const groupIds = gItems.map((i) => i.id);
                            const groupAllSelected = groupIds.every((id) => selected.has(id));
                            const isCollapsed = collapsed.has(src);
                            const sourceAgg = mediaSizeStats.data?.by_source?.[src];
                            return (
                                <div key={src} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={groupAllSelected}
                                            onCheckedChange={() => setMany(groupIds, !groupAllSelected)}
                                            aria-label="Select source"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleCollapse(src)}
                                            className="flex items-center gap-1.5 text-sm font-semibold"
                                        >
                                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            <Rss className="h-3.5 w-3.5 text-muted-foreground" />
                                            {src}
                                            <Badge variant="secondary" className="ml-1">{sourceAgg?.count ?? gItems.length}</Badge>
                                            <Badge variant="outline" className="ml-1">
                                                {formatBytes(sourceAgg?.bytes ?? gItems.reduce((sum, item) => sum + Math.max(0, item.file_size_bytes ?? 0), 0), '0 B')}
                                            </Badge>
                                            {gItems.some((item) => !item.file_size_bytes || item.file_size_bytes <= 0) && (
                                                <Badge variant="outline" className="ml-1">
                                                    {gItems.filter((item) => !item.file_size_bytes || item.file_size_bytes <= 0).length} untracked
                                                </Badge>
                                            )}
                                        </button>
                                    </div>
                                    {!isCollapsed && cardGrid(gItems)}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    cardGrid(items)
                )
            ) : (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-20">Length</TableHead>
                            <TableHead className="w-24">Size</TableHead>
                            <TableHead className="w-56">Transcript</TableHead>
                            <TableHead className="w-56">Latest job</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={colSpan} className="py-12 text-center text-sm text-muted-foreground">
                                    No matching {type.toLowerCase()} items.
                                </TableCell>
                            </TableRow>
                        ) : groupBy ? (
                            groups.map(([src, gItems]) => {
                                const groupIds = gItems.map((i) => i.id);
                                const groupAllSelected = groupIds.every((id) => selected.has(id));
                                const isCollapsed = collapsed.has(src);
                                const sourceAgg = mediaSizeStats.data?.by_source?.[src];
                                return (
                                    <Fragment key={src}>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                                            <TableCell>
                                                <Checkbox
                                                    checked={groupAllSelected}
                                                    onCheckedChange={() => setMany(groupIds, !groupAllSelected)}
                                                    aria-label="Select source"
                                                />
                                            </TableCell>
                                            <TableCell colSpan={colSpan - 1}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCollapse(src)}
                                                    className="flex items-center gap-1.5 text-sm font-semibold"
                                                >
                                                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    <Rss className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {src}
                                                    <Badge variant="secondary" className="ml-1">{sourceAgg?.count ?? gItems.length}</Badge>
                                                    <Badge variant="outline" className="ml-1">
                                                        {formatBytes(sourceAgg?.bytes ?? gItems.reduce((sum, item) => sum + Math.max(0, item.file_size_bytes ?? 0), 0), '0 B')}
                                                    </Badge>
                                                    {gItems.some((item) => !item.file_size_bytes || item.file_size_bytes <= 0) && (
                                                        <Badge variant="outline" className="ml-1">
                                                            {gItems.filter((item) => !item.file_size_bytes || item.file_size_bytes <= 0).length} untracked
                                                        </Badge>
                                                    )}
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                        {!isCollapsed && gItems.map(renderRow)}
                                    </Fragment>
                                );
                            })
                        ) : (
                            items.map(renderRow)
                        )}
                    </TableBody>
                </Table>
            </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
            )}

            {/* Media-acquisition confirmation (single or bulk) */}
            <Dialog open={!!acquisitionConfirm} onOpenChange={(open) => !open && setAcquisitionConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Download and process {(acquisitionConfirm?.length ?? 0) === 1 ? 'this item' : `${acquisitionConfirm?.length ?? 0} items`}?</DialogTitle>
                        <DialogDescription>
                            This starts provider download, probing, R2 upload, rendition or analysis-audio preparation, thumbnail generation, and CMS verification.
                            <span className="mt-2 block">If the provider supplies captions, they are imported automatically after media acquisition; generated STT remains subject to its separate policy.</span>
                            <span className="mt-2 block">Combined provider duration: {formatDuration(acquisitionDuration)}.</span>
                            <span className="mt-1 block">Storage size is unknown until the media probe completes.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAcquisitionConfirm(null)}>Cancel</Button>
                        <Button onClick={() => acquisitionConfirm && runAcquisition(acquisitionConfirm)} disabled={requestAcquisition.isPending || bulkBusy}>
                            {(requestAcquisition.isPending || bulkBusy) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Download &amp; process
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* STT confirm (single or bulk) */}
            <Dialog open={!!sttConfirm} onOpenChange={(o) => !o && setSttConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{(sttConfirm?.length ?? 0) > 1 ? `Re-transcribe ${sttConfirm?.length} items?` : 'Transcribe with STT?'}</DialogTitle>
                        <DialogDescription>
                            Runs the configured STT engine{(sttConfirm?.length ?? 0) > 1 ? ' on the selected items' : ` on “${sttConfirm?.[0]?.title || 'this item'}”`},
                            replacing any existing transcript and re-running embeddings. The monthly budget cap still applies.
                            <span className="mt-2 block">
                                Media size: {formatBytes(sttConfirmBytes, '0 B')} tracked
                                {sttConfirmUntracked > 0 ? ` · ${sttConfirmUntracked} untracked` : ''}.
                            </span>
                            <span className="mt-2 block">
                                Estimated STT cost before CMS budget enforcement: {formatUsd(sttConfirmEstimatedCost)}.
                            </span>
                            {sttConfirmBytes >= LARGE_MEDIA_WARNING_BYTES && (
                                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-500">
                                    Large media can slow provider upload/download and is more likely to expose pipeline timeouts.
                                </span>
                            )}
                            {sttConfirm?.some((item) => item.transcript_approved_at) && (
                                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-500">
                                    {sttConfirm.filter((item) => item.transcript_approved_at).length} approved transcript{sttConfirm.filter((item) => item.transcript_approved_at).length === 1 ? '' : 's'} selected. Approval is advisory; this action is still allowed.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSttConfirm(null)}>Cancel</Button>
                        <Button onClick={() => sttConfirm && runStt(sttConfirm)} disabled={triggerStt.isPending || bulkBusy}>
                            {(triggerStt.isPending || bulkBusy) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {(sttConfirm?.length ?? 0) > 1 ? 'Re-transcribe all' : 'Transcribe'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm (single or bulk) */}
            <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {deleteConfirm?.length === 1 ? 'this item' : `${deleteConfirm?.length} items`}?</DialogTitle>
                        <DialogDescription>
                            This permanently removes the content {deleteConfirm?.length === 1 ? 'item' : 'items'} and {deleteConfirm?.length === 1 ? 'its' : 'their'} transcript/chapters. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteConfirm && runDelete(deleteConfirm)} disabled={deleteByIds.isPending}>
                            {deleteByIds.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
