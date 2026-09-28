'use client';

import { useMemo, useState } from 'react';
import {
    ArchiveRestore,
    Clock3,
    Database,
    Gauge,
    Pause,
    Play,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { createRouteVisibleContext } from '@/lib/operator/route-manifest';
import {
    useApproveRetentionAction,
    useExecuteRetentionAction,
    useResetRetentionBreaker,
    usePauseRetention,
    usePrepareRetentionCompaction,
    useRetentionHolds,
    useRetentionRunActions,
    useRetentionRuns,
    useRetentionStatus,
    useRunRetention,
    useUpdateRetentionPolicy,
    useMonthlyReviewPolicy,
    useMonthlyReviewArchives,
    useBuildMonthlyReview,
    useUpdateMonthlyReviewPolicy,
    useVerifyMonthlyReview,
    usePrepareHistoricalRetention,
    useExecuteHistoricalRetention,
    useRetentionMaintenanceReport,
    useRetentionOwnerRequests,
    usePrepareRetentionOwnerRequest,
    useExecuteRetentionOwnerRequest,
} from '@/hooks/use-retention';
import type { RetentionMode, RetentionVerdict } from '@/types/platform/retention';

const MIB = 1024 * 1024;
const retentionOperatorContext = (type: string, id: string, label: string) => createRouteVisibleContext('/platform/retention', { subjects: [{ type, id, label }] });

function formatBytes(value?: number | null) {
    if (value == null) return 'Unavailable';
    return `${(value / MIB).toFixed(value < 10 * MIB ? 1 : 0)} MiB`;
}

function verdictTone(verdict?: RetentionVerdict | string) {
    if (verdict === 'healthy' || verdict === 'completed') return 'success' as const;
    if (verdict === 'critical' || verdict === 'failed' || verdict === 'blocked' || verdict === 'recovery_required') return 'destructive' as const;
    if (verdict === 'warning' || verdict === 'action_required' || verdict === 'maintenance_required' || verdict === 'compaction_due' || verdict === 'archive_blocked' || verdict === 'cleanup_due' || verdict === 'recovery_in_progress') return 'warning' as const;
    return 'secondary' as const;
}

function CapacityRail({
    current,
    target,
    action,
    critical,
}: {
    current: number;
    target: number;
    action: number;
    critical: number;
}) {
    const scale = Math.max(critical * 1.08, current * 1.03, 1);
    const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
    return (
        <div className="space-y-3">
            <div className="relative h-4 overflow-hidden rounded-full bg-muted">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-500"
                    style={{ width: pct(current) }}
                />
                {[target, action, critical].map((value) => (
                    <span
                        key={value}
                        className="absolute inset-y-[-4px] w-px bg-foreground/70"
                        style={{ left: pct(value) }}
                    />
                ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div><span className="block font-medium text-foreground">Working target</span>{formatBytes(target)}</div>
                <div className="text-center"><span className="block font-medium text-foreground">Action</span>{formatBytes(action)}</div>
                <div className="text-right"><span className="block font-medium text-foreground">Critical</span>{formatBytes(critical)}</div>
            </div>
        </div>
    );
}

export default function RetentionPage() {
    const status = useRetentionStatus();
    const runs = useRetentionRuns();
    const holds = useRetentionHolds();
    const run = useRunRetention();
    const pause = usePauseRetention();
    const prepareCompaction = usePrepareRetentionCompaction();
    const approveAction = useApproveRetentionAction();
    const executeAction = useExecuteRetentionAction();
    const savePolicy = useUpdateRetentionPolicy();
    const resetBreaker = useResetRetentionBreaker();
    const policy = status.data?.policy;
    const latestRunId = status.data?.latest_run?.id;
    const actions = useRetentionRunActions(latestRunId);
    const [mode, setMode] = useState<RetentionMode | undefined>();
    const [trustMinDecisions, setTrustMinDecisions] = useState<number | undefined>();
    const [trustMinAgreementPct, setTrustMinAgreementPct] = useState<number | undefined>();
    const selectedMode = mode ?? policy?.mode ?? 'observe';
    const selectedTrustMinDecisions = trustMinDecisions ?? policy?.trust_min_decisions ?? 20;
    const selectedTrustMinAgreementPct = trustMinAgreementPct ?? policy?.trust_min_agreement_pct ?? 95;
    const sample = status.data?.latest_sample;
    const monthlyPolicy = useMonthlyReviewPolicy();
    const monthlyArchives = useMonthlyReviewArchives();
    const buildMonthlyReview = useBuildMonthlyReview();
    const verifyMonthlyReview = useVerifyMonthlyReview();
    const reviseMonthlyPolicy = useUpdateMonthlyReviewPolicy();
    const prepareHistorical = usePrepareHistoricalRetention();
    const executeHistorical = useExecuteHistoricalRetention();
    const maintenanceReport = useRetentionMaintenanceReport();
    const ownerRequests = useRetentionOwnerRequests();
    const prepareOwner = usePrepareRetentionOwnerRequest();
    const executeOwner = useExecuteRetentionOwnerRequest();
    const [monthlyPolicyReason, setMonthlyPolicyReason] = useState('');
    const [providerBytesMiB, setProviderBytesMiB] = useState('');
    const [physicalReclaimConfirmed, setPhysicalReclaimConfirmed] = useState(false);
    const [compactionCursor, setCompactionCursor] = useState<string>();
    const [historicalCursor, setHistoricalCursor] = useState<string>();
    const operatorContext = useMemo(() => createRouteVisibleContext('/platform/retention', {
        subjects: [{ type: 'retention_policy', id: policy?.id ?? 'current', label: 'Retention policy' }],
    }), [policy?.id]);
    const lastCompletedMonth = useMemo(() => {
        const value = new Date();
        value.setMonth(value.getMonth() - 1);
        return value.toISOString().slice(0, 7);
    }, []);

    const runwayCopy = useMemo(() => {
        const days = status.data?.forecast.runway_to_critical_days;
        if (days == null) return 'Growth runway needs at least two samples.';
        if (days < 0) return 'The critical line has already been crossed.';
        return `${days.toFixed(days < 10 ? 1 : 0)} days to the critical line at the measured growth rate.`;
    }, [status.data?.forecast.runway_to_critical_days]);

    if (!policy && status.isLoading) {
        return <p className="text-sm text-muted-foreground">Loading Retention Autopilot…</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Database custody</Badge>
                        <Badge variant={policy?.mode === 'assist' && policy.enabled ? 'warning' : 'secondary'}>
                            {policy?.mode === 'assist' && policy.enabled ? 'Assist execution armed' : 'Observe-only until Assist is enabled'}
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Retention Autopilot</h1>
                    <p className="mt-2 text-muted-foreground">
                        Keep a full current month for readers while measuring what can be compacted safely.
                        Sources, canonical identities, and protected interactions remain outside deletion.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {operatorContext ? <OperatorLaunchLink context={operatorContext} intent="investigate" variant="outline">Explain custody</OperatorLaunchLink> : null}
                    <Button variant="outline" onClick={() => status.refetch()} disabled={status.isFetching}>
                        <RefreshCw className="mr-2 h-4 w-4" />Refresh
                    </Button>
                    <Button variant="outline" onClick={() => pause.mutate(120)} disabled={pause.isPending}>
                        <Pause className="mr-2 h-4 w-4" />Pause 2 hours
                    </Button>
                    <Button onClick={() => run.mutate()} disabled={run.isPending}>
                        <Play className="mr-2 h-4 w-4" />Run observation
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden border-gold/30">
                <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
                    <div className="border-b bg-gold/5 p-6 lg:border-b-0 lg:border-r">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">Allocated database</p>
                            <Badge variant={verdictTone(status.data?.verdict)}>{status.data?.verdict ?? 'inconclusive'}</Badge>
                        </div>
                        <p className="mt-3 text-5xl font-semibold tracking-[-0.05em]">
                            {sample ? (sample.database_bytes / MIB).toFixed(0) : '—'}
                            <span className="ml-2 text-base font-medium tracking-normal text-muted-foreground">MiB</span>
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">{runwayCopy}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Last measured {sample?.measured_at ? new Date(sample.measured_at).toLocaleString() : 'never'}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Historical signal: {String(status.data?.historical?.old_news_rows ?? 0)} old News rows · {String(status.data?.historical?.finalized_archives ?? 0)} finalized archives
                        </p>
                    </div>
                    <div className="p-6">
                        <CapacityRail
                            current={sample?.database_bytes ?? 0}
                            target={policy?.database_target_bytes ?? 400 * MIB}
                            action={policy?.database_action_bytes ?? 440 * MIB}
                            critical={policy?.database_critical_bytes ?? 480 * MIB}
                        />
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 md:grid-cols-4">
                            <Metric label="Indexes" value={formatBytes(sample?.index_bytes)} />
                            <Metric label="TOAST" value={formatBytes(sample?.toast_bytes)} />
                            <Metric label="Reusable estimate" value={formatBytes(sample?.reusable_bytes)} />
                            <Metric label="Growth / day" value={formatBytes(status.data?.forecast.growth_bytes_per_day)} />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ArchiveRestore className="h-4 w-4 text-gold" />Current shadow preview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <Metric label="Dormant stories" value={String(status.data?.preview.eligible_stories ?? 0)} />
                            <Metric label="Candidate rows" value={String(status.data?.preview.candidate_rows ?? 0)} />
                            <Metric label="Logical bytes" value={formatBytes(status.data?.preview.estimated_bytes)} />
                            <Metric label="Protected rows" value={String(status.data?.preview.protected_rows ?? 0)} />
                        </div>
                        <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                            <div>
                                <p className="text-sm font-medium">Execution is human-approved and bounded</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    A prepared manifest freezes its exact rows. Execution is available only in enabled Assist mode,
                                    revalidates protection and dependencies, invalidates every News snapshot, and requires readback.
                                </p>
                            </div>
                        </div>
                        <Button
                            className="mt-4"
                            variant="outline"
                            disabled={prepareCompaction.isPending || (status.data?.preview.candidate_rows ?? 0) === 0}
                            onClick={() => prepareCompaction.mutate(compactionCursor, { onSuccess: (manifest) => setCompactionCursor(manifest.evidence?.has_more ? manifest.evidence.next_cursor : undefined) })}
                        >
                            <ArchiveRestore className="mr-2 h-4 w-4" />{compactionCursor ? 'Continue bounded scan' : 'Prepare approval manifest'}
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            This freezes the candidate evidence for review. It does not compact or delete anything. Blocked or oversized stories are skipped and the next bounded page can be continued here.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" />Policy in force</CardTitle></CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div><p className="text-sm font-medium">Scheduled observations</p><p className="text-xs text-muted-foreground">Every {policy?.schedule_interval_minutes ?? 360} minutes</p></div>
                            <Switch
                                checked={policy?.enabled ?? false}
                                disabled={!policy || savePolicy.isPending}
                                onCheckedChange={(enabled) => savePolicy.mutate({ enabled })}
                            />
                        </div>
                        <label className="block text-sm">
                            <span className="mb-2 block font-medium">Operating mode</span>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                                value={selectedMode}
                                onChange={(event) => setMode(event.target.value as RetentionMode)}
                            >
                                <option value="observe">Observe</option>
                                <option value="assist">Assist</option>
                                <option value="safe_auto">Safe Auto</option>
                            </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block text-sm"><span className="mb-2 block font-medium">Trust decisions</span><input type="number" min={1} max={10000} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedTrustMinDecisions} onChange={(event) => setTrustMinDecisions(Number(event.target.value))} /></label>
                            <label className="block text-sm"><span className="mb-2 block font-medium">Agreement %</span><input type="number" min={50} max={100} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedTrustMinAgreementPct} onChange={(event) => setTrustMinAgreementPct(Number(event.target.value))} /></label>
                        </div>
                        <Button
                            className="w-full"
                            variant="outline"
                            disabled={!policy || (selectedMode === policy.mode && selectedTrustMinDecisions === policy.trust_min_decisions && selectedTrustMinAgreementPct === policy.trust_min_agreement_pct) || savePolicy.isPending}
                            onClick={() => savePolicy.mutate({ mode: selectedMode, trust_min_decisions: selectedTrustMinDecisions, trust_min_agreement_pct: selectedTrustMinAgreementPct })}
                        >
                            Save policy
                        </Button>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <PolicyFact label="Full-fidelity News" value={`${status.data?.guarantees.full_fidelity_days ?? 7} days`} />
                            <PolicyFact label="History telemetry" value={`${status.data?.guarantees.history_retention_days ?? 90} days`} />
                            <PolicyFact label="Sources" value="Always preserved" />
                            <PolicyFact label="Physical rewrites" value="Operator only" />
                        </div>
                        <div className="flex gap-2">
                            <input className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={monthlyPolicyReason} onChange={(event) => setMonthlyPolicyReason(event.target.value)} placeholder="Reason for a new immutable policy revision" />
                            <Button size="sm" variant="outline" disabled={!monthlyPolicy.data || !monthlyPolicyReason.trim() || reviseMonthlyPolicy.isPending} onClick={() => reviseMonthlyPolicy.mutate({ config: monthlyPolicy.data!.config, reason: monthlyPolicyReason.trim() })}>Create revision</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Time boundaries follow {policy?.news_timezone ?? 'Asia/Riyadh'}. These product guarantees
                            cannot be weakened from this dashboard.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-gold" />Destructive rollout controls</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">High-risk execution is fail-closed until an administrator enables each persisted rollout gate after the disposable validation matrix passes. The legacy combined Purge &amp; Reseed path is retired; Pods Reset has its own qualification gate.</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {[
                                ['canonical_compaction_enabled', 'Current-month compaction'],
                                ['historical_enabled', 'Historical retirement'],
                                ['owner_runs_enabled', 'Storage/Media owner runs'],
                                ['feed_recovery_rotate_enabled', 'Feed Recovery Rotate'],
                                ['pods_reset_enabled', 'Pods Reset (qualification gated)'],
                            ].map(([key, label]) => {
                                const controls = status.data?.execution_controls as Record<string, boolean> | undefined;
                                const enabled = Boolean(controls?.[key]);
                                return <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{label}</span><Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'Enabled' : 'Paused'}</Badge></div>;
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">Controls are persisted in CMS and require an administrator role plus an audit reason to change.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-gold" />Trust promotion</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">Safe Auto is a manual flip and only applies to the derived News snapshot refresh. Canonical row deletion, Storage, Media, physical rewrites, and Purge &amp; Reseed stay human/operator-owned.</p>
                        {(status.data?.trust ?? []).map((trust) => (
                            <div key={trust.action_class} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2"><span className="font-medium">{trust.action_class}</span><Badge variant={trust.promotion_ready ? 'success' : trust.breaker_open ? 'destructive' : 'warning'}>{trust.breaker_open ? 'breaker open' : trust.state}</Badge></div>
                                <p className="mt-1 text-xs text-muted-foreground">Shadow {trust.shadow_runs} · Assist decisions {trust.assist_decisions} · agreement {trust.agreement_pct.toFixed(1)}% · failures {trust.failures}</p>
                                {trust.breaker_open ? <Button size="sm" variant="outline" className="mt-2" disabled={resetBreaker.isPending} onClick={() => resetBreaker.mutate(trust.action_class)}>Reset breaker</Button> : null}
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">{status.data?.promotion?.safe_auto_allowed ? 'Promotion evidence is earned.' : status.data?.promotion?.blocked_reason ?? 'Assist agreement mileage is required before promotion.'}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Heavy-News satellite evaluation</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">This is an operator recommendation only. Retention never creates partitions or rewrites tables.</p>
                        <div className="flex items-center justify-between gap-2 text-sm"><span>Monthly cycles</span><Badge variant={status.data?.satellite_evaluation?.state === 'evaluated' ? 'success' : 'warning'}>{status.data?.satellite_evaluation?.completed_cycles ?? 0} / {status.data?.satellite_evaluation?.required_cycles ?? 2}</Badge></div>
                        <p className="text-sm font-medium">{status.data?.satellite_evaluation?.recommendation?.replaceAll('_', ' ') ?? 'waiting for measurements'}</p>
                        <p className="text-xs text-muted-foreground">{status.data?.satellite_evaluation?.reason ?? 'The evaluation will appear after the retention status refreshes.'}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArchiveRestore className="h-4 w-4 text-gold" />Month in Review</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            A verified, immutable archive is required before any future closed-month cleanup. It never changes the live month feed.
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <PolicyFact label="Active version" value={`v${monthlyPolicy.data?.version ?? '—'}`} />
                            <PolicyFact label="Selection formula" value="60% importance · 40% engagement" />
                            <PolicyFact label="Diversity caps" value="30% category · 20% source" />
                            <PolicyFact label="Archive size" value="20–30, honest sparse months" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => buildMonthlyReview.mutate(lastCompletedMonth)} disabled={buildMonthlyReview.isPending}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />Build {lastCompletedMonth} revision
                            </Button>
                            <Button variant="outline" onClick={() => verifyMonthlyReview.mutate(lastCompletedMonth)} disabled={verifyMonthlyReview.isPending}>
                                Verify & publish
                            </Button>
                        </div>
                        <div className="space-y-2 border-t pt-3">
                            {(monthlyArchives.data?.items ?? []).slice(0, 4).map((archive) => (
                                <div key={archive.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <span>{new Date(archive.month_start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                                    <span className="flex items-center gap-2 text-muted-foreground">r{archive.revision} · {archive.selected_count} stories{archive.limited_coverage ? ' · limited coverage' : ''}{retentionOperatorContext('retention_month', archive.id, 'Month in Review') && <OperatorLaunchLink context={retentionOperatorContext('retention_month', archive.id, 'Month in Review')!} intent="explain" size="sm" variant="outline">Explain</OperatorLaunchLink>}</span>
                                </div>
                            ))}
                            {monthlyArchives.data?.items?.length === 0 && <p className="text-sm text-muted-foreground">No verified monthly archive yet.</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArchiveRestore className="h-4 w-4 text-gold" />Media owner coordination</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">Retention can request one bounded owner run when capacity pressure needs media relief. Storage and Media Circulation still select, revalidate, execute, and audit their own work; Retention never selects media IDs or deletes objects.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={prepareOwner.isPending} onClick={() => prepareOwner.mutate('storage')}>Request Storage preview</Button>
                            <Button variant="outline" disabled={prepareOwner.isPending} onClick={() => prepareOwner.mutate('media_circulation')}>Request Media Circulation run</Button>
                        </div>
                        <div className="space-y-2 border-t pt-3">
                            {(ownerRequests.data?.items ?? []).slice(0, 4).map((request) => (
                                <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                                    <div><p className="font-medium">{request.owner_system === 'storage' ? 'Storage' : 'Media Circulation'} · {request.status}</p><p className="text-xs text-muted-foreground">{formatBytes(request.max_bytes)} · {request.max_items ?? '—'} items · {request.max_actions ?? '—'} actions · expires {request.expires_at ? new Date(request.expires_at).toLocaleString() : '—'}</p></div>
                                    {retentionOperatorContext('retention_owner_request', request.id, 'Owner request') && <OperatorLaunchLink context={retentionOperatorContext('retention_owner_request', request.id, 'Owner request')!} intent="explain" size="sm" variant="outline">Explain</OperatorLaunchLink>}
                                    {request.status === 'approval_required' && request.action_id ? <Button size="sm" variant="outline" disabled={approveAction.isPending} onClick={() => approveAction.mutate(request.action_id!)}>Approve</Button> : null}
                                    {request.status === 'approved' ? <Button size="sm" variant="outline" disabled={executeOwner.isPending || !(policy?.enabled && policy.mode === 'assist')} onClick={() => executeOwner.mutate(request.id)}>Execute owner run</Button> : null}
                                </div>
                            ))}
                            {!ownerRequests.data?.items.length ? <p className="text-sm text-muted-foreground">No media-owner coordination requests yet.</p> : null}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-gold" />Historical retirement &amp; downgrade proof</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Retires only old finalized-archive News content. Sources, archive leads, likes, bookmarks, comments, active holds and recent telemetry are excluded.
                            Every execution creates a verified short-lived recovery artifact, reconciles redundancy ownership, rebuilds News snapshots, and runs deep feed and health checks.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => prepareHistorical.mutate(historicalCursor, { onSuccess: (manifest) => setHistoricalCursor(manifest.evidence?.has_more ? manifest.evidence.next_cursor : undefined) })} disabled={prepareHistorical.isPending}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />{historicalCursor ? 'Continue historical scan' : 'Prepare historical manifest'}
                            </Button>
                            <Button variant="outline" onClick={() => maintenanceReport.mutate({ provider_bytes: providerBytesMiB ? Number(providerBytesMiB) * MIB : undefined, provider_source: providerBytesMiB ? 'operator_readback' : undefined, physical_reclaim_confirmed: physicalReclaimConfirmed })} disabled={maintenanceReport.isPending}>
                                <Gauge className="mr-2 h-4 w-4" />Measure downgrade readiness
                            </Button>
                        </div>
                        <div className="grid gap-3 rounded-lg border bg-background/70 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <label className="space-y-1 text-xs text-muted-foreground">
                                <span className="block font-medium text-foreground">Authoritative provider allocation (MiB)</span>
                                <Input inputMode="numeric" type="number" min="0" value={providerBytesMiB} onChange={(event) => setProviderBytesMiB(event.target.value)} placeholder="Required for downgrade proof" />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Switch checked={physicalReclaimConfirmed} onCheckedChange={setPhysicalReclaimConfirmed} />
                                Operator physical reclaim/readback completed
                            </label>
                        </div>
                        {maintenanceReport.data ? (
                            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium">Latest readiness proof</span>
                                    <Badge variant={maintenanceReport.data.state === 'free_downgrade_ready' ? 'success' : 'warning'}>{maintenanceReport.data.state.replaceAll('_', ' ')}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    PostgreSQL {formatBytes(maintenanceReport.data.database_bytes)} · provider {formatBytes(maintenanceReport.data.provider_bytes)} · target {formatBytes(maintenanceReport.data.target_bytes)} · sparse values {maintenanceReport.data.sparse_use_count}
                                </p>
                            </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">Physical HNSW/TOAST reclaim remains an operator action; this report records the measured database size and confirms sparse-vector zero use before a Free downgrade.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4" />Recent observations</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {(runs.data?.items ?? []).slice(0, 8).map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                                <div>
                                    <p className="font-medium">{item.trigger} · policy v{item.policy_version}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(item.started_at).toLocaleString()}</p>
                                </div>
                                <span className="flex items-center gap-2"><Badge variant={verdictTone(item.verdict)}>{item.verdict}</Badge>{retentionOperatorContext('retention_run', item.id, 'Retention run') && <OperatorLaunchLink context={retentionOperatorContext('retention_run', item.id, 'Retention run')!} intent="explain" size="sm" variant="outline">Explain</OperatorLaunchLink>}</span>
                            </div>
                        ))}
                        {!runs.data?.items?.length ? <p className="text-sm text-muted-foreground">Run the first observation to establish a baseline.</p> : null}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Latest action ledger</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                            {(actions.data?.items ?? []).map((action) => (
                            <div key={action.id} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium">{action.action_class}</p>
                                    <Badge variant="secondary">{action.outcome}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {action.target_count} rows · {formatBytes(action.estimated_bytes)} · {action.guardrail}
                                </p>
                                {action.outcome === 'approval_required' ? (
                                    <Button className="mt-3" size="sm" variant="outline" disabled={approveAction.isPending} onClick={() => approveAction.mutate(action.id)}>
                                        Approve frozen manifest
                                    </Button>
                                ) : null}
                                {['approved', 'ready', 'tool_succeeded', 'verification_failed'].includes(action.outcome) ? (
                                    <Button
                                        className="mt-3"
                                        size="sm"
                                        variant={action.outcome === 'approved' && !action.action_class.includes('refresh_snapshots') ? 'destructive' : 'outline'}
                                        disabled={(action.action_class.includes('historical') ? executeHistorical.isPending : executeAction.isPending) || (action.outcome === 'approved' && !(policy?.enabled && policy.mode === 'assist'))}
                                        onClick={() => {
                                            const snapshotRefresh = action.action_class.includes('refresh_snapshots');
                                            if (action.outcome !== 'approved' || window.confirm(snapshotRefresh ? 'Refresh the bounded derived News snapshots? No canonical rows will be deleted.' : 'Execute the approved, immutable compaction manifest? This permanently retires only its selected redundant News rows after revalidation.')) {
                                                if (action.action_class.includes('historical')) executeHistorical.mutate(action.id);
                                                else executeAction.mutate(action.id);
                                            }
                                        }}
                                    >
                                        {action.action_class.includes('refresh_snapshots') ? (action.outcome === 'ready' ? 'Run trusted refresh' : 'Execute snapshot refresh') : action.outcome === 'approved' ? 'Execute approved manifest' : 'Retry verification'}
                                    </Button>
                                ) : null}
                            </div>
                        ))}
                        {!actions.data?.items?.length ? <p className="text-sm text-muted-foreground">No action proposals in the latest run.</p> : null}
                        <div className="space-y-2 border-t pt-3"><p className="text-xs text-muted-foreground">{holds.data?.items.length ?? 0} active retention holds are protecting content, stories, or months.</p>{(holds.data?.items ?? []).slice(0, 4).map((hold) => <div key={hold.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"><span>{hold.hold_class} · {hold.target_type}</span>{retentionOperatorContext('retention_hold', hold.id, 'Retention hold') && <OperatorLaunchLink context={retentionOperatorContext('retention_hold', hold.id, 'Retention hold')!} intent="explain" size="sm" variant="outline">Explain hold</OperatorLaunchLink>}</div>)}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function PolicyFact({ label, value }: { label: string; value: string }) {
    return <div className="rounded-md bg-muted/60 p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value}</p></div>;
}
