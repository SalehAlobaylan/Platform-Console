'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
    usePauseRetention,
    usePrepareRetentionCompaction,
    useRetentionHolds,
    useRetentionRunActions,
    useRetentionRuns,
    useRetentionRun,
    useRetentionActionReview,
    useRetentionStatus,
    useRunRetention,
    useUpdateRetentionPolicy,
    useUpdateRetentionExecutionControl,
    useMonthlyReviewPolicy,
    useMonthlyReviewArchives,
    useBuildMonthlyReview,
    useUpdateMonthlyReviewPolicy,
    useVerifyMonthlyReview,
    usePrepareHistoricalRetention,
    useExecuteHistoricalRetention,
    useRetentionMaintenanceReport,
} from '@/hooks/use-retention';
import type { RetentionAction, RetentionActionReview, RetentionExecutionControl, RetentionPolicyPatch, RetentionVerdict } from '@/types/platform/retention';

const MIB = 1024 * 1024;
const RETENTION_SETTINGS = [
    { key: 'database_target_bytes', label: 'Working target (MiB)', scale: MIB, min: 1 },
    { key: 'database_warning_bytes', label: 'Warning threshold (MiB)', scale: MIB, min: 1 },
    { key: 'database_action_bytes', label: 'Action threshold (MiB)', scale: MIB, min: 1 },
    { key: 'database_critical_bytes', label: 'Critical threshold (MiB)', scale: MIB, min: 1 },
    { key: 'schedule_interval_minutes', label: 'Observation interval (minutes)', scale: 1, min: 15, max: 10080 },
    { key: 'max_rows_per_run', label: 'Maximum rows per cleanup', scale: 1, min: 1, max: 10000 },
    { key: 'max_bytes_per_run', label: 'Maximum estimated cleanup (MiB)', scale: MIB, min: 1 },
] as const;
type RetentionSettingKey = typeof RETENTION_SETTINGS[number]['key'];
const CLEANUP_GATES = [
    { key: 'canonical_compaction_enabled', label: 'Allow current-month cleanup' },
    { key: 'historical_enabled', label: 'Allow archived-month cleanup' },
] as const;
const CLEANUP_STEPS = [
    { label: 'Observe', href: '#database-measurements' },
    { label: 'Prepare', href: '#prepare-cleanup' },
    { label: 'Review & approve', href: '#saved-cleanup' },
    { label: 'Enable & execute', href: '#execution-settings' },
    { label: 'Verify', href: '#saved-cleanup' },
];
const isCleanup = (action: RetentionAction) => ['news_database.prepare_compaction', 'news_database.compact_story', 'news_database.prepare_historical_purge', 'news_database.execute_historical_purge'].includes(action.action_class);
const cleanupLabel = (action: RetentionAction) => action.action_class.includes('historical') ? 'Archived-month News cleanup' : 'Current-month News cleanup';
const needsVerification = (action: RetentionAction) => ['tool_succeeded', 'verifying', 'verification_failed'].includes(action.outcome);
const actionStatus: Record<string, string> = { approval_required: 'Awaiting approval', approved: 'Approved', tool_succeeded: 'Cleanup applied', verifying: 'Verification pending', verification_failed: 'Verification needs attention', verification_passed: 'Verified', tool_failed: 'Execution blocked', expired: 'Expired' };
const retentionOperatorContext = (type: string, id: string, label: string) => createRouteVisibleContext('/platform/retention', { subjects: [{ type, id, label }] });

function formatBytes(value?: number | null) {
    if (value == null) return 'Unavailable';
    if (value > 0 && value < 1024) return `${value} B`;
    if (value >= 1024 && value < MIB) return `${(value / 1024).toFixed(1)} KiB`;
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
    const saveExecutionPolicy = useUpdateRetentionPolicy();
    const saveControls = useUpdateRetentionExecutionControl();
    const policy = status.data?.policy;

    const [selectedRunId, setSelectedRunId] = useState<string>();
    const [selectedActionId, setSelectedActionId] = useState<string>();
    const selectedRun = useRetentionRun(selectedRunId);
    const actions = useRetentionRunActions(selectedRunId);
    const review = useRetentionActionReview(selectedActionId);
    const [mode, setMode] = useState<'observe' | 'assist'>();
    const selectedMode = mode ?? (policy?.mode === 'assist' ? 'assist' : 'observe');
    const [enabledDraft, setEnabledDraft] = useState<boolean>();
    const [gateDraft, setGateDraft] = useState<Partial<RetentionExecutionControl>>({});
    const [executionReason, setExecutionReason] = useState('');
    const controls = status.data?.execution_controls;
    const executionPolicyPatch: RetentionPolicyPatch = {};
    if (mode !== undefined && mode !== policy?.mode) executionPolicyPatch.mode = mode;
    if (enabledDraft !== undefined && enabledDraft !== policy?.enabled) executionPolicyPatch.enabled = enabledDraft;
    const executionChanged = Object.keys(executionPolicyPatch).length > 0 || CLEANUP_GATES.some(({ key }) => gateDraft[key] !== undefined && gateDraft[key] !== controls?.[key]);
    const savingExecution = savePolicy.isPending || saveExecutionPolicy.isPending || saveControls.isPending;
    const discardExecutionEdits = () => { setMode(undefined); setEnabledDraft(undefined); setGateDraft({}); setExecutionReason(''); saveControls.reset(); saveExecutionPolicy.reset(); };
    const saveExecutionSettings = async () => {
        if (!policy || !controls || status.isError || !executionChanged || executionReason.trim().length < 10 || savingExecution) return;
        const gatePatch = Object.fromEntries(CLEANUP_GATES.filter(({ key }) => gateDraft[key] !== undefined && gateDraft[key] !== controls[key]).map(({ key }) => [key, gateDraft[key]]));
        try {
            // Each existing API persists independently; retain the draft on any failure.
            const disablingPolicy = executionPolicyPatch.enabled === false || executionPolicyPatch.mode === 'observe';
            if (disablingPolicy) await saveExecutionPolicy.mutateAsync(executionPolicyPatch);
            await saveControls.mutateAsync({ ...gatePatch, reason: executionReason.trim() });
            if (!disablingPolicy && Object.keys(executionPolicyPatch).length) await saveExecutionPolicy.mutateAsync(executionPolicyPatch);
            discardExecutionEdits();
        } catch { /* The mutation error and saved readiness remain visible. */ }
    };
    const [policyDraft, setPolicyDraft] = useState<Partial<Record<RetentionSettingKey, string>>>({});
    const policyEdit = useMemo(() => {
        const patch: RetentionPolicyPatch = {};
        if (!policy) return { patch, error: undefined };
        for (const field of RETENTION_SETTINGS) {
            const raw = policyDraft[field.key];
            if (raw === undefined) continue;
            const value = Number(raw);
            if (!raw.trim() || !Number.isSafeInteger(value) || !Number.isSafeInteger(value * field.scale) || value < field.min || ('max' in field && value > field.max)) {
                return { patch, error: `${field.label}: enter a whole number from ${field.min}${'max' in field ? ` to ${field.max}` : ''}.` };
            }
            if (value * field.scale !== policy[field.key]) patch[field.key] = value * field.scale;
        }
        const merged = { ...policy, ...patch };
        if (!(merged.database_target_bytes <= merged.database_warning_bytes && merged.database_warning_bytes < merged.database_action_bytes && merged.database_action_bytes < merged.database_critical_bytes)) {
            return { patch, error: 'Capacity levels must follow working target ≤ warning < action < critical.' };
        }
        return { patch, error: undefined };
    }, [policy, policyDraft]);
    const policyChanged = Object.keys(policyEdit.patch).length > 0;
    const discardPolicyEdits = () => { setPolicyDraft({}); savePolicy.reset(); };
    useEffect(() => {
        const restore = () => { const params = new URLSearchParams(window.location.search); setSelectedRunId(params.get('run') || undefined); setSelectedActionId(params.get('action') || undefined); };
        restore(); window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    const selectWork = (runId: string, actionId?: string) => {
        setSelectedRunId(runId); setSelectedActionId(actionId);
        const url = new URL(window.location.href); url.searchParams.set('run', runId);
        if (actionId) url.searchParams.set('action', actionId); else url.searchParams.delete('action');
        url.hash = '';
        window.history.replaceState(null, '', url);
        document.getElementById('cleanup-workflow')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };
    const sample = status.data?.latest_sample;
    const monthlyPolicy = useMonthlyReviewPolicy();
    const monthlyArchives = useMonthlyReviewArchives();
    const buildMonthlyReview = useBuildMonthlyReview();
    const verifyMonthlyReview = useVerifyMonthlyReview();
    const reviseMonthlyPolicy = useUpdateMonthlyReviewPolicy();
    const prepareHistorical = usePrepareHistoricalRetention();
    const executeHistorical = useExecuteHistoricalRetention();
    const maintenanceReport = useRetentionMaintenanceReport();
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

    const forecastReady = (status.data?.forecast.sample_count ?? 0) >= 2 && (status.data?.forecast.window_hours ?? 0) >= 1;
    const runwayCopy = useMemo(() => {
        const days = status.data?.forecast.runway_to_critical_days;
        if (sample && sample.database_bytes > (policy?.database_critical_bytes ?? 480 * MIB)) return 'The critical line has already been crossed.';
        if (!forecastReady) return 'Growth needs at least two samples spanning one hour.';
        if (days == null) return 'No positive growth was measured in this sample window.';
        if (days < 0) return 'The critical line has already been crossed.';
        return `${days.toFixed(days < 10 ? 1 : 0)} days to the critical line at the measured growth rate.`;
    }, [forecastReady, policy?.database_critical_bytes, sample, status.data?.forecast.runway_to_critical_days]);

    const currentAction = actions.data?.items.find((action) => action.id === selectedActionId);
    const exactReview = (action: RetentionAction) => selectedActionId === action.id && !selectedRun.isError && !actions.isError && !actions.isFetching && !review.isFetching && !review.isError && review.data?.action_id === action.id && review.data.run_id === selectedRunId && review.data.manifest.manifest_hash === action.manifest_hash;
    const unexpiredReview = (action: RetentionAction) => exactReview(action) && Date.parse(review.data!.manifest.expires_at) > Date.now();
    const executionBlockers = (action: RetentionAction) => {
        const gate = action.action_class.includes('historical') ? CLEANUP_GATES[1] : CLEANUP_GATES[0];
        return [
            (!policy || !controls || status.isError) && 'Execution settings could not be confirmed. Refresh before continuing.',
            !exactReview(action) && 'Load the exact saved manifest before continuing.',
            !controls?.[gate.key] && `Enable “${gate.label}” in Execution settings.`,
            action.outcome === 'approved' && !unexpiredReview(action) && 'A current, unexpired manifest is required. Prepare again if it has expired.',
            action.outcome === 'approved' && !policy?.enabled && 'Enable Retention in Execution settings.',
            action.outcome === 'approved' && policy?.mode !== 'assist' && 'Choose Assist in Execution settings.',
        ].filter(Boolean) as string[];
    };
    const executionAllowed = Boolean(policy?.enabled && policy.mode === 'assist' && !status.isError && (controls?.canonical_compaction_enabled || controls?.historical_enabled));
    let stage = sample ? 2 : 1;
    let stageTitle = sample ? 'Choose a cleanup to prepare' : 'Measure the database first';
    let stageCopy = sample ? 'Choose current-month duplicates or archived-month News below. Preparation saves exact rows for review.' : 'Run an observation to measure database pressure and preview cleanup candidates.';
    let nextHref = sample ? '#prepare-cleanup' : '#database-measurements';
    let nextLabel = sample ? 'Choose cleanup' : 'Go to observation';
    if (selectedRunId) {
        stage = 3; stageTitle = 'Choose a saved action to review'; stageCopy = 'Open the exact manifest in Selected cleanup to continue this saved run.'; nextHref = '#saved-cleanup'; nextLabel = 'Go to selected cleanup';
        if (selectedRun.isLoading || actions.isLoading || (selectedActionId && review.isLoading)) { stageTitle = 'Loading selected cleanup'; stageCopy = 'Checking saved action and manifest evidence.'; }
        else if (selectedRun.isError || actions.isError || (selectedActionId && (review.isError || !currentAction || !review.data))) { stageTitle = 'Saved work needs attention'; stageCopy = 'Saved evidence is unavailable. Approval and execution stay blocked; your selection is preserved.'; }
        else if (!actions.data?.items.length) { stage = 2; stageTitle = selectedRun.data?.error ? 'Preparation needs attention' : 'Observation saved'; stageCopy = selectedRun.data?.error ?? 'This run has no cleanup action. Prepare a cleanup plan to continue.'; nextHref = '#prepare-cleanup'; nextLabel = 'Choose cleanup'; }
        else if (currentAction) {
            if (!isCleanup(currentAction)) { stageTitle = 'Saved evidence only'; stageCopy = 'This retired capability cannot execute. Prepare a supported News cleanup below.'; }
            else if (needsVerification(currentAction)) { stage = 5; stageTitle = currentAction.outcome === 'verification_failed' ? 'Verification needs attention' : 'Cleanup applied · verification remains'; stageCopy = 'The cleanup already ran. Retry verification checks the original work without deleting the rows again.'; nextLabel = 'Go to verification'; }
            else if (currentAction.outcome === 'verification_passed') { stage = 5; stageTitle = 'Cleanup verified'; stageCopy = 'The saved cleanup and readback checks passed. Observe again to measure current capacity.'; nextHref = '#database-measurements'; nextLabel = 'Go to observation'; }
            else if (['expired', 'tool_failed', 'rejected', 'skipped'].includes(currentAction.outcome) || (exactReview(currentAction) && !unexpiredReview(currentAction))) { stage = 2; stageTitle = 'A new cleanup plan is required'; stageCopy = 'This plan cannot execute. Review its saved evidence and prepare a new bounded plan.'; nextHref = '#prepare-cleanup'; nextLabel = 'Choose cleanup'; }
            else if (['running', 'claimed'].includes(currentAction.outcome)) { stage = 4; stageTitle = 'Cleanup execution in progress'; stageCopy = 'CMS is processing this saved cleanup. Refresh to read its outcome before starting more work.'; nextLabel = 'Go to selected cleanup'; }
            else if (currentAction.outcome === 'approved') { stage = 4; stageTitle = executionBlockers(currentAction).length ? 'Approved · execution is blocked' : 'Approved · ready to execute'; stageCopy = executionBlockers(currentAction).length ? 'Complete the listed requirements in Execution settings, then return to the approved cleanup.' : 'Execute the approved exact rows in Selected cleanup. CMS rechecks protections before applying changes.'; nextHref = executionBlockers(currentAction).length ? '#execution-settings' : '#saved-cleanup'; nextLabel = executionBlockers(currentAction).length ? 'Open execution settings' : 'Go to execution'; }
            else { stageTitle = 'Review and approve the cleanup'; stageCopy = 'Inspect the rows to remove, retained rows, expiry and protection evidence. Approval saves your decision; execution is a separate step.'; }
        }
    }
    if (run.isPending) { stage = 1; stageTitle = 'Observing the database'; stageCopy = 'Collecting fresh measurements. Your saved cleanup selection stays in place.'; }
    if (prepareCompaction.isPending || prepareHistorical.isPending) { stage = 2; stageTitle = 'Preparing exact cleanup rows'; stageCopy = 'Checking candidates and protections. No rows are being deleted.'; }
    if (executeAction.isPending || executeHistorical.isPending) { stage = currentAction && needsVerification(currentAction) ? 5 : 4; stageTitle = stage === 5 ? 'Verifying the original cleanup' : 'Executing approved cleanup'; stageCopy = 'Wait for CMS to return saved execution and verification evidence.'; }

    if (!policy && status.isLoading) {
        return <p className="text-sm text-muted-foreground">Loading Retention maintenance…</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Database custody</Badge>
                        <Badge variant={executionAllowed ? 'warning' : 'secondary'}>
                            {executionAllowed ? 'Reviewed cleanup enabled' : 'New cleanup execution disabled'}
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Retention maintenance</h1>
                    <p className="mt-2 text-muted-foreground">
                        Clean up eligible News rows through a reviewed plan. Follow the stages below;
                        sources and protected interactions are preserved.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {operatorContext ? <OperatorLaunchLink context={operatorContext} intent="investigate" variant="outline">Explain custody</OperatorLaunchLink> : null}
                    <Button variant="outline" onClick={() => { void status.refetch(); void runs.refetch(); if (selectedRunId) { void selectedRun.refetch(); void actions.refetch(); } if (selectedActionId) void review.refetch(); }} disabled={status.isFetching || actions.isFetching || review.isFetching}>
                        <RefreshCw className="mr-2 h-4 w-4" />Refresh
                    </Button>
                </div>
            </div>

            {status.isError ? <p role="alert" className="text-sm text-destructive">Retention status could not be refreshed. Execution is blocked until saved settings can be confirmed.</p> : null}
            <Card id="cleanup-workflow" className="scroll-mt-6" aria-label="Cleanup workflow">
                <CardHeader>
                    <p className="text-xs font-medium text-muted-foreground">CURRENT STAGE · {stage} OF 5</p>
                    <CardTitle className="text-xl" aria-live="polite">{stageTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Cleanup stages">
                        {CLEANUP_STEPS.map((step, index) => <li key={step.label}><a href={step.href} aria-current={stage === index + 1 ? 'step' : undefined} className={`flex h-full items-center gap-2 rounded-md border p-3 text-sm ${stage === index + 1 ? 'border-primary bg-primary/10 font-semibold' : 'text-muted-foreground'}`}><span aria-hidden="true">{index + 1}.</span>{step.label}</a></li>)}
                    </ol>
                    <p className="text-sm text-muted-foreground">{stageCopy}</p>
                    {currentAction && isCleanup(currentAction) ? <p className="text-sm font-medium">{cleanupLabel(currentAction)} · {currentAction.target_count} rows · {formatBytes(currentAction.estimated_bytes)}</p> : null}
                    <div className="flex flex-wrap gap-2"><Button asChild><a href={nextHref}>{nextLabel}</a></Button><Button asChild variant="outline"><a href="#execution-settings">Execution settings</a></Button><Button asChild variant="ghost"><a href="#retention-history">Resume saved work</a></Button></div>
                    <p className="text-xs text-muted-foreground">Cleanup removes reviewed rows. Physical storage reclamation and other database repairs require separate operator maintenance.</p>
                </CardContent>
            </Card>

            <Card id="saved-cleanup" className="scroll-mt-6">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Selected cleanup · review, execute &amp; verify</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {!selectedRunId ? <p className="text-sm text-muted-foreground">No cleanup selected. Prepare a plan below or resume a saved run.</p> : <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Saved run details</summary><p className="break-all">Run {selectedRunId} · {selectedRun.data?.status ?? 'loading'}. Cleanup status is shown on its action below.</p></details>}
                        {(selectedRun.isError || actions.isError) ? <p role="alert">Saved work could not be loaded. Selection is preserved.</p> : null}
                        {(actions.data?.items ?? []).map((action) => {
                            const manual = isCleanup(action);
                            const blockers = executionBlockers(action);
                            return <div key={action.id} className="rounded-md border p-3 text-sm">
                                <p className="font-medium">{manual ? cleanupLabel(action) : action.action_class}</p><Badge variant={action.outcome === 'verification_failed' ? 'warning' : 'secondary'}>{actionStatus[action.outcome] ?? action.outcome.replaceAll('_', ' ')}</Badge>
                                <p className="mt-1 text-xs text-muted-foreground">{action.target_count} rows {needsVerification(action) || action.outcome === 'verification_passed' ? 'removed' : 'to remove'} · {formatBytes(action.estimated_bytes)}</p>
                                {manual && selectedActionId !== action.id ? <Button className="mt-3" size="sm" variant="outline" onClick={() => selectWork(selectedRunId!, action.id)}>Review cleanup plan</Button> : !manual ? <p className="mt-2 text-xs text-muted-foreground">Retired capability · saved evidence only</p> : null}
                                {review.data && selectedActionId === action.id && review.data.action_id === action.id && review.data.run_id === selectedRunId ? <FrozenManifest key={review.data.action_id} review={review.data} /> : null}
                                {manual && action.outcome === 'approval_required' ? <><p className="mt-3 text-xs text-muted-foreground">{!exactReview(action) ? 'Review the exact saved rows to unlock approval.' : !unexpiredReview(action) ? 'This manifest expired. Prepare a new plan before approval.' : 'Approval records your decision. Execute separately after enabling the matching cleanup control.'}</p><Button className="mt-3" size="sm" variant="outline" disabled={!unexpiredReview(action) || approveAction.isPending} onClick={() => approveAction.mutate(action.id)}>Approve cleanup plan</Button></> : null}
                                {manual && (action.outcome === 'approved' || needsVerification(action)) ? <>
                                {blockers.length ? <div className="mt-3 rounded-md border p-3"><p className="font-medium">{needsVerification(action) ? 'Verification requirements' : 'Before execution'}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul><a className="mt-2 inline-block text-xs underline" href="#execution-settings">Open execution settings</a></div> : null}
                                <Button className="mt-3" size="sm" variant={action.outcome === 'approved' ? 'destructive' : 'outline'} disabled={blockers.length > 0 || savingExecution || executeAction.isPending || executeHistorical.isPending} onClick={() => {
                                    if (action.outcome !== 'approved' || window.confirm('Execute the approved exact News manifest after revalidation?')) {
                                        if (action.action_class.includes('historical')) executeHistorical.mutate(action.id); else executeAction.mutate(action.id);
                                    }
                                }}>{executeAction.isPending || executeHistorical.isPending ? 'Working…' : action.outcome === 'approved' ? 'Execute approved cleanup' : 'Retry verification'}</Button></> : null}
                                {needsVerification(action) ? <p className="mt-2 text-xs text-muted-foreground">Cleanup committed; verification remains. Retry checks the original work.</p> : null}
                                {typeof action.verification?.error === 'string' ? <p className="mt-2 text-sm text-destructive">Last check: {action.verification.error}</p> : null}
                                {typeof action.verification?.error === 'string' && action.verification.error.includes('feed integrity') ? <Link className="mt-2 inline-block text-xs underline" href="/platform/feed-integrity">Inspect Feed Integrity</Link> : null}
                                {action.outcome === 'verification_failed' && action.verification ? <details className="mt-2"><summary className="cursor-pointer text-xs">Verification evidence</summary><pre className="overflow-auto text-xs">{JSON.stringify(action.verification, null, 2)}</pre></details> : null}
                            </div>;
                        })}
                        {selectedActionId && (review.isError || (!review.isLoading && !review.data)) ? <p role="alert">Exact manifest is unavailable; approval and execution are blocked.</p> : null}
                        {approveAction.isError || executeAction.isError || executeHistorical.isError ? <p role="alert" className="text-sm text-destructive">{approveAction.error?.message ?? executeAction.error?.message ?? executeHistorical.error?.message}</p> : null}
                        {selectedRunId && !actions.isLoading && !actions.data?.items?.length ? <p className="text-sm text-muted-foreground">No actions in this saved run.</p> : null}
                        <div className="space-y-2 border-t pt-3"><p className="text-xs text-muted-foreground">{holds.data?.items.length ?? 0} active retention holds are protecting content, stories, or months.</p>{(holds.data?.items ?? []).slice(0, 4).map((hold) => <div key={hold.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"><span>{hold.hold_class} · {hold.target_type}</span>{retentionOperatorContext('retention_hold', hold.id, 'Retention hold') && <OperatorLaunchLink context={retentionOperatorContext('retention_hold', hold.id, 'Retention hold')!} intent="explain" size="sm" variant="outline">Explain hold</OperatorLaunchLink>}</div>)}</div>
                    </CardContent>
                </Card>

            <Card id="database-measurements" className="scroll-mt-6 overflow-hidden border-gold/30">
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">1. Database observation</CardTitle><Button onClick={() => run.mutate()} disabled={run.isPending}><Play className="mr-2 h-4 w-4" />{run.isPending ? 'Observing…' : 'Run observation'}</Button></CardHeader>
                {run.isError ? <p role="alert" className="px-6 pb-3 text-sm text-destructive">Observation failed: {run.error.message}</p> : null}
                <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
                    <div className="border-b bg-gold/5 p-6 lg:border-b-0 lg:border-r">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">Allocated database</p>
                            <Badge variant={verdictTone(status.data?.capacity_verdict)}>{status.data?.capacity_verdict ?? 'inconclusive'}</Badge>
                        </div>
                        <p className="mt-3 text-5xl font-semibold tracking-[-0.05em]">
                            {sample ? (sample.database_bytes / MIB).toFixed(0) : '—'}
                            <span className="ml-2 text-base font-medium tracking-normal text-muted-foreground">MiB</span>
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">{runwayCopy}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Maintenance: {status.data?.verdict ?? 'inconclusive'}</p>
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
                            <Metric label="Growth / day" value={formatBytes(forecastReady ? status.data?.forecast.growth_bytes_per_day : undefined)} />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card id="prepare-cleanup" className="scroll-mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ArchiveRestore className="h-4 w-4 text-gold" />2. Prepare current-month cleanup
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <Metric label="Dormant stories" value={String(status.data?.preview.eligible_stories ?? 0)} />
                            <Metric label="Inspected rows" value={String(status.data?.preview.candidate_rows ?? 0)} />
                            <Metric label="Inspected bytes" value={formatBytes(status.data?.preview.estimated_bytes)} />
                            <Metric label="Protection" value="Checked during preparation" />
                        </div>
                        <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                            <div>
                                <p className="text-sm font-medium">Execution is human-approved and bounded</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    A prepared plan freezes its exact rows. Execution requires enabled Assist mode and the current-month cleanup control,
                                    revalidates protection and dependencies, invalidates every News snapshot, and requires readback.
                                </p>
                            </div>
                        </div>
                        <Button
                            className="mt-4"
                            variant="outline"
                            disabled={prepareCompaction.isPending || (status.data?.preview.candidate_rows ?? 0) === 0}
                            onClick={() => prepareCompaction.mutate(compactionCursor, { onSuccess: (manifest) => { setCompactionCursor(manifest.evidence?.has_more ? manifest.evidence.next_cursor : undefined); selectWork(manifest.run_id, manifest.action_id); } })}
                        >
                            <ArchiveRestore className="mr-2 h-4 w-4" />{prepareCompaction.isPending ? 'Preparing…' : compactionCursor ? 'Continue bounded scan' : 'Prepare current-month plan'}
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            This freezes the candidate evidence for review. It does not compact or delete anything. Blocked or oversized stories are skipped and the next bounded page can be continued here.
                        </p>
                        {(status.data?.preview.candidate_rows ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No current-month candidates were found. Run a new observation to refresh the preview.</p> : null}
                        {prepareCompaction.isError ? <p role="alert" className="mt-2 text-sm text-destructive">Plan preparation failed: {prepareCompaction.error.message}</p> : null}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-gold" />2. Prepare archived-month cleanup</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Retires only old finalized-archive News content. Sources, archive leads, likes, bookmarks, comments, active holds and recent telemetry are excluded.
                            Every execution creates a verified short-lived recovery artifact, reconciles redundancy ownership, rebuilds News snapshots, and runs deep feed and health checks.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => prepareHistorical.mutate(historicalCursor, { onSuccess: (manifest) => { setHistoricalCursor(manifest.evidence?.has_more ? manifest.evidence.next_cursor : undefined); selectWork(manifest.run_id, manifest.action_id); } })} disabled={prepareHistorical.isPending || status.data?.historical?.finalized_archives === 0}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />{prepareHistorical.isPending ? 'Preparing…' : historicalCursor ? 'Continue historical scan' : 'Prepare archived-month plan'}
                            </Button>
                        </div>
                        {status.data?.historical?.finalized_archives === 0 ? <p className="text-sm text-muted-foreground">No finalized monthly archive yet. <a className="underline" href="#monthly-archive">Build and verify Month in Review</a> before preparing archived-month cleanup.</p> : null}
                        {prepareHistorical.isError ? <p role="alert" className="text-sm text-destructive">Plan preparation failed: {prepareHistorical.error.message}</p> : null}
                        <details><summary className="cursor-pointer text-sm">Advanced provider readiness</summary>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                        </details>
                    </CardContent>
                </Card>
            </div>

            <Card id="execution-settings" className="scroll-mt-6">
                <CardHeader><CardTitle className="text-base">4. Execution settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">To execute a new cleanup, enable Retention, choose Assist, and allow its cleanup type. Save these settings, then execute the approved plan in Selected cleanup. Saving settings never runs a cleanup.</p>
                    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveExecutionSettings(); }}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span><span className="block font-medium">Retention enabled</span><span className="text-xs text-muted-foreground">Also enables scheduled observations every {policy?.schedule_interval_minutes ?? 360} minutes.</span></span><Switch aria-label="Retention enabled" checked={enabledDraft ?? policy?.enabled ?? false} disabled={!policy || savingExecution} onCheckedChange={setEnabledDraft} /></label>
                            <label className="block text-sm"><span className="mb-2 block font-medium">Operating mode</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedMode} disabled={!policy || savingExecution} onChange={(event) => setMode(event.target.value as 'observe' | 'assist')}><option value="observe">Observe</option><option value="assist">Assist</option></select><span className="mt-1 block text-xs text-muted-foreground">Observe measures only. Assist permits reviewed, manual cleanup.</span></label>
                            {CLEANUP_GATES.map(({ key, label }) => <label key={key} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span>{label}<span className="mt-1 block text-xs text-muted-foreground">Saved: {controls?.[key] ? 'allowed' : 'disabled'}</span></span><Switch aria-label={label} checked={gateDraft[key] ?? controls?.[key] ?? false} disabled={!controls || savingExecution} onCheckedChange={(value) => setGateDraft((draft) => ({ ...draft, [key]: value }))} /></label>)}
                        </div>
                        {policy?.mode === 'safe_auto' ? <p className="text-sm text-muted-foreground">Saved Safe Auto policy is inactive. Observations use Observe mode; choose Assist explicitly for manual cleanup.</p> : null}
                        <label className="block text-sm"><span className="mb-1 block font-medium">Reason for execution settings</span><Input value={executionReason} disabled={savingExecution} onChange={(event) => setExecutionReason(event.target.value)} placeholder="Explain the change (at least 10 characters)" /></label>
                        <p className="text-xs text-muted-foreground">An administrator must save these controls with an audit reason. Verification retries need the matching cleanup type allowed; they do not require Assist or a new approval.</p>
                        {saveControls.isError || saveExecutionPolicy.isError ? <p role="alert" className="text-sm text-destructive">Execution settings were not fully saved: {(saveControls.error ?? saveExecutionPolicy.error)?.message}. Each setting is persisted separately; readiness reflects saved settings. Your draft is retained.</p> : null}
                        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!policy || !controls || status.isError || !executionChanged || executionReason.trim().length < 10 || savingExecution}>{savingExecution ? 'Saving…' : 'Save execution settings'}</Button><Button type="button" variant="ghost" disabled={savingExecution || (!executionChanged && !executionReason && mode === undefined && enabledDraft === undefined && !Object.keys(gateDraft).length)} onClick={discardExecutionEdits}>Discard execution edits</Button><Button asChild variant="outline"><a href="#saved-cleanup">Return to selected cleanup</a></Button></div>
                    </form>
                    <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground"><span>Scheduled observations: {policy?.enabled ? status.data?.paused ? 'paused' : 'enabled' : 'disabled'}. Manual cleanup follows the execution settings above.</span><Button size="sm" variant="outline" onClick={() => pause.mutate(120)} disabled={pause.isPending}><Pause className="mr-2 h-4 w-4" />Pause observations 2 hours</Button><Link className="underline" href="/platform/recovery">Content recovery / Pods Reset</Link></div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" />Policy in force</CardTitle></CardHeader>
                    <CardContent className="space-y-5">
                        <form className="space-y-4" noValidate onSubmit={(event) => {
                            event.preventDefault();
                            if (policy && policyChanged && !policyEdit.error && !savingExecution) savePolicy.mutate(policyEdit.patch, { onSuccess: discardPolicyEdits });
                        }}>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {RETENTION_SETTINGS.map((field) => (
                                    <label key={field.key} className="block text-sm">
                                        <span className="mb-1 block font-medium">{field.label}</span>
                                        <Input type="number" min={field.min} max={'max' in field ? field.max : undefined} step={1}
                                    disabled={!policy || savingExecution}
                                            value={policyDraft[field.key] ?? (policy ? String(policy[field.key] / field.scale) : '')}
                                            aria-invalid={Boolean(policyEdit.error)} aria-describedby="retention-settings-help"
                                            onChange={(event) => setPolicyDraft((draft) => ({ ...draft, [field.key]: event.target.value }))} />
                                    </label>
                                ))}
                            </div>
                            <p id="retention-settings-help" className="text-xs text-muted-foreground">
                                Capacity levels use allocated PostgreSQL size. Cleanup limits bound each reviewed manifest; the byte limit is an estimate. Cleanup limits are checked again before execution. Observation timing applies when scheduling is enabled and resumed.
                            </p>
                            {policyEdit.error ? <p role="alert" className="text-sm text-destructive">{policyEdit.error}</p> : null}
                            {savePolicy.isError ? <p role="alert" className="text-sm text-destructive">Policy was not saved: {savePolicy.error.message}</p> : null}
                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1" variant="outline" disabled={!policy || !policyChanged || Boolean(policyEdit.error) || savingExecution}>
                                    {savePolicy.isPending ? 'Saving…' : 'Save policy'}
                                </Button>
                                <Button type="button" variant="ghost" disabled={savePolicy.isPending || !Object.keys(policyDraft).length} onClick={discardPolicyEdits}>Discard</Button>
                            </div>
                        </form>
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
                <Card id="monthly-archive" className="scroll-mt-6">
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
                    <CardHeader><CardTitle className="text-base">Native media maintenance</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-4 text-sm"><Link className="underline" href="/platform/storage">Storage</Link><Link className="underline" href="/platform/media/circulation">Media Circulation</Link></CardContent>
                </Card>
                <details><summary className="cursor-pointer text-sm">Advanced allocation advice</summary>
                <Card>
                    <CardHeader><CardTitle className="text-base">Heavy-News satellite evaluation</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">This is an operator recommendation only. Retention never creates partitions or rewrites tables.</p>
                        <div className="flex items-center justify-between gap-2 text-sm"><span>Monthly cycles</span><Badge variant={status.data?.satellite_evaluation?.state === 'evaluated' ? 'success' : 'warning'}>{status.data?.satellite_evaluation?.completed_cycles ?? 0} / {status.data?.satellite_evaluation?.required_cycles ?? 2}</Badge></div>
                        <p className="text-sm font-medium">{status.data?.satellite_evaluation?.recommendation?.replaceAll('_', ' ') ?? 'waiting for measurements'}</p>
                        <p className="text-xs text-muted-foreground">{status.data?.satellite_evaluation?.reason ?? 'The evaluation will appear after the retention status refreshes.'}</p>
                    </CardContent>
                </Card>
                </details>
            </div>

            <Card id="retention-history" className="scroll-mt-6">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4" />Saved runs</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {(runs.data?.items ?? []).map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                                <div>
                                    <p className="font-medium">{String(item.after_evidence?.operation ?? 'Observation')} · {item.trigger} · policy v{item.policy_version}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(item.started_at).toLocaleString()}</p>
                                    {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                                </div>
                                <span className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => selectWork(item.id)}>Open run</Button><Badge variant={verdictTone(item.verdict)}>{item.verdict}</Badge>{retentionOperatorContext('retention_run', item.id, 'Retention run') && <OperatorLaunchLink context={retentionOperatorContext('retention_run', item.id, 'Retention run')!} intent="explain" size="sm" variant="outline">Explain</OperatorLaunchLink>}</span>
                            </div>
                        ))}
                        {!runs.data?.items?.length ? <p className="text-sm text-muted-foreground">Run the first observation to establish a baseline.</p> : null}
                    </CardContent>
                </Card>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function PolicyFact({ label, value }: { label: string; value: string }) {
    return <div className="rounded-md bg-muted/60 p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value}</p></div>;
}

function FrozenManifest({ review }: { review: RetentionActionReview }) {
    const [page, setPage] = useState(0);
    const manifest = review.manifest;
    const groups = 'retire_content_ids' in manifest ? { stories: manifest.story_ids ?? [], anchors: manifest.anchor_content_ids ?? [], protected: manifest.protected_content_ids ?? [], retire: manifest.retire_content_ids ?? [] } : { stories: manifest.story_ids ?? [], retire: manifest.content_ids ?? [] };
    const pages = Math.max(1, ...Object.values(groups).map(ids => Math.ceil(ids.length / 50)));
    return <div className="space-y-2 rounded-md border p-3 text-xs">
        <p className="mt-3 font-medium">Exact rows in this plan</p>
        <p>Remove {groups.retire.length} rows{ groups.anchors ? ` · retain ${groups.anchors.length} anchors · protect ${groups.protected.length} rows` : ''}. Expand each group to inspect its IDs.</p>
        <p>Policy v{manifest.policy_version} · {manifest.timezone} · {manifest.state} · expires {new Date(manifest.expires_at).toLocaleString()}</p>
        <details><summary className="cursor-pointer">Plan identity &amp; hash</summary><p>Frozen manifest {manifest.id}</p><p className="break-all">Hash {manifest.manifest_hash}</p></details>
        <p>Frozen protection evidence; execution rechecks current references.</p>
        <p>Approval: {review.approved_at ? `${review.approved_by} · ${new Date(review.approved_at).toLocaleString()}` : 'Awaiting approval'}</p>
        {Object.entries(groups).map(([label, ids]) => <details key={label}><summary className="cursor-pointer">{label === 'retire' ? 'Rows to remove' : label === 'anchors' ? 'Retained anchors' : label === 'protected' ? 'Protected rows' : 'Stories'} · {ids.length} exact IDs</summary><pre className="overflow-auto">{ids.slice(page * 50, (page + 1) * 50).join('\n') || 'None on this page'}</pre></details>)}
        <details><summary>Frozen exclusions and scan evidence</summary><pre className="overflow-auto">{JSON.stringify({ ...manifest.evidence, stories: undefined }, null, 2)}</pre></details>
        {'retire_content_ids' in manifest ? <details><summary>Frozen leads and representatives by story</summary><pre className="overflow-auto">{JSON.stringify(manifest.evidence?.stories?.slice(page * 50, (page + 1) * 50) ?? [], null, 2)}</pre></details> : null}
        <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous IDs</Button><span>Page {page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next IDs</Button></div>
    </div>;
}
