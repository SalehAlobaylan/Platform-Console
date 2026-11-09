'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/lib/navigation';
import Link from '@/lib/console-link';
import { formatDistanceToNow } from 'date-fns';
import {
    ArrowUpDown,
    Copy,
    ExternalLink,
    FileText,
    FolderInput,
    MessageSquare,
    MessagesSquare,
    MoreHorizontal,
    Newspaper,
    PanelRight,
    Search,
    Sparkles,
    Trash2,
    type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { NewsBulkBar, type BulkScope } from '@/components/platform/news/news-bulk-bar';
import { MoveToTopicDialog } from '@/components/platform/news/move-to-topic-dialog';
import {
    BulkConfirmDialog,
    type BulkConfirmConfig,
} from '@/components/platform/news/bulk-confirm-dialog';
import {
    useBulkDeleteNews,
    useBulkStatus,
    useDeleteNewsByIds,
    useSetNewsStatus,
    useTopicContent,
    useTopics,
} from '@/hooks/use-news';
import { listSourceNames } from '@/lib/api/cms/content';
import {
    triggerEnrichment,
    triggerBatchEnrichment,
    ENRICHMENT_BATCH_LIMIT,
} from '@/lib/api/cms/enrichment';
import { bulkSetStatus, bulkDeleteNews } from '@/lib/api/cms/news';
import { cn } from '@/lib/utils';
import type { ContentItem, ContentStatus } from '@/types/platform/content';
import type { BulkSelection } from '@/types/platform/news';

const PAGE_LIMIT = 20;

/**
 * Library covers everything the News feed serves: featured editorial
 * (NEWS/ARTICLE) plus the related social items (TWEET/COMMENT). Media stays out.
 */
export type NewsLibraryType = 'NEWS' | 'ARTICLE' | 'TWEET' | 'COMMENT';

const TYPE_TABS: { value: NewsLibraryType; label: string; desk: string; icon: LucideIcon }[] = [
    { value: 'NEWS', label: 'News', desk: 'News desk', icon: Newspaper },
    { value: 'ARTICLE', label: 'Articles', desk: 'Articles', icon: FileText },
    { value: 'TWEET', label: 'Tweets', desk: 'Tweets', icon: MessageSquare },
    { value: 'COMMENT', label: 'Comments', desk: 'Comments', icon: MessagesSquare },
];

/** Topics only apply to editorial content — social items are auto-related. */
function isEditorialType(t: NewsLibraryType): boolean {
    return t === 'NEWS' || t === 'ARTICLE';
}

type StatusFilter = 'all' | ContentStatus;

/** Product-language status labels — same vocabulary as the story board columns. */
const NEWS_STATUS_LABELS: Record<ContentStatus, string> = {
    PENDING: 'Queue',
    PROCESSING: 'Processing',
    READY: 'Live',
    FAILED: 'Failed',
    ARCHIVED: 'Archived',
};

/** Status chip treatments — Live carries the news-red accent, the rest stay quiet. */
const NEWS_STATUS_CHIPS: Record<ContentStatus, string> = {
    READY: 'border-news/40 bg-news/10 text-news',
    PENDING: 'border-transparent bg-secondary text-secondary-foreground',
    PROCESSING: 'border-transparent bg-warning text-warning-foreground',
    FAILED: 'border-transparent bg-destructive text-destructive-foreground',
    ARCHIVED: 'border-border bg-transparent text-muted-foreground',
};

/** Primary bulk transition offered per active status filter. */
const PRIMARY_BY_STATUS: Partial<
    Record<ContentStatus, { label: string; to: ContentStatus }>
> = {
    PENDING: { label: 'Publish', to: 'READY' },
    READY: { label: 'Archive', to: 'ARCHIVED' },
    ARCHIVED: { label: 'Restore', to: 'READY' },
    FAILED: { label: 'Re-queue', to: 'PENDING' },
};

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest', sort: 'created_at', order: 'desc' as const },
    { value: 'published', label: 'Recently published', sort: 'published_at', order: 'desc' as const },
    { value: 'oldest', label: 'Oldest', sort: 'created_at', order: 'asc' as const },
    { value: 'title', label: 'Title A–Z', sort: 'title', order: 'asc' as const },
];

interface NewsLibraryProps {
    initialType?: NewsLibraryType;
    initialStatus?: StatusFilter;
}

/**
 * News Library — the operational browse/filter/manage surface for NEWS and
 * ARTICLE content, presented as an editorial list in the product's newsprint
 * language: serif headlines, square-rounded chrome, red "Live" accent.
 */
export function NewsLibrary({ initialType = 'NEWS', initialStatus = 'all' }: NewsLibraryProps) {
    const [type, setType] = useState<NewsLibraryType>(initialType);
    const [status, setStatus] = useState<StatusFilter>(initialStatus);
    const [topicId, setTopicId] = useState<string>('all');
    const [sourceName, setSourceName] = useState<string>('');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortValue, setSortValue] = useState('newest');
    const [page, setPage] = useState(1);

    const isEditorial = isEditorialType(type);

    const switchType = (t: NewsLibraryType) => {
        setType(t);
        // Topic filters don't apply to social items — drop a stale topic scope.
        if (!isEditorialType(t)) setTopicId('all');
    };

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [scope, setScope] = useState<BulkScope>('page');
    const [confirm, setConfirm] = useState<BulkConfirmConfig | null>(null);
    const [move, setMove] = useState<{ selection: BulkSelection; count: number } | null>(null);
    const [sourceNames, setSourceNames] = useState<string[]>([]);

    const bulkStatus = useBulkStatus();
    const bulkDelete = useBulkDeleteNews();
    const deleteByIds = useDeleteNewsByIds();
    const busy = bulkStatus.isPending || bulkDelete.isPending || deleteByIds.isPending;

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 250);
        return () => clearTimeout(t);
    }, [search]);

    // Reset paging + selection whenever the filter set changes.
    useEffect(() => {
        setPage(1);
    }, [type, status, topicId, sourceName, debounced, dateFrom, dateTo, sortValue]);
    useEffect(() => {
        setSelected(new Set());
        setScope('page');
    }, [type, status, topicId, sourceName, debounced, dateFrom, dateTo, sortValue, page]);

    useEffect(() => {
        listSourceNames().then(setSourceNames).catch(() => setSourceNames([]));
    }, []);

    const topics = useTopics({ limit: 200 });
    const sortOpt = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0];

    // Published-date range as CMS operator filters (repeated published_at= keys).
    const publishedRange = [
        dateFrom ? `gte:${dateFrom}T00:00:00Z` : '',
        dateTo ? `lte:${dateTo}T23:59:59Z` : '',
    ].filter(Boolean);

    const { data, isLoading, error } = useTopicContent(
        {
            type,
            story_id: topicId === 'all' ? undefined : topicId,
            status: status === 'all' ? undefined : status,
            source_name: sourceName || undefined,
            search: debounced || undefined,
            published_at: publishedRange.length ? publishedRange : undefined,
            sort: sortOpt.sort,
            order: sortOpt.order,
            page,
            limit: PAGE_LIMIT,
        },
        { paused: busy }
    );

    const items: ContentItem[] = useMemo(() => data?.data ?? [], [data]);
    const total = data?.total ?? 0;
    const totalPages = data?.total_pages ?? 1;
    const pageNumbers = useMemo(() => buildPagination(page, totalPages), [page, totalPages]);

    /** The active filter set, as a bulk-API selection (used for "all matching"). */
    const filterSelection: BulkSelection = {
        type,
        story_id: topicId === 'all' ? undefined : topicId,
        status: status === 'all' ? undefined : status,
        source_name: sourceName || undefined,
    };

    const effectiveCount = scope === 'all' ? total : selected.size;
    const primary = status !== 'all' ? PRIMARY_BY_STATUS[status] : undefined;

    const clearSelection = () => {
        setSelected(new Set());
        setScope('page');
    };

    const toggleOne = (id: string) => {
        setScope('page');
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allOnPage = items.length > 0 && items.every((i) => selected.has(i.id));
    const toggleAllOnPage = () => {
        setScope('page');
        setSelected((prev) => {
            const next = new Set(prev);
            for (const i of items) {
                if (allOnPage) next.delete(i.id);
                else next.add(i.id);
            }
            return next;
        });
    };

    const statusConfig = (to: ContentStatus, label: string): BulkConfirmConfig =>
        scope === 'all'
            ? {
                  title: `${label} all matching items`,
                  actionLabel: label,
                  noun: 'item',
                  preview: () =>
                      bulkSetStatus({
                          ...filterSelection,
                          status: undefined,
                          from_status: status === 'all' ? undefined : status,
                          to_status: to,
                          dry_run: true,
                      }).then((r) => r.updated_count),
                  commit: () =>
                      bulkStatus.mutateAsync({
                          ...filterSelection,
                          status: undefined,
                          from_status: status === 'all' ? undefined : status,
                          to_status: to,
                      }),
              }
            : {
                  title: `${label} ${selected.size} selected`,
                  actionLabel: label,
                  noun: 'item',
                  preview: async () => selected.size,
                  commit: () => bulkStatus.mutateAsync({ ids: [...selected], to_status: to }),
              };

    const deleteConfig = (): BulkConfirmConfig =>
        scope === 'all'
            ? {
                  title: 'Delete all matching items',
                  actionLabel: 'Delete',
                  noun: 'item',
                  destructive: true,
                  preview: () =>
                      bulkDeleteNews({ ...filterSelection, dry_run: true }).then(
                          (r) => r.deleted_count
                      ),
                  commit: () => bulkDelete.mutateAsync(filterSelection),
              }
            : {
                  title: `Delete ${selected.size} selected`,
                  actionLabel: 'Delete',
                  noun: 'item',
                  destructive: true,
                  preview: async () => selected.size,
                  commit: () => deleteByIds.mutateAsync([...selected]),
              };

    /** Re-enrich selected ids in backend-capped batches (ids-scope only). */
    const reEnrichConfig = (): BulkConfirmConfig => ({
        title: `Re-enrich ${selected.size} selected`,
        actionLabel: 'Re-enrich',
        noun: 'item',
        preview: async () => selected.size,
        commit: async () => {
            const ids = [...selected];
            for (let i = 0; i < ids.length; i += ENRICHMENT_BATCH_LIMIT) {
                await triggerBatchEnrichment(ids.slice(i, i + ENRICHMENT_BATCH_LIMIT));
            }
            toast({
                title: 'Enrichment triggered',
                description: `${ids.length} item${ids.length === 1 ? '' : 's'} queued.`,
                variant: 'success',
            });
        },
    });

    const singleDeleteConfig = (id: string): BulkConfirmConfig => ({
        title: 'Delete item',
        actionLabel: 'Delete',
        noun: 'item',
        destructive: true,
        preview: async () => 1,
        commit: () => deleteByIds.mutateAsync([id]),
    });

    return (
        <div className="space-y-3">
            {/* Type toggle — square-rounded news chrome, red active state */}
            <div className="flex flex-wrap items-center gap-2">
                {TYPE_TABS.map((tab) => (
                    <Button
                        key={tab.value}
                        size="sm"
                        variant={type === tab.value ? 'default' : 'outline'}
                        className={cn(
                            'rounded-sm',
                            type === tab.value && 'bg-news text-news-foreground hover:bg-news/90'
                        )}
                        onClick={() => switchType(tab.value)}
                    >
                        <tab.icon className="mr-1.5 h-4 w-4" /> {tab.label}
                    </Button>
                ))}
                <span className="ml-1 text-xs text-muted-foreground">
                    {isLoading ? 'Loading…' : `${total.toLocaleString()} item${total === 1 ? '' : 's'}`}
                </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search headlines…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="rounded-sm pl-9"
                    />
                </div>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                    <SelectTrigger className="w-[130px] rounded-sm">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {Object.entries(NEWS_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                                {l}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isEditorial && (
                    <Select value={topicId} onValueChange={setTopicId}>
                        <SelectTrigger className="w-[170px] rounded-sm">
                            <SelectValue placeholder="Story" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All stories</SelectItem>
                            <SelectItem value="none">Uncategorized</SelectItem>
                            {(topics.data?.data ?? []).map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Select
                    value={sourceName || 'all'}
                    onValueChange={(v) => setSourceName(v === 'all' ? '' : v)}
                >
                    <SelectTrigger className="w-[170px] rounded-sm">
                        <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        {sourceNames.map((n) => (
                            <SelectItem key={n} value={n}>
                                {n}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sortValue} onValueChange={setSortValue}>
                    <SelectTrigger className="w-[170px] rounded-sm">
                        <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {/* Published-date range */}
                <div className="flex items-center gap-1.5">
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-[150px] rounded-sm"
                        aria-label="Published from"
                        title="Published from"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-[150px] rounded-sm"
                        aria-label="Published to"
                        title="Published to"
                    />
                </div>
            </div>

            {/* Bulk bar */}
            <NewsBulkBar
                scope={scope}
                pageCount={selected.size}
                matchingTotal={total}
                /* Bulk filter APIs can't express search or a published range —
                   "select all matching" would act on more than what's shown. */
                canSelectAll={!debounced && !dateFrom && !dateTo}
                busy={busy}
                onScope={setScope}
                onClear={clearSelection}
                primaryLabel={primary?.label ?? null}
                onPrimary={primary ? () => setConfirm(statusConfig(primary.to, primary.label)) : undefined}
                onReEnrich={() => setConfirm(reEnrichConfig())}
                onMove={
                    isEditorial
                        ? () =>
                              setMove({
                                  selection: scope === 'all' ? filterSelection : { ids: [...selected] },
                                  count: effectiveCount,
                              })
                        : undefined
                }
                onDelete={() => setConfirm(deleteConfig())}
            />

            {/* Editorial list — newspaper rule line on top, square-rounded chrome */}
            <div className="overflow-hidden rounded-sm border border-t-2 border-t-news bg-card">
                <div className="flex items-center gap-3 border-b bg-newsprint/60 px-3 py-2">
                    <Checkbox
                        checked={allOnPage}
                        onCheckedChange={toggleAllOnPage}
                        aria-label="Select all on this page"
                    />
                    <span className="brand-overline text-muted-foreground">
                        {TYPE_TABS.find((t) => t.value === type)?.desk}
                    </span>
                </div>

                {isLoading ? (
                    <div className="divide-y">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 px-3 py-3">
                                <Skeleton className="mt-1 h-4 w-4" />
                                <Skeleton className="h-16 w-24 rounded-sm" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="px-4 py-12 text-center text-sm text-destructive">
                        Failed to load the library. Please try again.
                    </div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                        <Newspaper className="mx-auto mb-2 h-5 w-5 opacity-40" />
                        No stories match your filters.
                    </div>
                ) : (
                    <div className="divide-y">
                        {items.map((item) => (
                            <NewsRow
                                key={item.id}
                                item={item}
                                selected={selected.has(item.id)}
                                onToggle={() => toggleOne(item.id)}
                                onMove={() =>
                                    setMove({ selection: { ids: [item.id] }, count: 1 })
                                }
                                onDelete={() => setConfirm(singleDeleteConfig(item.id))}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                        {pageNumbers.map((p, i) =>
                            p === '…' ? (
                                <PaginationItem key={`e-${i}`}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem key={p}>
                                    <PaginationLink
                                        onClick={() => setPage(p)}
                                        isActive={p === page}
                                        className="cursor-pointer"
                                    >
                                        {p}
                                    </PaginationLink>
                                </PaginationItem>
                            )
                        )}
                        <PaginationItem>
                            <PaginationNext
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className={
                                    page >= totalPages
                                        ? 'pointer-events-none opacity-50'
                                        : 'cursor-pointer'
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

            <BulkConfirmDialog
                config={confirm}
                onClose={() => setConfirm(null)}
                onDone={clearSelection}
            />
            <MoveToTopicDialog
                selection={move?.selection ?? null}
                count={move?.count ?? 0}
                onClose={() => setMove(null)}
                onDone={clearSelection}
            />
        </div>
    );
}

/** One editorial row: thumbnail · serif headline · meta strip · status chip · actions. */
function NewsRow({
    item,
    selected,
    onToggle,
    onMove,
    onDelete,
}: {
    item: ContentItem;
    selected: boolean;
    onToggle: () => void;
    onMove: () => void;
    onDelete: () => void;
}) {
    const router = useRouter();
    const setStatus = useSetNewsStatus();
    const editorialItem = item.type === 'NEWS' || item.type === 'ARTICLE';

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(item.id);
            toast({ title: 'ID copied', description: item.id, variant: 'success' });
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    };

    const reEnrich = async () => {
        try {
            await triggerEnrichment(item.id, ['transcript', 'embedding', 'news']);
            toast({ title: 'Enrichment triggered', description: item.title, variant: 'success' });
        } catch (err) {
            toast({
                title: 'Enrichment failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    return (
        <div
            className={cn(
                'flex items-start gap-3 px-3 py-3 transition-colors hover:bg-newsprint/40',
                selected && 'bg-news/5'
            )}
        >
            <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                aria-label={`Select ${item.title}`}
                className="mt-1"
            />

            {/* Square-rounded thumbnail, newsprint style */}
            <Link
                href={`/platform/content/${item.id}`}
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-sm border bg-muted"
            >
                {item.thumbnail_url ? (
                    <img
                        src={item.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <Newspaper className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                )}
            </Link>

            <div className="min-w-0 flex-1">
                <Link
                    href={`/platform/content/${item.id}`}
                    dir="auto"
                    className="font-editorial line-clamp-2 text-[15px] font-semibold leading-snug hover:underline"
                    title={item.title}
                >
                    {item.title || '(untitled)'}
                </Link>
                {item.excerpt && (
                    <p dir="auto" className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {item.excerpt}
                    </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.source_name && (
                        <span className="font-medium text-foreground/70">{item.source_name}</span>
                    )}
                    {item.author && <span>· {item.author}</span>}
                    {item.published_at && (
                        <span>
                            · {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                        </span>
                    )}
                    {(item.topic_tags ?? []).slice(0, 2).map((tag) => (
                        <span
                            key={tag}
                            dir="auto"
                            className="rounded-sm border border-foreground/20 px-1 py-px normal-case tracking-normal"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <Badge
                    variant="outline"
                    className={cn(
                        'rounded-sm text-[10px] uppercase tracking-wide',
                        NEWS_STATUS_CHIPS[item.status]
                    )}
                >
                    {NEWS_STATUS_LABELS[item.status]}
                </Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => router.push(`/platform/content/${item.id}`)}>
                            <PanelRight className="mr-2 h-4 w-4" /> Open detail
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => item.original_url && window.open(item.original_url, '_blank')}
                            disabled={!item.original_url}
                        >
                            <ExternalLink className="mr-2 h-4 w-4" /> Open original
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyId}>
                            <Copy className="mr-2 h-4 w-4" /> Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {(Object.keys(NEWS_STATUS_LABELS) as ContentStatus[]).map((s) => (
                                    <DropdownMenuItem
                                        key={s}
                                        disabled={s === item.status || setStatus.isPending}
                                        onClick={() =>
                                            setStatus.mutate({ ids: [item.id], toStatus: s })
                                        }
                                    >
                                        {NEWS_STATUS_LABELS[s]}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {editorialItem && (
                            <DropdownMenuItem onClick={onMove}>
                                <FolderInput className="mr-2 h-4 w-4" /> Move to story
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={reEnrich}>
                            <Sparkles className="mr-2 h-4 w-4" /> Re-enrich
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onDelete} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

/** Compact pagination list: 1 … 4 5 6 … 50 (≤7 pages enumerate all). */
function buildPagination(current: number, total: number): Array<number | '…'> {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const out: Array<number | '…'> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) out.push('…');
    for (let p = start; p <= end; p += 1) out.push(p);
    if (end < total - 1) out.push('…');
    out.push(total);
    return out;
}
