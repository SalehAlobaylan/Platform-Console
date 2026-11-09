'use client';

import { useState } from 'react';
import Link from '@/lib/console-link';
import { Activity, FileSearch, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useContentStageControl, useContentStageHealth, useContentStageQualification, useContentStageTrace } from '@/hooks/use-pipeline';
import type { ContentStageLaneHealth, ContentStageTrace, ContentStageVerdict } from '@/types/platform/pipeline';

const verdictVariant = (verdict: ContentStageVerdict) => verdict === 'healthy' ? 'success' : verdict === 'degraded' ? 'destructive' : verdict === 'paused' ? 'warning' : 'outline';
const age = (value?: string) => value ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60_000)), 'minute') : 'none';

function LaneCard({ lane }: { lane: ContentStageLaneHealth }) {
    const control = useContentStageControl();
    const qualification = useContentStageQualification();
    const states = Object.entries(lane.state_counts).sort((a, b) => b[1] - a[1]);
    const aggregation = lane.latest_snapshots?.aggregation ?? lane.latest_snapshot;
    const enrichment = lane.latest_snapshots?.enrichment;
    const enrichmentInFlight = enrichment
        ? Object.values(enrichment.enrichment_counts ?? {}).reduce((sum, item) => sum + item.in_flight, 0)
        : undefined;
    return (
        <Card className="relative overflow-hidden rounded-sm border-foreground/30 shadow-none">
            <div className={`absolute inset-y-0 start-0 w-1 ${lane.verdict === 'degraded' ? 'bg-[#e63946]' : lane.verdict === 'healthy' ? 'bg-emerald-600' : 'bg-foreground/25'}`} />
            <CardHeader className="pb-4 ps-7">
                <div className="flex items-start justify-between gap-4">
                    <div><CardTitle className="font-serif text-2xl capitalize">{lane.lane}</CardTitle><CardDescription className="mt-1 font-mono text-xs uppercase tracking-[0.16em]">{lane.cutover.replace('_', ' ')}</CardDescription></div>
                    <Badge variant={verdictVariant(lane.verdict)} className="rounded-sm uppercase tracking-wider">{lane.verdict}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 ps-7">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-foreground/20 bg-foreground/20">
                    <div className="bg-card p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Oldest queued</div><div className="mt-1 font-mono text-sm">{age(lane.oldest_queued_at)}</div></div>
                    <div className="bg-card p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Worker path</div><div className="mt-1 text-sm">{lane.control.scheduling_enabled && lane.control.execution_enabled ? 'Accepting claims' : 'Claims paused'}</div></div>
                </div>
                <div className="flex min-h-8 flex-wrap gap-2">{states.length ? states.map(([state, count]) => <span key={state} className="rounded-sm border border-foreground/20 px-2 py-1 font-mono text-xs">{state} {count}</span>) : <span className="text-sm text-muted-foreground">{lane.schema_state === 'pending' ? 'Durable stage schema is pending; compatibility ingest remains active.' : 'No required-stage evidence yet.'}</span>}</div>
                {(aggregation || enrichment) && <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Required queue: <strong className="font-mono text-foreground">{aggregation?.required_queue_depth ?? '—'}</strong></span><span>Optional queue: <strong className="font-mono text-foreground">{aggregation?.optional_queue_depth ?? '—'}</strong></span><span>Aggregation proof: <strong className="font-mono text-foreground">{aggregation ? age(aggregation.captured_at) : 'missing'}</strong></span><span>Enrichment in flight: <strong className="font-mono text-foreground">{enrichmentInFlight ?? '—'}</strong></span></div>}
                {lane.reasons.length > 0 && <div className="border-s-2 border-[#e63946] ps-3 text-sm text-muted-foreground">{lane.reasons.join(' · ')}</div>}
                <div className="flex flex-wrap gap-2 border-t border-foreground/15 pt-4">
                    {lane.lane === 'pods' ? <Button size="sm" variant="outline" asChild><Link href="/platform/media/sources#pods-pipeline">Pods pipeline controls</Link></Button> : <Button size="sm" variant="outline" disabled={control.isPending} onClick={() => control.mutate({ lane: lane.lane, schedulingEnabled: !lane.control.scheduling_enabled })}>
                        {lane.control.scheduling_enabled ? <Pause className="me-2 h-4 w-4" /> : <Play className="me-2 h-4 w-4" />}{lane.control.scheduling_enabled ? 'Pause claims' : 'Resume claims'}
                    </Button>}
                    <Button size="sm" variant="outline" disabled={qualification.isPending || lane.cutover !== 'shadow'} onClick={() => qualification.mutate(lane.lane)}><ShieldCheck className="me-2 h-4 w-4" />Qualification digest</Button>
                </div>
                {qualification.data?.lane === lane.lane && <code className="block break-all rounded-sm border border-foreground/20 bg-muted p-3 text-xs">{qualification.data.verification_digest}</code>}
                {qualification.isError && <p className="text-sm text-destructive">Qualification is blocked. Resolve the lane reasons and retry.</p>}
            </CardContent>
        </Card>
    );
}

const traceValue = (record: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    }
    return '—';
};

function TraceResult({ trace }: { trace: ContentStageTrace }) {
    const rank = trace.ranking;
    const stages = trace.requests.slice().reverse();
    return (
        <div className="space-y-4 rounded-sm border border-foreground/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/15 pb-4">
                <div><Badge variant={trace.diagnostic.classification === 'served' ? 'success' : 'warning'} className="rounded-sm font-mono">{trace.diagnostic.classification}</Badge><p className="mt-2 text-sm text-muted-foreground">{trace.diagnostic.reason}</p></div>
                <div className="text-end text-xs text-muted-foreground"><div>Generation <strong className="font-mono text-foreground">{trace.current_generation}</strong></div><div>Schema <strong className="font-mono text-foreground">{trace.diagnostic.schema_state}</strong></div></div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-foreground/20 bg-foreground/20 sm:grid-cols-4">
                <div className="bg-card p-3"><div className="text-xs uppercase text-muted-foreground">Status</div><div className="mt-1 font-mono text-sm">{traceValue(trace.eligibility, 'status')}</div></div>
                <div className="bg-card p-3"><div className="text-xs uppercase text-muted-foreground">Raw rank</div><div className="mt-1 font-mono text-sm">{rank?.raw_rank ?? '—'}</div></div>
                <div className="bg-card p-3"><div className="text-xs uppercase text-muted-foreground">Final rank</div><div className="mt-1 font-mono text-sm">{rank?.final_rank ?? '—'}</div></div>
                <div className="bg-card p-3"><div className="text-xs uppercase text-muted-foreground">Freshness</div><div className="mt-1 text-sm">{rank?.freshness_reserved ? 'Reserved' : 'Score order'}</div></div>
            </div>
            <div>
                <h3 className="mb-2 font-serif text-lg">Stage generations</h3>
                {stages.length ? <div className="divide-y divide-foreground/10 rounded-sm border border-foreground/20">{stages.map((stage, index) => <div key={`${traceValue(stage, 'public_id', 'id')}-${index}`} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_auto_auto]"><span className="font-medium">{traceValue(stage, 'stage')}</span><span className="font-mono text-xs text-muted-foreground">{traceValue(stage, 'state')}</span><span className="font-mono text-xs text-muted-foreground">gen {traceValue(stage, 'processing_generation')}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No durable stage requests exist for this item.</p>}
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4"><span>Attempts <strong className="font-mono text-foreground">{trace.attempts.length}</strong></span><span>Receipts <strong className="font-mono text-foreground">{trace.receipts.length}</strong></span><span>Artifacts <strong className="font-mono text-foreground">{trace.artifacts.length}</strong></span><span>Events <strong className="font-mono text-foreground">{trace.events.length}</strong></span></div>
            <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Raw bounded evidence</summary><pre className="mt-2 max-h-[24rem] overflow-auto rounded-sm bg-muted p-3 leading-relaxed">{JSON.stringify(trace, null, 2)}</pre></details>
        </div>
    );
}

export function ContentStageLanes() {
    const health = useContentStageHealth();
    const trace = useContentStageTrace();
    const [contentId, setContentId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [playbackDigest, setPlaybackDigest] = useState('');
    if (health.isLoading) return <div className="flex items-center gap-2 py-12 text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Loading durable lanes</div>;
    if (!health.data) return <div className="rounded-sm border border-destructive/40 p-6 text-sm text-destructive">Lane health is unavailable. Apply the CMS stage migration before enabling durable execution.</div>;
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b-2 border-foreground pb-3"><div><h2 className="font-serif text-2xl">Delivery evidence</h2><p className="text-sm text-muted-foreground">CMS-owned stage truth. Queue completion alone is not success.</p></div><Badge variant={health.data.worker_healthy ? 'success' : 'destructive'} className="rounded-sm"><Activity className="me-1 h-3 w-3" />Verifier</Badge></div>
            <div className="grid gap-4 xl:grid-cols-2">{health.data.lanes.map((lane) => <LaneCard key={lane.lane} lane={lane} />)}</div>
            <Card className="rounded-sm border-foreground/30 shadow-none"><CardHeader><CardTitle className="font-serif text-xl">Trace one item</CardTitle><CardDescription>Read the exact production, stage, artifact, generation, ranking, and serving boundary without opening Redis.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]"><Input value={contentId} onChange={(event) => setContentId(event.target.value)} placeholder="Content UUID" className="rounded-sm font-mono" /><Input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Frozen session UUID (optional)" className="rounded-sm font-mono" /><Input value={playbackDigest} onChange={(event) => setPlaybackDigest(event.target.value)} placeholder="Client rendition digest (optional)" className="rounded-sm font-mono" /><Button variant="outline" disabled={!contentId.trim() || trace.isPending} onClick={() => trace.mutate({ contentId: contentId.trim(), sessionId, playbackDigest })}><FileSearch className="me-2 h-4 w-4" />Trace</Button></div>{trace.data && <TraceResult trace={trace.data} />}{trace.isError && <p className="text-sm text-destructive">No tenant-scoped stage trace was found for this item.</p>}</CardContent></Card>
        </div>
    );
}
