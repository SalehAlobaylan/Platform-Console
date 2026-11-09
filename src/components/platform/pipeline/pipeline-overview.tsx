'use client';

import Link from '@/lib/console-link';
import {
    Clock,
    Loader2,
    CheckCircle2,
    XCircle,
    Archive,
    RefreshCw,
    Server,
    Cpu,
    Database,
    ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStatusCounts } from '@/hooks/use-pipeline';
import { useAggregationSummary } from '@/hooks/use-aggregation-monitoring';
import { useEnrichmentHealth } from '@/hooks/use-enrichment';
import { isAggregationConfigured } from '@/lib/api/aggregation';
import type { StatusCounts } from '@/types/platform/pipeline';
import { PipelineAutopilotStrip } from './autopilot-strip';

interface PipelineOverviewProps {
    onSwitchTab: (tab: string) => void;
}

const STATUS_CARDS: {
    key: keyof StatusCounts;
    label: string;
    icon: typeof Clock;
    color: string;
    bgColor: string;
    action?: 'operations' | 'content';
}[] = [
    { key: 'PENDING', label: 'Pending', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', action: 'operations' },
    { key: 'PROCESSING', label: 'Processing', icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { key: 'READY', label: 'Ready', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', action: 'content' },
    { key: 'FAILED', label: 'Failed', icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', action: 'operations' },
    { key: 'ARCHIVED', label: 'Archived', icon: Archive, color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
];

export function PipelineOverview({ onSwitchTab }: PipelineOverviewProps) {
    const { data: counts, isLoading: countsLoading, refetch: refetchCounts } = useStatusCounts();
    const { data: aggSummary, isLoading: aggLoading } = useAggregationSummary();
    const { data: enrichHealth, isLoading: enrichLoading } = useEnrichmentHealth();

    const total = counts
        ? counts.PENDING + counts.PROCESSING + counts.READY + counts.FAILED + counts.ARCHIVED
        : 0;

    return (
        <div className="space-y-6">
            <PipelineAutopilotStrip />

            {/* Status counts */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {STATUS_CARDS.map((card) => {
                    const Icon = card.icon;
                    const value = counts?.[card.key] ?? 0;

                    const handleClick = () => {
                        if (card.action === 'operations') onSwitchTab('operations');
                    };

                    const inner = (
                        <Card
                            className={`transition-colors ${card.action ? 'cursor-pointer hover:border-primary/30' : ''}`}
                            onClick={card.action === 'operations' ? handleClick : undefined}
                        >
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.bgColor}`}>
                                    <Icon className={`h-5 w-5 ${card.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">{card.label}</p>
                                    {countsLoading ? (
                                        <Skeleton className="h-7 w-16 mt-0.5" />
                                    ) : (
                                        <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );

                    if (card.action === 'content') {
                        return (
                            <Link key={card.key} href="/platform/content">
                                {inner}
                            </Link>
                        );
                    }
                    return <div key={card.key}>{inner}</div>;
                })}
            </div>

            {/* Pipeline flow bar */}
            {counts && total > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-8 w-full overflow-hidden rounded-lg">
                            {counts.PENDING > 0 && (
                                <div
                                    className="bg-amber-500 flex items-center justify-center text-xs font-medium text-white transition-all"
                                    style={{ width: `${(counts.PENDING / total) * 100}%`, minWidth: counts.PENDING > 0 ? '2rem' : 0 }}
                                    title={`Pending: ${counts.PENDING}`}
                                >
                                    {counts.PENDING > 0 && total > 0 && ((counts.PENDING / total) * 100) > 5
                                        ? `${Math.round((counts.PENDING / total) * 100)}%`
                                        : ''}
                                </div>
                            )}
                            {counts.PROCESSING > 0 && (
                                <div
                                    className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white transition-all"
                                    style={{ width: `${(counts.PROCESSING / total) * 100}%`, minWidth: counts.PROCESSING > 0 ? '2rem' : 0 }}
                                    title={`Processing: ${counts.PROCESSING}`}
                                />
                            )}
                            {counts.READY > 0 && (
                                <div
                                    className="bg-emerald-500 flex items-center justify-center text-xs font-medium text-white transition-all"
                                    style={{ width: `${(counts.READY / total) * 100}%`, minWidth: counts.READY > 0 ? '2rem' : 0 }}
                                    title={`Ready: ${counts.READY}`}
                                >
                                    {((counts.READY / total) * 100) > 5
                                        ? `${Math.round((counts.READY / total) * 100)}%`
                                        : ''}
                                </div>
                            )}
                            {counts.FAILED > 0 && (
                                <div
                                    className="bg-red-500 flex items-center justify-center text-xs font-medium text-white transition-all"
                                    style={{ width: `${(counts.FAILED / total) * 100}%`, minWidth: counts.FAILED > 0 ? '2rem' : 0 }}
                                    title={`Failed: ${counts.FAILED}`}
                                >
                                    {((counts.FAILED / total) * 100) > 5
                                        ? `${Math.round((counts.FAILED / total) * 100)}%`
                                        : ''}
                                </div>
                            )}
                            {counts.ARCHIVED > 0 && (
                                <div
                                    className="bg-gray-400 flex items-center justify-center text-xs font-medium text-white transition-all"
                                    style={{ width: `${(counts.ARCHIVED / total) * 100}%`, minWidth: counts.ARCHIVED > 0 ? '2rem' : 0 }}
                                    title={`Archived: ${counts.ARCHIVED}`}
                                />
                            )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Pending</span>
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Processing</span>
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Ready</span>
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Failed</span>
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" />Archived</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Service health */}
            <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Service Health</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                    {/* CMS */}
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">CMS</p>
                                <p className="text-xs text-muted-foreground">Content Management</p>
                            </div>
                            {countsLoading ? (
                                <Skeleton className="h-5 w-16" />
                            ) : counts ? (
                                <Badge variant="success">Online</Badge>
                            ) : (
                                <Badge variant="destructive">Offline</Badge>
                            )}
                        </CardContent>
                    </Card>

                    {/* Aggregation */}
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <Server className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Aggregation</p>
                                <p className="text-xs text-muted-foreground">Pipeline Workers</p>
                            </div>
                            {aggLoading ? (
                                <Skeleton className="h-5 w-16" />
                            ) : aggSummary ? (
                                <Badge variant={
                                    aggSummary.health.status === 'healthy' ? 'success'
                                        : aggSummary.health.status === 'degraded' ? 'warning'
                                            : 'destructive'
                                } className="capitalize">
                                    {aggSummary.health.status}
                                </Badge>
                            ) : !isAggregationConfigured() ? (
                                <Badge variant="secondary">Not configured</Badge>
                            ) : (
                                <Badge variant="destructive">Offline</Badge>
                            )}
                        </CardContent>
                    </Card>

                    {/* Enrichment */}
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <Cpu className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Enrichment</p>
                                <p className="text-xs text-muted-foreground">AI / ML Models</p>
                            </div>
                            {enrichLoading ? (
                                <Skeleton className="h-5 w-16" />
                            ) : enrichHealth ? (
                                <Badge variant={enrichHealth.status === 'ok' ? 'success' : 'destructive'} className="capitalize">
                                    {enrichHealth.status === 'ok' ? 'Online' : enrichHealth.status}
                                </Badge>
                            ) : (
                                <Badge variant="destructive">Offline</Badge>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => refetchCounts()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Counts
                </Button>
                <Button size="sm" onClick={() => onSwitchTab('operations')}>
                    Manage Pipeline
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
