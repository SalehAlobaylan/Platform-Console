'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Newspaper } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTopics, useBulkStatus, useBulkDeleteNews } from '@/hooks/use-news';
import { useFeeds } from '@/hooks/use-feeds';
import { bulkSetStatus, previewNewsDelete } from '@/lib/api/cms/news';
import { TopicStageCard } from '@/components/platform/news/topic-stage-card';
import { TopicEditDialog } from '@/components/platform/news/topic-edit-dialog';
import {
    BulkConfirmDialog,
    type BulkConfirmConfig,
} from '@/components/platform/news/bulk-confirm-dialog';
import type { ContentStatus } from '@/types/platform/content';
import type { TopicSelection, TopicSummary } from '@/types/platform/news';

type Stage = 'PENDING' | 'READY' | 'ARCHIVED';

const COLUMNS: { status: Stage; title: string; accent: string }[] = [
    { status: 'PENDING', title: 'Queue', accent: 'bg-blue-500' },
    { status: 'READY', title: 'Live', accent: 'bg-emerald-500' },
    { status: 'ARCHIVED', title: 'Archived', accent: 'bg-slate-400' },
];

const TRANSITION: Record<Stage, { from: ContentStatus; to: ContentStatus; verb: string }> = {
    PENDING: { from: 'PENDING', to: 'READY', verb: 'Publish' },
    READY: { from: 'READY', to: 'ARCHIVED', verb: 'Archive' },
    ARCHIVED: { from: 'ARCHIVED', to: 'READY', verb: 'Restore' },
};

function countFor(t: { ready: number; pending: number; archived: number }, s: Stage): number {
    return s === 'PENDING' ? t.pending : s === 'READY' ? t.ready : t.archived;
}

export function TopicBoard({ onOpenTopic }: { onOpenTopic: (sel: TopicSelection) => void }) {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [confirm, setConfirm] = useState<BulkConfirmConfig | null>(null);
    const [edit, setEdit] = useState<{ topic: { id: string; label: string }; mode: 'rename' | 'merge' } | null>(null);

    const bulkStatus = useBulkStatus();
    const bulkDelete = useBulkDeleteNews();
    const busy = bulkStatus.isPending || bulkDelete.isPending;

    const { data: feedsData } = useFeeds();
    const publicBase = feedsData?.public_base;
    const rssUrlFor = (topicId: string): string | undefined =>
        publicBase
            ? `${publicBase}/api/v1/feed/rss.xml?story_id=${encodeURIComponent(topicId)}`
            : undefined;

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 250);
        return () => clearTimeout(t);
    }, [search]);

    const { data, isLoading } = useTopics({ search: debounced || undefined, limit: 200 });
    const topics = useMemo(() => data?.data ?? [], [data]);
    const unc = data?.uncategorized;

    // Whole-story stage transition (Publish/Archive/Restore all in a story).
    const stageConfig = (
        topicId: string,
        label: string,
        status: Stage,
        count: number
    ): BulkConfirmConfig => {
        const tr = TRANSITION[status];
        return {
            title: `${tr.verb} all in "${label}"`,
            actionLabel: tr.verb,
            noun: 'article',
            preview: () =>
                bulkSetStatus({
                    from_status: tr.from,
                    to_status: tr.to,
                    story_id: topicId,
                    type: 'NEWS',
                    dry_run: true,
                }).then((r) => r.updated_count),
            commit: () =>
                bulkStatus.mutateAsync({
                    from_status: tr.from,
                    to_status: tr.to,
                    story_id: topicId,
                    type: 'NEWS',
                }),
        };
    };

    const deleteAllConfig = (topicId: string, label: string): BulkConfirmConfig => {
        return {
            title: `Delete all content in "${label}"`,
            actionLabel: 'Delete',
            destructive: true,
            preview: async () => {
                const result = await previewNewsDelete({ story_id: topicId, type: 'NEWS' });
                const id = result.id;
                if (!id) {
                    if (result.count === 0) return 0;
                    throw new Error('The owner did not return a review.');
                }
                return { count: result.count, expiresAt: result.expires_at, apply: () => bulkDelete.mutateAsync({ review_id: id }) };
            },
        };
    };

    const renderCard = (
        t: TopicSummary,
        status: Stage,
        count: number
    ) => (
        <TopicStageCard
            key={t.id}
            id={t.id}
            label={t.label}
            count={count}
            status={status}
            busy={busy}
            rssUrl={rssUrlFor(t.id)}
            onManage={() => onOpenTopic({ id: t.id, label: t.label })}
            onPrimary={() => setConfirm(stageConfig(t.id, t.label, status, count))}
            onRename={() => setEdit({ topic: { id: t.id, label: t.label }, mode: 'rename' })}
            onMerge={() => setEdit({ topic: { id: t.id, label: t.label }, mode: 'merge' })}
            onDeleteAll={() => setConfirm(deleteAllConfig(t.id, t.label))}
        />
    );

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => { setConfirm(null); setSearch(e.target.value); }}
                    placeholder="Search stories…"
                    className="pl-9"
                />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
                {COLUMNS.map((col) => {
                    const uncCount = unc ? countFor(unc, col.status) : 0;
                    const cards = topics
                        .map((t) => ({ t, c: countFor(t, col.status) }))
                        .filter((x) => x.c > 0)
                        .sort((a, b) => b.c - a.c);
                    const totalInColumn = cards.length + (uncCount > 0 ? 1 : 0);

                    return (
                        <div key={col.status} className="flex min-h-[20rem] flex-col rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2 border-b px-3 py-2">
                                <span className={cn('h-2 w-2 rounded-full', col.accent)} />
                                <h3 className="text-sm font-semibold">{col.title}</h3>
                                <Badge variant="secondary" className="tabular-nums">
                                    {totalInColumn}
                                </Badge>
                            </div>

                            <div className="flex-1 space-y-2 overflow-y-auto p-2 lg:max-h-[calc(100vh-16rem)]">
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                                    ))
                                ) : totalInColumn === 0 ? (
                                    <div className="flex flex-col items-center justify-center px-3 py-10 text-center text-xs text-muted-foreground">
                                        <Newspaper className="mb-1.5 h-5 w-5 opacity-40" />
                                        No stories here.
                                    </div>
                                ) : (
                                    <>
                                        {uncCount > 0 && (
                                            <TopicStageCard
                                                id="none"
                                                label="Uncategorized"
                                                count={uncCount}
                                                status={col.status}
                                                isUncategorized
                                                busy={busy}
                                                rssUrl={rssUrlFor('none')}
                                                onManage={() => onOpenTopic({ id: 'none', label: 'Uncategorized' })}
                                                onPrimary={() =>
                                                    setConfirm(stageConfig('none', 'Uncategorized', col.status, uncCount))
                                                }
                                            />
                                        )}
                                        {cards.map(({ t, c }) => renderCard(t, col.status, c))}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <BulkConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
            <TopicEditDialog
                topic={edit?.topic ?? null}
                mode={edit?.mode ?? 'rename'}
                onClose={() => setEdit(null)}
            />
        </div>
    );
}
