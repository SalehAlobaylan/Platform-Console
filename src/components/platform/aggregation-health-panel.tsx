'use client';

import { consoleRuntime } from '@/lib/runtime-config';
import { FormEvent, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Cpu,
    ExternalLink,
    Hourglass,
    Layers,
    Play,
    RefreshCw,
    type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useAggregationSummary,
    useTriggerAggregationJob,
} from '@/hooks/use-aggregation-monitoring';
import type { AggregationTriggerSourceType } from '@/types/platform/aggregation';
import { AggregationActionBar } from '@/components/platform/aggregation-action-bar';
import { QueueRow } from '@/components/platform/aggregation/queue-row';
import { healthTone, queueRollup, relativeSince, WAITING_WARN } from '@/components/platform/aggregation/aggregation-logic';

const SOURCE_TYPE_OPTIONS: AggregationTriggerSourceType[] = [
    'RSS',
    'YOUTUBE',
    'PODCAST',
    'PODCAST_DISCOVERY',
    'TWITTER',
    'REDDIT',
    'UPLOAD',
    'MANUAL',
];

const DEFAULT_GRAFANA_URL = 'http://localhost:3002';

function isValidUrl(value: string): boolean {
    try {
        // eslint-disable-next-line no-new
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function AggregationHealthPanel() {
    const { data: summary, isLoading, isFetching, isError, error, refetch } = useAggregationSummary();
    const triggerMutation = useTriggerAggregationJob();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sourceType, setSourceType] = useState<AggregationTriggerSourceType>('RSS');
    const [sourceUrl, setSourceUrl] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const grafanaUrl = consoleRuntime().grafanaUrl || DEFAULT_GRAFANA_URL;
    const rollup = useMemo(() => queueRollup(summary), [summary]);

    const handleTriggerSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);

        if (!sourceUrl.trim()) {
            setFormError('Source URL is required.');
            return;
        }
        if (!isValidUrl(sourceUrl.trim())) {
            setFormError('Please enter a valid URL.');
            return;
        }

        await triggerMutation.mutateAsync({
            sourceType,
            url: sourceUrl.trim(),
            name: sourceName.trim() || undefined,
        });

        setSourceType('RSS');
        setSourceUrl('');
        setSourceName('');
        setIsDialogOpen(false);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="h-5 w-5" />
                            Aggregation Monitoring
                        </CardTitle>
                        <CardDescription>Queue health, throughput, and manual controls.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {summary ? (
                            <span className="text-xs text-muted-foreground">updated {relativeSince(summary.health.timestamp)}</span>
                        ) : null}
                        <Badge variant={healthTone(summary?.health.status)} className="capitalize">
                            {summary?.health.status || 'loading'}
                        </Badge>
                        <Button type="button" variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-5">
                {isLoading ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Loading aggregation status...
                    </div>
                ) : null}

                {isError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        {error instanceof Error ? error.message : 'Failed to load aggregation status.'}
                    </div>
                ) : null}

                {summary ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatTile label="Processed" value={summary.totalProcessed} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" />
                            <StatTile
                                label="Waiting"
                                value={summary.waitingJobs}
                                icon={Hourglass}
                                color={summary.waitingJobs >= WAITING_WARN ? 'text-warning' : 'text-muted-foreground'}
                                bg={summary.waitingJobs >= WAITING_WARN ? 'bg-warning/10' : 'bg-muted'}
                            />
                            <StatTile label="Active workers" value={summary.activeWorkers} icon={Cpu} color="text-info" bg="bg-info/10" pulse={summary.activeWorkers > 0} />
                            <StatTile
                                label="Failed"
                                value={summary.totalFailed}
                                icon={AlertTriangle}
                                color={summary.totalFailed > 0 ? 'text-destructive' : 'text-muted-foreground'}
                                bg={summary.totalFailed > 0 ? 'bg-destructive/10' : 'bg-muted'}
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-sm font-semibold">
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    Queues
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                    {rollup.total} {rollup.total === 1 ? 'queue' : 'queues'}
                                    {rollup.attention > 0 ? ` · ${rollup.attention} need attention` : ' · all clear'}
                                </span>
                            </div>
                            {summary.queues.length ? (
                                <div className="space-y-2">
                                    {summary.queues.map((queue) => (
                                        <QueueRow key={queue.queue} queue={queue} />
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                                    No queues reported.
                                </p>
                            )}
                        </div>
                    </>
                ) : null}

                <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => setIsDialogOpen(true)}>
                        <Play className="mr-2 h-4 w-4" />
                        Trigger Job
                    </Button>
                    {grafanaUrl ? (
                        <Button type="button" variant="secondary" render={<a href={grafanaUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Grafana
                            </a>} />
                    ) : null}
                </div>

                <AggregationActionBar />
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Trigger Aggregation Job</DialogTitle>
                        <DialogDescription>Submit a manual aggregation source run.</DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleTriggerSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="aggregation-source-type">Source Type</Label>
                            <Select value={sourceType} onValueChange={(value) => setSourceType(value as AggregationTriggerSourceType)}>
                                <SelectTrigger id="aggregation-source-type">
                                    <SelectValue placeholder="Select source type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SOURCE_TYPE_OPTIONS.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aggregation-source-url">Source URL</Label>
                            <Input
                                id="aggregation-source-url"
                                value={sourceUrl}
                                onChange={(event) => setSourceUrl(event.target.value)}
                                placeholder="https://example.com/feed.xml"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aggregation-source-name">Name (optional)</Label>
                            <Input
                                id="aggregation-source-name"
                                value={sourceName}
                                onChange={(event) => setSourceName(event.target.value)}
                                placeholder="Optional label"
                            />
                        </div>

                        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={triggerMutation.isPending}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={triggerMutation.isPending}>
                                {triggerMutation.isPending ? 'Submitting...' : 'Trigger'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function StatTile({
    label,
    value,
    icon: Icon,
    color,
    bg,
    pulse,
}: {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
    bg: string;
    pulse?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 rounded-md border p-3">
            <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
                {pulse ? <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-info" /> : null}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
            </div>
        </div>
    );
}

export { StatTile as AggregationStatTile };
