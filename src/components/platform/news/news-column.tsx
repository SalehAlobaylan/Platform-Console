'use client';

import { useEffect, useMemo, useState } from 'react';
import { Newspaper } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    useTopicContent,
    useSetNewsStatus,
    useDeleteNewsByIds,
    useBulkStatus,
    useBulkDeleteNews,
    useSetFeatured,
} from '@/hooks/use-news';
import { useBulkSetFlags } from '@/hooks/use-intelligence';
import { bulkSetStatus, previewNewsDelete, previewNewsDeleteIds } from '@/lib/api/cms/news';
import { NewsCard } from '@/components/platform/news/news-card';
import { NewsBulkBar, type BulkScope } from '@/components/platform/news/news-bulk-bar';
import {
    BulkConfirmDialog,
    type BulkConfirmConfig,
} from '@/components/platform/news/bulk-confirm-dialog';
import type { ContentStatus } from '@/types/platform/content';
import type { BulkSelection, NewsItem } from '@/types/platform/news';

const STEP = 12;

const TRANSITION: Record<ContentStatus, { label: string; to: ContentStatus } | null> = {
    PENDING: { label: 'Publish', to: 'READY' },
    READY: { label: 'Archive', to: 'ARCHIVED' },
    ARCHIVED: { label: 'Restore', to: 'READY' },
    PROCESSING: null,
    FAILED: null,
};

interface NewsColumnProps {
    /** topic UUID, or 'all', or 'none' (unclassified). */
    topicId: string;
    status: ContentStatus;
    title: string;
    accent: string;
    search: string;
    featuredIds: Set<string>;
    onMove: (selection: BulkSelection, count: number) => void;
}

export function NewsColumn({
    topicId,
    status,
    title,
    accent,
    search,
    featuredIds,
    onMove,
}: NewsColumnProps) {
    const [limit, setLimit] = useState(STEP);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [scope, setScope] = useState<BulkScope>('page');
    const [confirm, setConfirm] = useState<BulkConfirmConfig | null>(null);

    const setStatus = useSetNewsStatus();
    const deleteByIds = useDeleteNewsByIds();
    const bulkStatus = useBulkStatus();
    const bulkDelete = useBulkDeleteNews();
    const setFeatured = useSetFeatured();
    const bulkFlags = useBulkSetFlags();

    const busy =
        setStatus.isPending ||
        deleteByIds.isPending ||
        bulkStatus.isPending ||
        bulkDelete.isPending ||
        setFeatured.isPending ||
        bulkFlags.isPending;

    const topicParam = topicId === 'all' ? undefined : topicId;

    const { data, isLoading, error } = useTopicContent(
        { story_id: topicParam, status, search: search || undefined, page: 1, limit },
        { paused: busy }
    );

    const items: NewsItem[] = useMemo(() => data?.data ?? [], [data]);
    const matchingTotal = data?.total ?? 0;
    const hasMore = items.length < matchingTotal;
    const canSelectAll = search.trim() === '';

    useEffect(() => {
        setSelected(new Set());
        setScope('page');
        setConfirm(null);
        setLimit(STEP);
    }, [topicId, search]);

    const transition = TRANSITION[status];

    const clear = () => {
        setSelected(new Set());
        setScope('page');
    };
    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setScope('page');
            return next;
        });

    const selectionForMove = (): { sel: BulkSelection; count: number } =>
        scope === 'all'
            ? { sel: { story_id: topicParam, status, type: 'NEWS' }, count: matchingTotal }
            : { sel: { ids: [...selected] }, count: selected.size };

    // ── Row actions ──
    const onPublish = (id: string) => setStatus.mutate({ ids: [id], toStatus: 'READY' });
    const onArchive = (id: string) => setStatus.mutate({ ids: [id], toStatus: 'ARCHIVED' });
    const onRestore = (id: string) => setStatus.mutate({ ids: [id], toStatus: 'READY' });
    const onToggleFeature = (id: string, on: boolean) => setFeatured.mutate({ id, on });
    const onRowDelete = (id: string) =>
        setConfirm({
            title: 'Delete article',
            actionLabel: 'Delete',
            noun: 'article',
            destructive: true,
            preview: () => previewNewsDeleteIds([id]),
            commit: () => deleteByIds.mutateAsync([id]),
        });

    // ── Bulk actions ──
    const onPrimary = () => {
        if (!transition || (scope === 'all' && !canSelectAll)) return;
        if (scope === 'all') {
            setConfirm({
                title: `${transition.label} all in "${title}"`,
                actionLabel: transition.label,
                noun: 'article',
                preview: () =>
                    bulkSetStatus({
                        from_status: status,
                        to_status: transition.to,
                        story_id: topicParam,
                        type: 'NEWS',
                        dry_run: true,
                    }).then((r) => r.updated_count),
                commit: () =>
                    bulkStatus
                        .mutateAsync({
                            from_status: status,
                            to_status: transition.to,
                            story_id: topicParam,
                            type: 'NEWS',
                        })
                        .then(clear),
            });
        } else {
            setStatus.mutate({ ids: [...selected], toStatus: transition.to }, { onSuccess: clear });
        }
    };

    const onBulkDelete = () => {
        if (scope === 'all') {
            if (!canSelectAll) return;
                setConfirm({
                title: `Delete all in "${title}"`,
                actionLabel: 'Delete',
                destructive: true,
                scopeLabel: status,
                preview: async () => {
                    const result = await previewNewsDelete({ story_id: topicParam, status, type: 'NEWS' });
                    const id = result.id;
                    if (!id) {
                        if (result.count === 0) return 0;
                        throw new Error('The owner did not return a review.');
                    }
                    return { count: result.count, expiresAt: result.expires_at, apply: () => bulkDelete.mutateAsync({ review_id: id }).then(clear) };
                },
            });
        } else {
            const ids = [...selected];
            setConfirm({
                title: `Delete ${ids.length} article${ids.length === 1 ? '' : 's'}`,
                actionLabel: 'Delete',
                noun: 'article',
                destructive: true,
                preview: () => previewNewsDeleteIds(ids),
                commit: () => deleteByIds.mutateAsync(ids).then(clear),
            });
        }
    };

    const onFeatureSelected = () => {
        const ids = [...selected];
        if (!ids.length) return;
        bulkFlags.mutate({ content_ids: ids, pin_to_top: true }, { onSuccess: clear });
    };

    const onBulkMove = () => {
        const { sel, count } = selectionForMove();
        onMove(sel, count);
    };

    return (
        <div className="flex min-h-[20rem] flex-col rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <span className={cn('h-2 w-2 rounded-full', accent)} />
                <h3 className="text-sm font-semibold">{title}</h3>
                <Badge variant="secondary" className="tabular-nums">
                    {matchingTotal}
                </Badge>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2 lg:max-h-[calc(100vh-16rem)]">
                <NewsBulkBar
                    scope={scope}
                    pageCount={selected.size}
                    matchingTotal={matchingTotal}
                    canSelectAll={canSelectAll}
                    busy={busy}
                    onScope={setScope}
                    onClear={clear}
                    primaryLabel={transition?.label ?? null}
                    onPrimary={onPrimary}
                    onDelete={onBulkDelete}
                    onFeature={scope === 'page' && status === 'READY' ? onFeatureSelected : undefined}
                    onMove={onBulkMove}
                />

                {error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-center text-sm text-destructive">
                        Failed to load.
                    </div>
                ) : isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-3 py-10 text-center text-xs text-muted-foreground">
                        <Newspaper className="mb-1.5 h-5 w-5 opacity-40" />
                        Nothing here.
                    </div>
                ) : (
                    <>
                        {items.map((item) => (
                            <NewsCard
                                key={item.id}
                                item={item}
                                status={status}
                                featured={featuredIds.has(item.id)}
                                selected={selected.has(item.id)}
                                busy={busy}
                                onSelect={toggle}
                                onPublish={onPublish}
                                onArchive={onArchive}
                                onRestore={onRestore}
                                onToggleFeature={onToggleFeature}
                                onMove={(id) => onMove({ ids: [id] }, 1)}
                                onDelete={onRowDelete}
                            />
                        ))}
                        {hasMore && (
                            <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + STEP)}>
                                Load more
                            </Button>
                        )}
                    </>
                )}
            </div>

            <BulkConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
        </div>
    );
}
