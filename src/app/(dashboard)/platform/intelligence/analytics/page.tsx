'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cmsClient } from '@/lib/api/client';
import Link from '@/lib/console-link';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    SourcePerformanceChart,
    VelocityLeaderboard,
    TrendingTimeline,
    TopicBubbleChart,
    EmbeddingCoverageStats,
} from '@/components/platform/intelligence';
import {
    useSourcePerformance,
    useVelocityLeaderboard,
    useTrendingItems,
    useEmbeddingClusters,
    useEmbeddingStats,
    useSimilarContent,
} from '@/hooks/use-intelligence';

export default function AnalyticsPage() {
    const { data: sourcePerf, isLoading: perfLoading } = useSourcePerformance();
    const { data: velocity, isLoading: velLoading } = useVelocityLeaderboard();
    const { data: trending, isLoading: trendLoading } = useTrendingItems();
    const { data: clusters, isLoading: clusterLoading } = useEmbeddingClusters();
    const { data: embedStats, isLoading: statsLoading } = useEmbeddingStats();

    // Similar content lookup
    const [lookupId, setLookupId] = useState('');
    const [searchId, setSearchId] = useState('');
    const { data: similar, isLoading: simLoading } = useSimilarContent(searchId || '');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/platform/intelligence">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics & Embeddings</h1>
                    <p className="text-muted-foreground">
                        Source performance, trending content, and embedding insights
                    </p>
                </div>
            </div>
            <PodsOutcomeEvidence />


            {/* Source Performance */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Source Performance</CardTitle>
                    <CardDescription>Average engagement metrics by content source</CardDescription>
                </CardHeader>
                <CardContent>
                    {perfLoading ? (
                        <Skeleton className="h-[350px] w-full" />
                    ) : sourcePerf && sourcePerf.length > 0 ? (
                        <SourcePerformanceChart data={sourcePerf} />
                    ) : (
                        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                            No source performance data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Velocity + Trending */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Velocity Leaderboard</CardTitle>
                        <CardDescription>Top items by recent interaction rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {velLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : velocity && velocity.length > 0 ? (
                            <VelocityLeaderboard data={velocity} />
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No velocity data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Trending Items</CardTitle>
                        <CardDescription>Content with interaction spike detection</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {trendLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : trending && trending.length > 0 ? (
                            <TrendingTimeline data={trending} />
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No trending items detected
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Embeddings Section */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Topic Clusters</CardTitle>
                        <CardDescription>Content grouped by topic tags with engagement</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {clusterLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : clusters && clusters.length > 0 ? (
                            <TopicBubbleChart data={clusters} />
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No topic cluster data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Embedding Coverage</CardTitle>
                        <CardDescription>Vector embedding availability by content type</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-[200px] w-full" />
                        ) : embedStats ? (
                            <EmbeddingCoverageStats data={embedStats.by_type} />
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No embedding stats available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Similar Content Lookup */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Similar Content Lookup</CardTitle>
                    <CardDescription>
                        Find content items with similar embeddings using pgvector cosine distance
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 space-y-1.5">
                            <Label>Content Item ID</Label>
                            <Input
                                placeholder="Enter a content item UUID..."
                                value={lookupId}
                                onChange={(e) => setLookupId(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => setSearchId(lookupId)} disabled={!lookupId}>
                            <Search className="h-4 w-4 mr-2" />
                            Find Similar
                        </Button>
                    </div>

                    {simLoading && (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    )}

                    {similar && similar.length > 0 && (
                        <div className="rounded-md border">
                            <div className="divide-y">
                                {similar.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-xs">{item.type}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-4">
                                            <p className="text-sm font-medium tabular-nums">
                                                {(item.similarity * 100).toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">similarity</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {searchId && !simLoading && similar && similar.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                            No similar content found. The item may not have embeddings.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PodsOutcomeEvidence() {
    const [open, setOpen] = useState(false);
    const query = useQuery({
        queryKey: ['intelligence', 'pods-outcome-evidence'],
        enabled: open,
        retry: false,
        queryFn: ({ signal }) => cmsClient.get<{ data: {
            from: string; until: string; observed_attempts: number; observed_completions: number; coverage: 'unqualified';
            sessions: { started: number; closed: number; both_feeds: number; observed_ms: number } | null;
        } }>('/admin/intelligence/analytics/pods-outcomes', undefined, signal).then(result => result.data),
    });
    return <Card>
        <CardHeader>
            <CardTitle>Product outcomes</CardTitle>
            <CardDescription>Inspect the evidence for native Pods completion.</CardDescription>
            <Button variant="outline" className="w-fit" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide evidence' : 'Show evidence'}</Button>
        </CardHeader>
        {open && <CardContent className="space-y-2 text-sm">
            {query.isPending ? <p>Loading playback evidence…</p> : query.isError || !query.data ? <p role="alert">Playback evidence unavailable. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p> : <>
                <p>{query.data.from.slice(0, 10)} to {query.data.until.slice(0, 10)} UTC (end date excluded)</p>
                <p>{query.data.observed_attempts.toLocaleString()} observed attempts · {query.data.observed_completions.toLocaleString()} observed completions</p>
                {query.data.sessions ? <p>{query.data.sessions.started.toLocaleString()} observed feed sessions · {query.data.sessions.closed.toLocaleString()} closed · {query.data.sessions.both_feeds.toLocaleString()} used both feeds · {Math.round(query.data.sessions.observed_ms / 60_000).toLocaleString()} foreground minutes from closed sessions</p> : <p>Session evidence is unavailable.</p>}
                <p role="status">Completion, session duration, and feed switching are awaiting native coverage qualification.</p>
            </>}
        </CardContent>}
    </Card>;
}
