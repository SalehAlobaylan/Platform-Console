'use client';

import { useState } from 'react';
import Link from '@/lib/console-link';
import { ArrowLeft, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import {
    WeightSliders,
    ScoreWaterfall,
    WEIGHT_KEYS,
} from '@/components/platform/intelligence';
import {
    useRankingConfig,
    useUpdateRankingConfig,
    usePreviewPods,
    usePreviewNews,
} from '@/hooks/use-intelligence';

function PositionChange({ change }: { change: number }) {
    if (change > 0) {
        return (
            <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium">
                <ArrowUp className="h-3 w-3" />
                {change}
            </span>
        );
    }
    if (change < 0) {
        return (
            <span className="flex items-center gap-0.5 text-red-600 text-xs font-medium">
                <ArrowDown className="h-3 w-3" />
                {Math.abs(change)}
            </span>
        );
    }
    return (
        <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
            <Minus className="h-3 w-3" />
        </span>
    );
}

export default function PreviewPage() {
    const { data: config } = useRankingConfig();
    const updateConfig = useUpdateRankingConfig();
    const [feedType, setFeedType] = useState<'pods' | 'news'>('pods');

    // Temporary weight overrides
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const hasOverrides = Object.keys(overrides).length > 0;

    // Build query params from overrides
    const overrideParams = hasOverrides ? overrides : undefined;

    const {
        data: podsPreview,
        isLoading: fyLoading,
    } = usePreviewPods(feedType === 'pods' ? overrideParams : undefined);

    const {
        data: newsPreview,
        isLoading: newsLoading,
    } = usePreviewNews(feedType === 'news' ? overrideParams : undefined);

    const preview = feedType === 'pods' ? podsPreview : newsPreview;
    const previewLoading = feedType === 'pods' ? fyLoading : newsLoading;

    // Initialize overrides from config
    const currentWeights: Record<string, number> = {};
    for (const k of WEIGHT_KEYS) {
        currentWeights[k] = hasOverrides
            ? (overrides[k] ?? 0)
            : ((config as Record<string, number> | undefined)?.[k] ?? 0);
    }

    const handleWeightChange = (weights: Record<string, number>) => {
        setOverrides(weights);
    };

    const handleResetOverrides = () => {
        setOverrides({});
    };

    const handleApplyToProduction = () => {
        if (!config || !hasOverrides) return;
        const updated = { ...config, ...overrides };
        updateConfig.mutate(updated, {
            onSuccess: () => {
                toast({ title: 'Applied', description: 'Weight overrides saved to production config' });
                setOverrides({});
            },
            onError: (err) => {
                toast({
                    title: 'Apply failed',
                    description: err instanceof Error ? err.message : 'Unknown error',
                    variant: 'destructive',
                });
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/platform/intelligence">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Feed Preview</h1>
                        <p className="text-muted-foreground">
                            Test ranking changes before applying to production
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {hasOverrides && (
                        <>
                            <Button variant="outline" onClick={handleResetOverrides}>
                                Reset Overrides
                            </Button>
                            <Button onClick={handleApplyToProduction} disabled={updateConfig.isPending}>
                                {updateConfig.isPending ? 'Applying...' : 'Apply to Production'}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Feed Type Toggle */}
            <Tabs value={feedType} onValueChange={(v) => setFeedType(v as 'pods' | 'news')}>
                <TabsList>
                    <TabsTrigger value="pods">Pods Feed</TabsTrigger>
                    <TabsTrigger value="news">News Feed</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Weight Overrides Panel */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Weight Overrides</CardTitle>
                        <CardDescription>
                            Adjust weights to preview how they affect feed ordering
                        </CardDescription>
                        {hasOverrides && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600 w-fit">
                                Temporary overrides active
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        <WeightSliders weights={currentWeights} onChange={handleWeightChange} />
                    </CardContent>
                </Card>

                {/* Preview Results */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            Preview Results
                            {preview?.items && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({preview.items.length} items)
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {feedType === 'pods'
                                ? 'Full-screen audio/video feed order'
                                : 'Magazine-style editorial slide order'}
                        </CardDescription>
                        {feedType === 'pods' && podsPreview && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">
                                    Assembly: {podsPreview.assembly_mode ?? 'canonical'}
                                </Badge>
                                <Badge variant="outline">
                                    Source cap: {podsPreview.source_cap_applied ? 'active' : 'relaxed'}
                                </Badge>
                                {podsPreview.constraint_relaxation && (
                                    <span>Reason: {podsPreview.constraint_relaxation}</span>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {previewLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full" />
                                ))}
                            </div>
                        ) : preview?.items && preview.items.length > 0 ? (
                            <div className="divide-y rounded-md border">
                                {preview.items.map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-4 p-3">
                                        {/* Rank */}
                                        <div className="flex flex-col items-center shrink-0 w-10">
                                            <span className="text-lg font-bold tabular-nums">#{idx + 1}</span>
                                            <PositionChange change={item.position_change} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-xs">{item.type}</Badge>
                                                <span className="text-xs text-muted-foreground">{item.source_name}</span>
                                                {item.freshness_reserved && (
                                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                                                        Freshness slot
                                                    </Badge>
                                                )}
                                                {item.raw_rank !== undefined && item.raw_rank !== item.ranked_position && (
                                                    <span className="text-xs text-muted-foreground">
                                                        raw #{item.raw_rank}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold tabular-nums">
                                                {item.final_score.toFixed(3)}
                                            </p>
                                            <div className="flex gap-1 mt-0.5">
                                                <span className="text-[10px] text-orange-500" title="Freshness">
                                                    F:{item.score_breakdown.freshness.toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-rose-500" title="Engagement">
                                                    E:{item.score_breakdown.engagement.toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-blue-500" title="Velocity">
                                                    V:{item.score_breakdown.velocity.toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-green-500" title="Quality">
                                                    Q:{item.score_breakdown.quality.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No preview data available. Make sure ranking is configured.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Score Waterfall */}
            {preview?.items && preview.items.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Score Breakdown (Stacked)</CardTitle>
                        <CardDescription>
                            Contribution of each signal to the final score for each item
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScoreWaterfall items={preview.items} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
