'use client';

import { useMemo, type ReactNode } from 'react';
import Link from '@/lib/console-link';
import {
    Activity,
    AlertTriangle,
    Archive,
    CheckCircle2,
    Clock3,
    FolderKanban,
    Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useContent } from '@/hooks/use-content';
import { useTopics } from '@/hooks/use-news';
import {
    CONTENT_STATUS_LABELS,
    CONTENT_STATUS_VARIANTS,
    CONTENT_TYPE_LABELS,
} from '@/types/platform/content';
import type { ContentItem, ContentStatus } from '@/types/platform/content';

interface NewsOverviewProps {
    onOpenLibrary: (preset?: { status?: ContentStatus }) => void;
    onOpenTopics: () => void;
}

/**
 * News Center landing — news-feed health at a glance: lineup counts, topic
 * health, unclassified backlog, failed ingestion, and fresh arrivals.
 */
export function NewsOverview({ onOpenLibrary, onOpenTopics }: NewsOverviewProps) {
    const readyTotal = useNewsTypeTotals('READY');
    const pendingTotal = useNewsTypeTotals('PENDING');
    const archivedTotal = useNewsTypeTotals('ARCHIVED');

    const failedNews = useContent({
        type: 'NEWS',
        status: 'FAILED',
        page: 1,
        limit: 5,
        sort: 'updated_at',
        order: 'desc',
    });
    const failedArticles = useContent({
        type: 'ARTICLE',
        status: 'FAILED',
        page: 1,
        limit: 5,
        sort: 'updated_at',
        order: 'desc',
    });
    const recentNews = useContent({
        type: 'NEWS',
        page: 1,
        limit: 5,
        sort: 'created_at',
        order: 'desc',
    });
    const recentArticles = useContent({
        type: 'ARTICLE',
        page: 1,
        limit: 5,
        sort: 'created_at',
        order: 'desc',
    });

    const topics = useTopics({ limit: 1 });
    const topicCount = topics.data?.total ?? 0;
    const unclassified = topics.data?.uncategorized?.total ?? 0;

    const failedTotal = (failedNews.data?.total ?? 0) + (failedArticles.data?.total ?? 0);
    const failedItems = useMemo(
        () =>
            [...(failedNews.data?.data ?? []), ...(failedArticles.data?.data ?? [])]
                .sort(
                    (a, b) =>
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )
                .slice(0, 5),
        [failedNews.data, failedArticles.data]
    );
    const recentItems = useMemo(
        () =>
            [...(recentNews.data?.data ?? []), ...(recentArticles.data?.data ?? [])]
                .sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .slice(0, 5),
        [recentNews.data, recentArticles.data]
    );

    return (
        <div className="space-y-5">
            {/* Lineup health */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Live now"
                    value={readyTotal}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="text-news"
                    onClick={() => onOpenLibrary({ status: 'READY' })}
                />
                <StatCard
                    label="In queue"
                    value={pendingTotal}
                    icon={<Clock3 className="h-4 w-4" />}
                    tone="text-info"
                    onClick={() => onOpenLibrary({ status: 'PENDING' })}
                />
                <StatCard
                    label="Failed"
                    value={failedTotal}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    tone="text-destructive"
                    onClick={() => onOpenLibrary({ status: 'FAILED' })}
                />
                <StatCard
                    label="Archived"
                    value={archivedTotal}
                    icon={<Archive className="h-4 w-4" />}
                    onClick={() => onOpenLibrary({ status: 'ARCHIVED' })}
                />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
                {/* Story health */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Story Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <FolderKanban className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 text-sm">Stories</div>
                            <div className="font-mono text-sm tabular-nums">{topicCount}</div>
                        </div>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 text-sm">Unclassified backlog</div>
                            <div className="font-mono text-sm tabular-nums">{unclassified}</div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Classify and re-cluster live under the Auto-stories menu in the header.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" onClick={onOpenTopics}>
                            Open story board
                        </Button>
                    </CardContent>
                </Card>

                {/* Failed ingestion */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Failed News</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {failedNews.isLoading || failedArticles.isLoading ? (
                            <LoadingRows />
                        ) : failedItems.length > 0 ? (
                            failedItems.map((item) => <ItemRow key={item.id} item={item} />)
                        ) : (
                            <EmptyRows text="No failed news items right now." />
                        )}
                    </CardContent>
                </Card>

                {/* Fresh arrivals */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Recently Ingested</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentNews.isLoading || recentArticles.isLoading ? (
                            <LoadingRows />
                        ) : recentItems.length > 0 ? (
                            recentItems.map((item) => <ItemRow key={item.id} item={item} />)
                        ) : (
                            <EmptyRows text="Nothing ingested yet — pull fresh or add news." />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/** Combined NEWS + ARTICLE total for one status — the Center owns both types. */
function useNewsTypeTotals(status: ContentStatus): number {
    const news = useContent({ type: 'NEWS', status, page: 1, limit: 1 });
    const articles = useContent({ type: 'ARTICLE', status, page: 1, limit: 1 });
    return (news.data?.total ?? 0) + (articles.data?.total ?? 0);
}

function StatCard({
    label,
    value,
    icon,
    tone = 'text-muted-foreground',
    onClick,
}: {
    label: string;
    value: number;
    icon: ReactNode;
    tone?: string;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="text-left">
            <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                    <div>
                        <div className="text-2xl font-semibold tabular-nums">
                            {value.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                    <div className={tone}>{icon}</div>
                </CardContent>
            </Card>
        </button>
    );
}

function ItemRow({ item }: { item: ContentItem }) {
    return (
        <Link
            href={`/platform/content/${item.id}`}
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

function LoadingRows() {
    return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-5 w-5 animate-pulse" />
        </div>
    );
}

function EmptyRows({ text }: { text: string }) {
    return (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {text}
        </div>
    );
}
