'use client';

import { type ElementType, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    HardDrive,
    AlertTriangle,
    Trash2,
    RefreshCw,
    PlayCircle,
    RotateCcw,
    Loader2,
    Snowflake,
    Shield,
    Clock,
    Sliders,
    Activity,
    Zap,
    ArrowRight,
    Database,
    Gauge,
    Layers3,
    ListChecks,
    ShieldCheck,
    Workflow,
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    formatBytes,
    usePolicyOverrides,
    usePurgeStorage,
    useReconcileStorage,
    useRestoreStorageItem,
    useRunSweepNow,
    useStorageArtifactEvents,
    useStorageCandidates,
    useStorageHealth,
    useStorageOperations,
    useStoragePolicy,
    useStoragePreview,
    useStorageRecommendations,
    useStorageStats,
    useSweepRuns,
    useUpdateStoragePolicy,
    useDeletePolicyOverride,
} from '@/hooks/use-storage';
import type {
    OpClassStatus,
    StorageOperationsResponse,
} from '@/types/platform/storage-ops';
import { useQualityProfiles } from '@/hooks/use-quality';
import { useDeliveryInventory, useDeliveryPolicies, useDeliveryRepairStatus, useDeliveryRoutePreview, useRequestDeliveryRepair, useRollbackDeliveryGeneration, useSetDeliveryPolicyActive, useUpdateDeliveryPolicy } from '@/hooks/use-media-delivery';
import { getPreset } from '@/lib/constants/ingest-presets';
import EmbeddedQualityPage from '@/app/(dashboard)/platform/quality/page';
import type {
    ReconcileResponse,
    StoragePolicy,
    StorageStats,
    UpdatePolicyRequest,
    StorageProofMetrics,
} from '@/types/platform/storage';

const SECTION_IDS = ['cockpit', 'quality', 'delivery', 'candidates', 'ledger', 'policy', 'operations'] as const;
type StorageSection = typeof SECTION_IDS[number];

type ArtifactTone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'slate';

interface NormalizedArtifact {
    groupId: string;
    groupLabel: string;
    detailLabel: string;
    actionHint: string;
    tone: ArtifactTone;
}

interface ArtifactGroup {
    id: string;
    label: string;
    bytes: number;
    prefixCount: number;
    percent: number;
    actionHint: string;
    tone: ArtifactTone;
    details: Array<{ key: string; label: string; bytes: number; percent: number }>;
}

interface ContentTypeRow {
    name: string;
    bytes: number;
    count: number;
    averageBytes: number;
    percent: number;
}

export default function StoragePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const legacyTab = searchParams.get('tab');
    const activeSection = normalizeSection(searchParams.get('section'), legacyTab);

    function handleSectionChange(value: StorageSection) {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.delete('tab');
        params.set('section', value);
        router.replace(`/platform/storage?${params.toString()}`);
        requestAnimationFrame(() => {
            document.getElementById(`storage-${value}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }

    const stats = useStorageStats();
    const sweepRuns = useSweepRuns();
    const runSweep = useRunSweepNow();
    const reconcile = useReconcileStorage();

    // Page-level status pill — what the operator sees at a glance.
    // Priority: aggregation error > over-quota > warn (>=80%) > ok.
    const utilization = stats.data?.utilization_pct ?? 0;
    const pageStatus: 'ok' | 'warn' | 'err' = stats.data?.aggregation_error
        ? 'err'
        : utilization >= 80
            ? 'warn'
            : 'ok';
    const pageStatusLabel = pageStatus === 'err' ? 'S3 UNREACHABLE' : pageStatus === 'warn' ? 'WARN' : 'OK';
    const pageStatusVariant = pageStatus === 'err' ? 'destructive' : pageStatus === 'warn' ? 'secondary' : 'success';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <header className="overflow-hidden rounded-lg border border-border bg-[radial-gradient(circle_at_12%_20%,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] text-slate-50 shadow-sm">
                <div className="grid gap-6 p-5 lg:grid-cols-[1.3fr_0.7fr] lg:p-6">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-amber-300/30 bg-amber-300/10">
                                <HardDrive className="h-6 w-6 text-amber-300" />
                            </div>
                            <div>
                                <p className="brand-overline text-gold">Media control room</p>
                                <h1 className="text-2xl font-semibold tracking-normal text-white md:text-3xl">
                                    Storage + Quality Cockpit
                                </h1>
                            </div>
                            <Badge variant={pageStatusVariant}>{pageStatusLabel}</Badge>
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-slate-300">
                            Manage media bytes, playback profiles, cold movement, recoverable deletion,
                            and artifact recovery from one internal surface. Feed visibility and ranking
                            stay outside this system.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                onClick={() => stats.refetch()}
                                disabled={stats.isFetching}
                                className="bg-white text-slate-950 hover:bg-slate-200"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${stats.isFetching ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => runSweep.mutate()}
                                disabled={runSweep.isPending}
                                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                            >
                                {runSweep.isPending
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <PlayCircle className="mr-2 h-4 w-4" />}
                                Run sweep
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reconcile.mutate()}
                                disabled={reconcile.isPending}
                                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                            >
                                {reconcile.isPending
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Database className="mr-2 h-4 w-4" />}
                                Reconcile
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase text-slate-400">Current pressure</p>
                        <p className="mt-2 text-4xl font-semibold text-white">
                            {utilization.toFixed(1)}%
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                className={`h-full ${pageStatus === 'err' ? 'bg-red-500' : pageStatus === 'warn' ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
                            />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-400">
                            First safe action is bounded re-encode. Cold tier is preferred when
                            available. Recoverable deletion means best-effort re-ingestion, not a
                            guaranteed restore.
                        </p>
                    </div>
                </div>
            </header>

            {stats.data?.aggregation_error && (
                <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
                    <div>
                        <p className="font-medium">Live S3 stats unavailable</p>
                        <p className="text-muted-foreground">{stats.data.aggregation_error}</p>
                        <p className="text-muted-foreground">Showing DB-tracked totals as a fallback.</p>
                    </div>
                </div>
            )}

            <SectionNav active={activeSection} onChange={handleSectionChange} />

            <section id="storage-cockpit" className="scroll-mt-24 space-y-6">
                <StorageCockpit onSectionChange={handleSectionChange} />
                <SectionHeading
                    icon={Gauge}
                    eyebrow="Storage pressure and composition"
                    title="Where the bucket pressure is coming from"
                    description="Live R2 usage, CMS accounting, grouped artifact families, and raw prefix evidence without the segment noise."
                />
                <StorageCompositionPanel />
            </section>

            <section id="storage-quality" className="scroll-mt-24 space-y-4">
                <SectionHeading
                    icon={Sliders}
                    eyebrow="Quality strategy"
                    title="Profiles are storage policy"
                    description="Quality profiles now sit inside the same operating model as re-encode, parent cleanup, and playback protection."
                />
                <QualityStrategyPanel onSectionChange={handleSectionChange} />
                <EmbeddedQualityPage />
            </section>

            <section id="storage-delivery" className="scroll-mt-24 space-y-4">
                <SectionHeading icon={Layers3} eyebrow="Audio-first delivery" title="Policies, routes, and repair inventory" description="Active generations are immutable. This surface previews policy and repair candidates through CMS only; it has no direct queue or storage authority." />
                <DeliveryPanel />
            </section>

            <section id="storage-candidates" className="scroll-mt-24 space-y-4">
                <SectionHeading
                    icon={ListChecks}
                    eyebrow="Recommendations and candidates"
                    title="Choose byte-saving work with guardrails visible"
                    description="Manual actions stay bounded: dry-run first, preserve CMS memory, and protect hot feed units."
                />
                <ExecuteActionBar
                    onRunSweep={() => runSweep.mutate()}
                    runSweepPending={runSweep.isPending}
                    lastSweep={sweepRuns.data?.data?.[0]}
                />
                <PreviewBanner />
                <CandidatesTable />
            </section>

            <section id="storage-ledger" className="scroll-mt-24 space-y-4">
                <SectionHeading
                    icon={Workflow}
                    eyebrow="Recovery trail"
                    title="Artifact ledger and restoration"
                    description="Every storage action should leave enough record to understand what changed and attempt best-effort recovery."
                />
                <ArtifactLedgerPanel />
                <ActivityLog />
            </section>

            <section id="storage-policy" className="scroll-mt-24 space-y-4">
                <SectionHeading
                    icon={ShieldCheck}
                    eyebrow="Policy"
                    title="Bounded automation, no feed decisions"
                    description="Set cost and artifact lifecycle policy. Visibility, ranking, source approval, and editorial decisions stay out of this system."
                />
                <PolicyCard />
                <OverridesTable />
            </section>

            <section id="storage-operations" className="scroll-mt-24 space-y-4">
                <SectionHeading
                    icon={Activity}
                    eyebrow="Operations"
                    title="Object-store budgets and maintenance"
                    description="Track R2 operation caps, recent sweeps, and reconciliation without leaving the cockpit."
                />
                <OperationsPanel />
                <RecentSweepsPreview />
                <ToolsCard
                    onReconcile={() => reconcile.mutate()}
                    reconciling={reconcile.isPending}
                    reconcileResult={reconcile.data}
                />
            </section>
        </div>
    );
}

function normalizeSection(section: string | null, legacyTab: string | null): StorageSection {
    if (section && SECTION_IDS.includes(section as StorageSection)) {
        return section as StorageSection;
    }
    if (legacyTab === 'policy') return 'policy';
    if (legacyTab === 'execute' || legacyTab === 'candidates') return 'candidates';
    return 'cockpit';
}

function SectionNav({
    active,
    onChange,
}: {
    active: StorageSection;
    onChange: (section: StorageSection) => void;
}) {
    const items: { id: StorageSection; label: string; icon: ElementType }[] = [
        { id: 'cockpit', label: 'Cockpit', icon: Gauge },
        { id: 'quality', label: 'Quality', icon: Sliders },
        { id: 'delivery', label: 'Delivery', icon: Layers3 },
        { id: 'candidates', label: 'Candidates', icon: ListChecks },
        { id: 'ledger', label: 'Ledger', icon: Workflow },
        { id: 'policy', label: 'Policy', icon: ShieldCheck },
        { id: 'operations', label: 'Operations', icon: Activity },
    ];

    return (
        <div className="sticky top-0 z-20 -mx-4 border-y border-border bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex gap-2 overflow-x-auto">
                {items.map((item) => {
                    const Icon = item.icon;
                    const selected = item.id === active;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onChange(item.id)}
                            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                                selected
                                    ? 'border-gold/60 bg-gold/10 text-foreground'
                                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DeliveryPanel() {
    const policies = useDeliveryPolicies();
    const inventory = useDeliveryInventory();
    const activate = useSetDeliveryPolicyActive();
    const update = useUpdateDeliveryPolicy();
    const requestRepair = useRequestDeliveryRepair();
    const rollback = useRollbackDeliveryGeneration();
    const [contentId, setContentId] = useState('');
    const [repairId, setRepairId] = useState('');
    const [rollbackGenerationId, setRollbackGenerationId] = useState('');
    const preview = useDeliveryRoutePreview(contentId.trim());
    const repair = useDeliveryRepairStatus(repairId);
    const flagged = (inventory.data?.items ?? []).filter((item) => item.classification !== 'healthy');

    return (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
                <CardHeader>
                    <CardTitle>Delivery policies</CardTitle>
                    <CardDescription>Policy changes affect only future rendition generations. Active generations retain their immutable snapshot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(policies.data?.data ?? []).map((policy) => (
                        <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                            <div>
                                <p className="font-medium">{policy.name}</p>
                                <p className="text-xs text-muted-foreground">{policy.media_kind} · {policy.primary_mode} · {policy.rollout_state} · CMAF / {policy.hls_min_variants} minimum variants</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={policy.active ? 'success' : 'secondary'}>{policy.active ? 'active' : 'inactive'}</Badge>
                                <Button size="sm" variant="outline" disabled={activate.isPending} onClick={() => activate.mutate({ id: policy.id, active: !policy.active })}>{policy.active ? 'Deactivate' : 'Activate'}</Button>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
                                <label className="flex items-center gap-2"><Checkbox checked={policy.allow_hls} onCheckedChange={(checked) => update.mutate({ id: policy.id, input: { allow_hls: checked === true } })} /> Adaptive HLS</label>
                                <label className="flex items-center gap-2"><Checkbox checked={policy.generate_audio_alternate !== false} onCheckedChange={(checked) => update.mutate({ id: policy.id, input: { generate_audio_alternate: checked === true } })} /> Native audio alternate</label>
                                <label className="flex items-center gap-2"><Checkbox checked={policy.generate_progressive_fallback} onCheckedChange={(checked) => update.mutate({ id: policy.id, input: { generate_progressive_fallback: checked === true } })} /> Progressive fallback</label>
                                <span>Variants: {(policy.variants ?? []).slice().sort((a, b) => a.priority - b.priority).map((variant) => `${variant.rendition_type}/${variant.quality_tier}${variant.required ? '' : ' optional'}`).join(' · ') || 'none'}</span>
                            </div>
                        </div>
                    ))}
                    {policies.isLoading && <Skeleton className="h-20 w-full" />}
                    {!policies.isLoading && (policies.data?.data.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No CMS policy rows yet. The migration seeds the default audio-first CMAF policy.</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Route preview</CardTitle><CardDescription>Read-only CMS calculation. A repair must be previewed before it can be requested.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                    <Input value={contentId} onChange={(event) => setContentId(event.target.value)} placeholder="Content UUID" aria-label="Content UUID for delivery route preview" />
                    {preview.isFetching && <Skeleton className="h-16 w-full" />}
                    {preview.data && <div className="rounded border bg-muted/20 p-3 text-sm"><p><span className="text-muted-foreground">Route:</span> <strong>{preview.data.route}</strong></p><p className="mt-1 text-muted-foreground">{preview.data.requires_new_generation ? 'A new immutable generation is required.' : 'No generation change required.'}</p>{preview.data.repair_preview ? <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="secondary">Proven source · {formatBytes(preview.data.repair_preview.source_bytes)}</Badge><Button size="sm" disabled={requestRepair.isPending} onClick={() => requestRepair.mutate({ contentItemId: contentId.trim(), previewDigest: preview.data!.repair_preview!.preview_digest }, { onSuccess: (result) => setRepairId(result.repair.id) })}>Request generation-safe repair</Button></div> : <p className="mt-2 text-xs text-amber-600">{preview.data.repair_unavailable_reason ?? 'Repair is unavailable until CMS can prove a source manifest.'}</p>}</div>}
                    {repairId && <div className="rounded border p-3 text-xs"><p className="font-medium">Repair {repair.data?.repair.state ?? 'loading'} · <span className="font-mono">{repairId}</span></p>{repair.data?.attempts[0] && <p className="mt-1 text-muted-foreground">Attempt {repair.data.attempts[0].attempt_number}: {repair.data.attempts[0].state}</p>}</div>}
                    <div className="flex gap-2 border-t pt-3"><Input value={rollbackGenerationId} onChange={(event) => setRollbackGenerationId(event.target.value)} placeholder="Superseded generation UUID" aria-label="Superseded generation UUID to roll back" /><Button size="sm" variant="outline" disabled={!rollbackGenerationId.trim() || rollback.isPending} onClick={() => rollback.mutate(rollbackGenerationId.trim())}>Rollback verified generation</Button></div>
                    <p className="text-xs text-muted-foreground">This console cannot run queues, probe storage, or delete legacy objects.</p>
                </CardContent>
            </Card>
            <Card className="xl:col-span-2">
                <CardHeader><CardTitle>Legacy inventory and repair candidates</CardTitle><CardDescription>Read-only classifications from proven CMS records. Unmatched historical objects stay inventory-only.</CardDescription></CardHeader>
                <CardContent>
                    <div className="mb-3 flex items-center gap-2 text-sm"><Badge variant={flagged.length ? 'secondary' : 'success'}>{flagged.length} flagged</Badge><span className="text-muted-foreground">No cleanup is performed from this view.</span></div>
                    <div className="max-h-64 overflow-auto rounded border"><Table><TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Classification</TableHead><TableHead>Playback</TableHead></TableRow></TableHeader><TableBody>{flagged.slice(0, 100).map((item) => <TableRow key={item.content_item_id}><TableCell className="font-mono text-xs">{item.content_item_id}</TableCell><TableCell><Badge variant="secondary">{item.classification}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{item.playback_type ?? '—'}</TableCell></TableRow>)}{!inventory.isLoading && flagged.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No proven delivery problems in the sampled inventory.</TableCell></TableRow>}</TableBody></Table></div>
                </CardContent>
            </Card>
        </div>
    );
}

function SectionHeading({
    icon: Icon,
    eyebrow,
    title,
    description,
}: {
    icon: ElementType;
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col gap-2 border-b border-border pb-3 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10">
                    <Icon className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                    <p className="brand-overline text-gold">{eyebrow}</p>
                    <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict-led cockpit
// ─────────────────────────────────────────────────────────────────────────────

function StorageCockpit({
    onSectionChange,
}: {
    onSectionChange: (value: StorageSection) => void;
}) {
    const router = useRouter();
    const health = useStorageHealth();
    const recommendations = useStorageRecommendations();
    const ledger = useStorageArtifactEvents(8);

    if (health.isLoading || !health.data) {
        return (
            <Card>
                <CardContent className="p-6">
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        );
    }

    const data = health.data;
    const recs = data.recommendations.length > 0 ? data.recommendations : recommendations.data?.data ?? [];
    const verdictVariant =
        data.state === 'critical' ? 'destructive'
        : data.state === 'pressure' || data.state === 'degraded_no_cold' ? 'secondary'
        : data.state === 'degraded' ? 'secondary'
        : 'success';
    const proof = data.proof;
    const untrackedGapBytes = Math.max(0, proof.used_bytes - proof.db_tracked_bytes);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <Badge variant={verdictVariant}>{data.state.replaceAll('_', ' ')}</Badge>
                            <span className="text-xs text-muted-foreground">score {data.score}/100</span>
                        </div>
                        <CardTitle>Storage + Quality cockpit</CardTitle>
                        <CardDescription>{data.summary}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => onSectionChange('policy')}>
                            <Sliders className="mr-2 h-4 w-4" />
                            Policy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onSectionChange('quality')}>
                            <Zap className="mr-2 h-4 w-4" />
                            Quality
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => router.push('/platform/media/atomization')}>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Atomization
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <ProofMetric label="Used" value={formatBytes(proof.used_bytes)} detail={`${proof.utilization_pct.toFixed(1)}%`} />
                    <ProofMetric label="CMS gap" value={formatBytes(untrackedGapBytes)} detail="live minus tracked" />
                    <ProofMetric label="Protected" value={formatBytes(proof.protected_bytes)} detail={`${proof.protected_count} items`} />
                    <ProofMetric label="Candidates" value={formatBytes(proof.candidate_bytes)} detail={`${proof.candidate_count} items`} />
                    <ProofMetric label="Parent sources" value={formatBytes(proof.parent_source_bytes)} detail={`${proof.parent_source_count} atomized`} />
                    <ProofMetric
                        label="Recovery"
                        value={proof.cold_enabled ? 'Cold ready' : 'No cold tier'}
                        detail={`${proof.recoverable_deleted_count} recoverable deleted`}
                    />
                </div>

                <LifecycleRail proof={proof} />

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="rounded border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">Recommendations</h3>
                            <Button variant="ghost" size="sm" onClick={() => onSectionChange('candidates')}>
                                Open candidates
                            </Button>
                        </div>
                        {recs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No storage action recommended right now.</p>
                        ) : (
                            <div className="space-y-3">
                                {recs.slice(0, 4).map((rec) => (
                                    <div key={rec.key} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <p className="text-sm font-medium">{rec.label}</p>
                                            <p className="text-xs text-muted-foreground">{rec.detail}</p>
                                        </div>
                                        <Badge variant={rec.severity === 'critical' ? 'destructive' : rec.severity === 'warning' ? 'secondary' : 'outline'}>
                                            {rec.action.replaceAll('_', ' ')}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">Artifact ledger</h3>
                            <Button variant="ghost" size="sm" onClick={() => onSectionChange('ledger')}>
                                {ledger.data?.total ?? 0} events
                            </Button>
                        </div>
                        {ledger.isLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : (ledger.data?.data ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No storage artifact events yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {(ledger.data?.data ?? []).slice(0, 5).map((event) => (
                                    <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{event.event_type.replaceAll('_', ' ')}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {event.reason || event.source || 'storage action'} · {new Date(event.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <Badge variant={event.status === 'error' ? 'destructive' : event.status === 'skipped' ? 'secondary' : 'success'}>
                                            {event.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {!proof.cold_enabled && (
                    <div className="flex items-start gap-3 rounded border border-orange-500/35 bg-orange-500/10 p-3 text-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        <div>
                            <p className="font-medium text-orange-400">Degraded mode: no cold tier configured</p>
                            <p className="text-muted-foreground">
                                Storage relief is limited to re-encode, duplicate/orphan cleanup, and
                                policy-allowed recoverable deletion. Broad deletion remains guarded by
                                CMS recovery metadata and manual controls.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function LifecycleRail({ proof }: { proof: StorageProofMetrics }) {
    const byteMax = Math.max(
        proof.used_bytes,
        proof.protected_bytes,
        proof.candidate_bytes,
        proof.parent_source_bytes,
        1
    );
    const lanes = [
        {
            label: 'Hot bytes',
            value: proof.used_bytes,
            detail: `${proof.utilization_pct.toFixed(1)}% of quota`,
            color: 'bg-amber-400',
        },
        {
            label: 'Protected feed units',
            value: proof.protected_bytes,
            detail: `${proof.protected_count} hot or guarded items`,
            color: 'bg-emerald-400',
        },
        {
            label: 'Re-encode candidates',
            value: proof.candidate_bytes,
            detail: `${proof.candidate_count} bounded actions`,
            color: 'bg-cyan-400',
        },
        {
            label: 'Parent source liability',
            value: proof.parent_source_bytes,
            detail: `${proof.parent_source_count} atomized parents`,
            color: 'bg-violet-400',
        },
    ];

    return (
        <div className="rounded-lg border border-border bg-slate-950 p-4 text-slate-100">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-cyan-300">Artifact lifecycle rail</p>
                    <h3 className="text-base font-semibold">Hot → re-encoded → cold → recoverable delete → recovery</h3>
                </div>
                <Badge variant={proof.cold_enabled ? 'success' : 'secondary'}>
                    {proof.cold_enabled ? 'cold tier ready' : 'degraded no cold'}
                </Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
                {lanes.map((lane, index) => (
                    <div key={lane.label} className="relative rounded-md border border-white/10 bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{lane.label}</span>
                            {index < lanes.length - 1 && <ArrowRight className="hidden h-4 w-4 text-slate-500 lg:block" />}
                        </div>
                        <p className="mt-2 text-xl font-semibold">{formatBytes(lane.value)}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                className={`h-full ${lane.color}`}
                                style={{ width: `${Math.max(5, Math.min(100, (lane.value / byteMax) * 100))}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{lane.detail}</p>
                    </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
                Recoverable deletion keeps CMS memory and attempts re-ingestion when needed; it is not
                an exact-file restore promise.
            </p>
        </div>
    );
}

function ProofMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="rounded border border-border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}

function QualityStrategyPanel({
    onSectionChange,
}: {
    onSectionChange: (value: StorageSection) => void;
}) {
    const profiles = useQualityProfiles();
    const policy = useStoragePolicy('global');
    const profileList = profiles.data?.data ?? [];
    const activeProfiles = profileList.filter((profile) => profile.is_active);
    const targetProfile = activeProfiles.find((profile) => profile.id === policy.data?.re_encode_target_profile_id);

    const findPreset = (key: string) => activeProfiles.find((profile) => profile.preset_key === key);
    const mobile = findPreset('mobile-feed');
    const saver = findPreset('storage-saver');
    const podcast = findPreset('podcast');
    const dataSaver = findPreset('data-saver');

    const lanes = [
        {
            role: 'Hot feed unit',
            profile: mobile?.name ?? podcast?.name ?? 'Mobile / podcast profile',
            action: 'Verify playback, protect from aggressive re-encode/delete',
            guardrail: 'Strong chapters protect themselves independently',
            accent: 'border-emerald-500/35 bg-emerald-500/10',
        },
        {
            role: 'Normal feed unit',
            profile: mobile?.name ?? 'Balanced audio-first profile',
            action: 'Use feed-safe encode and monitor playback health',
            guardrail: 'Experience first, audio clarity as floor',
            accent: 'border-cyan-500/35 bg-cyan-500/10',
        },
        {
            role: 'Dormant feed unit',
            profile: targetProfile?.name ?? saver?.name ?? 'Storage saver profile',
            action: 'Bounded re-encode before colder or destructive action',
            guardrail: 'Performance changes protection only, not visibility',
            accent: 'border-blue-500/35 bg-blue-500/10',
        },
        {
            role: 'Atomized parent source',
            profile: saver?.name ?? dataSaver?.name ?? 'Aggressive retention profile',
            action: 'Cold-move when available; recoverable delete when policy allows',
            guardrail: 'Parent is accounting/provenance, children remain product units',
            accent: 'border-violet-500/35 bg-violet-500/10',
        },
        {
            role: 'Unsuitable/media liability',
            profile: dataSaver?.name ?? saver?.name ?? 'Minimal retention profile',
            action: 'Shrink, move, or flag as storage liability',
            guardrail: 'No valid-content feed suppression from Storage + Quality',
            accent: 'border-orange-500/35 bg-orange-500/10',
        },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <CardTitle>Role protection matrix</CardTitle>
                    <CardDescription>
                        Feed units are optimized for experience. Parent source artifacts are optimized for recoverability and cost.
                    </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{activeProfiles.length} active profiles</Badge>
                    <Badge variant={policy.data?.archive_action === 're_encode' ? 'success' : 'secondary'}>
                        {policy.data?.archive_action?.replaceAll('_', ' ') ?? 'policy loading'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 xl:grid-cols-5">
                    {lanes.map((lane) => (
                        <div key={lane.role} className={`rounded-md border p-3 ${lane.accent}`}>
                            <p className="text-sm font-semibold">{lane.role}</p>
                            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Profile lane</p>
                            <p className="mt-1 min-h-10 text-sm">{lane.profile}</p>
                            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Allowed work</p>
                            <p className="mt-1 text-sm">{lane.action}</p>
                            <p className="mt-3 text-xs text-muted-foreground">{lane.guardrail}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded border border-border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-cyan-400" />
                            <p className="text-sm font-medium">Preset coverage</p>
                        </div>
                        {profiles.isLoading ? (
                            <Skeleton className="h-16 w-full" />
                        ) : activeProfiles.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No active quality profiles. Create a global profile before enabling re-encode policy.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {activeProfiles.slice(0, 8).map((profile) => {
                                    const preset = getPreset(profile.preset_key);
                                    return (
                                        <Badge key={profile.id} variant="outline">
                                            {preset ? `${preset.displayName}: ` : ''}{profile.name}
                                        </Badge>
                                    );
                                })}
                                {activeProfiles.length > 8 && (
                                    <Badge variant="secondary">+{activeProfiles.length - 8} more</Badge>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded border border-border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-400" />
                            <p className="text-sm font-medium">Boundary reminder</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This system can shrink bytes, move bytes, delete recoverable artifacts, preserve recovery metadata,
                            and verify playback. It cannot rank, hide, approve sources, or suppress valid chapters.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => onSectionChange('policy')}>
                        Tune storage policy
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ArtifactLedgerPanel() {
    const ledger = useStorageArtifactEvents(50);
    const events = ledger.data?.data ?? [];

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <CardTitle>Artifact ledger</CardTitle>
                    <CardDescription>
                        Re-encode, cold move, recoverable delete, restore, skip, and failure events.
                    </CardDescription>
                </div>
                <Badge variant="outline">{ledger.data?.total ?? 0} total events</Badge>
            </CardHeader>
            <CardContent>
                {ledger.isLoading ? (
                    <Skeleton className="h-40 w-full" />
                ) : events.length === 0 ? (
                    <div className="flex items-start gap-3 rounded border border-border bg-muted/30 p-4 text-sm">
                        <Workflow className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="font-medium">No artifact events yet</p>
                            <p className="text-muted-foreground">
                                Once sweeps, re-encodes, cold moves, or recoverable deletes run, this ledger becomes the recovery trail.
                            </p>
                        </div>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Content</TableHead>
                                <TableHead>Bytes</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>When</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event) => (
                                <TableRow key={event.id}>
                                    <TableCell>
                                        <div className="font-medium">{event.event_type.replaceAll('_', ' ')}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {event.storage_tier || event.source || 'storage worker'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={event.status === 'error' ? 'destructive' : event.status === 'skipped' ? 'secondary' : 'success'}>
                                            {event.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[180px] truncate text-xs" title={event.content_item_id}>
                                        {event.content_item_id}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {event.freed_bytes || event.deleted_bytes
                                            ? formatBytes(event.freed_bytes ?? event.deleted_bytes ?? 0)
                                            : event.old_size_bytes && event.new_size_bytes
                                                ? `${formatBytes(event.old_size_bytes)} → ${formatBytes(event.new_size_bytes)}`
                                                : '—'}
                                    </TableCell>
                                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground" title={event.error || event.reason || undefined}>
                                        {event.error || event.reason || event.trigger || '—'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(event.created_at).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview helpers — compact previews of data shown fully on Execute
// ─────────────────────────────────────────────────────────────────────────────

function RecentSweepsPreview() {
    const { data, isLoading } = useSweepRuns();
    if (isLoading) return <Skeleton className="h-24 w-full" />;
    const runs = (data?.data ?? []).slice(0, 5);
    if (runs.length === 0) return null;
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Recent sweep activity</CardTitle>
                <span className="text-xs text-muted-foreground">
                    Last {runs.length} of {data?.total ?? 0}
                </span>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Started</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead className="text-right">Deleted</TableHead>
                            <TableHead className="text-right">Freed</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {runs.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Badge variant={r.trigger === 'manual' ? 'default' : 'secondary'}>
                                        {r.trigger}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">{r.deleted_count}</TableCell>
                                <TableCell className="text-right">{formatBytes(r.freed_bytes)}</TableCell>
                                <TableCell>
                                    {r.error
                                        ? <Badge variant="destructive" title={r.error}>error</Badge>
                                        : <Badge variant="success">ok</Badge>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <p className="mt-2 text-right text-xs text-muted-foreground">
                    Full history in the <strong>Ledger</strong> section.
                </p>
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute action bar — manual triggers + last-run summary
// ─────────────────────────────────────────────────────────────────────────────

function ExecuteActionBar({
    onRunSweep,
    runSweepPending,
    lastSweep,
}: {
    onRunSweep: () => void;
    runSweepPending: boolean;
    lastSweep?: { started_at: string; deleted_count: number; freed_bytes: number; error?: string };
}) {
    return (
        <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium">Manual sweep</p>
                    {lastSweep ? (
                        <p className="text-xs text-muted-foreground">
                            Last run {new Date(lastSweep.started_at).toLocaleString()} —{' '}
                            {lastSweep.error
                                ? <span className="text-red-400">error</span>
                                : <>deleted <strong>{lastSweep.deleted_count}</strong>, freed <strong>{formatBytes(lastSweep.freed_bytes)}</strong></>}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">No sweeps yet.</p>
                    )}
                </div>
                <Button onClick={onRunSweep} disabled={runSweepPending}>
                    {runSweepPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <PlayCircle className="mr-2 h-4 w-4" />}
                    Run sweep now
                </Button>
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-purge preview banner
// ─────────────────────────────────────────────────────────────────────────────

function PreviewBanner() {
    const { data, isLoading } = useStoragePreview();
    if (isLoading || !data) return null;
    if (!data.enabled) {
        return (
            <div className="flex items-center gap-2 rounded border border-border bg-muted/40 p-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                    Auto-circulation is <strong>off</strong>. Enable it in the policy card below or use
                    the &ldquo;Run sweep now&rdquo; button for a one-shot pass.
                </span>
            </div>
        );
    }

    const nextRun = data.next_run_at ? new Date(data.next_run_at) : null;
    const minutesUntil = nextRun ? Math.max(0, Math.round((nextRun.getTime() - Date.now()) / 60_000)) : null;
    const willPurge = data.candidates_count > 0;
    const action =
        data.archive_action === 'move_to_cold' ? 'move to cold tier'
        : data.archive_action === 're_encode' ? 're-encode (shrink in place)'
        : 'delete from primary';

    return (
        <div
            className={`flex items-start gap-3 rounded border p-3 text-sm ${willPurge ? 'border-blue-500/40 bg-blue-500/10' : 'border-border bg-muted/40'
                }`}
        >
            <Clock className={`mt-0.5 h-4 w-4 ${willPurge ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <div className="flex-1">
                <p className="font-medium">
                    {willPurge ? (
                        <>
                            Next sweep will {action} <strong>{data.candidates_count}</strong> items
                            (~<strong>{formatBytes(data.bytes_to_free)}</strong>)
                        </>
                    ) : (
                        <>Next sweep will purge nothing — quota is comfortable.</>
                    )}
                </p>
                <p className="text-xs text-muted-foreground">
                    {nextRun && (
                        <>Scheduled for {nextRun.toLocaleString()} ({minutesUntil}m from now). </>
                    )}
                    {data.protected_count > 0 && (
                        <>
                            <Shield className="mr-1 inline h-3 w-3" />
                            {data.protected_count} hot items ({formatBytes(data.protected_bytes)}) are
                            protected from purge.
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage pressure + composition
// ─────────────────────────────────────────────────────────────────────────────

function StorageCompositionPanel() {
    const { data, isLoading, isError, error } = useStorageStats();

    if (isLoading || !data) {
        return (
            <Card className={isError ? 'border-red-500/30' : undefined}>
                <CardHeader>
                    <CardTitle>{isError ? 'Storage composition unavailable' : 'Loading storage composition'}</CardTitle>
                    <CardDescription>
                        {isError
                            ? 'CMS or Aggregation could not return live storage statistics for this cockpit section.'
                            : 'Reading live bucket totals, CMS-tracked bytes, artifact groups, and content-type accounting.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isError ? (
                        <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                            <div>
                                <p className="text-sm font-medium text-red-200">Stats request failed</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {error instanceof Error ? error.message : 'Check CMS storage stats and Aggregation storage connectivity.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                                <Skeleton className="h-48 w-full" />
                                <Skeleton className="h-48 w-full" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Live object-store reads can take several seconds when the bucket has many prefixes.
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }

    const artifactGroups = buildArtifactGroups(data.by_artifact_type, data.used_bytes);
    const contentRows = buildContentTypeRows(data.by_content_type, data.db_tracked_bytes);
    const rawPrefixes = Object.entries(data.by_artifact_type)
        .map(([key, bytes]) => ({ key, bytes }))
        .sort((a, b) => b.bytes - a.bytes);
    const hasArtifacts = artifactGroups.length > 0;
    const hasContent = contentRows.length > 0;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <StoragePressurePanel data={data} />
                <Card>
                    <CardHeader>
                        <CardTitle>Artifact group leaderboard</CardTitle>
                        <CardDescription>
                            Raw prefixes are grouped into storage families so segments do not dominate the read.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!hasArtifacts ? (
                            <EmptyStorageMessage title="No artifact groups yet" detail="Live bucket prefixes will appear here after media artifacts are uploaded." />
                        ) : (
                            <div className="space-y-3">
                                {artifactGroups.map((group) => (
                                    <ArtifactGroupRow key={group.id} group={group} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Content type accounting</CardTitle>
                        <CardDescription>
                            CMS-tracked sizes by content kind, excluding archived rows.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <LiveCmsGap data={data} />
                        {!hasContent ? (
                            <EmptyStorageMessage title="No CMS size accounting yet" detail="Content types will appear after CMS rows have tracked file sizes." />
                        ) : (
                            <div className="space-y-3">
                                {contentRows.map((row) => (
                                    <ContentTypeAccountingRow key={row.name} row={row} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <RawPrefixDrawer rawPrefixes={rawPrefixes} totalBytes={data.used_bytes} />
            </div>
        </div>
    );
}

function StoragePressurePanel({ data }: { data: StorageStats }) {
    const delta = formatStorageDelta(data.used_bytes, data.quota_bytes);
    const usedPct = data.quota_bytes > 0 ? (data.used_bytes / data.quota_bytes) * 100 : 0;
    const dbGap = Math.max(0, data.used_bytes - data.db_tracked_bytes);
    const gapPct = data.used_bytes > 0 ? (dbGap / data.used_bytes) * 100 : 0;
    const rulerMax = Math.max(data.used_bytes, data.quota_bytes, 1);
    const quotaMarkerPct = data.quota_bytes > 0 ? (data.quota_bytes / rulerMax) * 100 : 100;
    const usedWidthPct = data.used_bytes > 0 ? (data.used_bytes / rulerMax) * 100 : 0;
    const safeUsedWidth = Math.max(data.used_bytes > 0 ? 2 : 0, Math.min(100, usedWidthPct));
    const withinQuotaWidth = data.used_bytes > 0 && data.quota_bytes > 0
        ? Math.min(safeUsedWidth, quotaMarkerPct)
        : safeUsedWidth;
    const overQuotaWidth = delta.state === 'over'
        ? Math.max(2, safeUsedWidth - quotaMarkerPct)
        : 0;

    return (
        <Card className={delta.state === 'over' ? 'border-red-500/35' : undefined}>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>Storage pressure</CardTitle>
                        <CardDescription>
                            Live bucket usage compared with the configured policy quota.
                        </CardDescription>
                    </div>
                    <Badge variant={delta.state === 'over' ? 'destructive' : data.utilization_pct >= 80 ? 'secondary' : 'success'}>
                        {delta.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className={`rounded-md border p-4 ${delta.state === 'over' ? 'border-red-500/35 bg-red-500/10' : 'border-border bg-muted/20'}`}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {delta.state === 'over' ? 'Over quota' : 'Remaining capacity'}
                    </p>
                    <p className={`mt-1 text-3xl font-semibold ${delta.state === 'over' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {delta.deltaLabel}
                    </p>
                    <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatBytes(data.used_bytes)} used</span>
                            <span>{formatBytes(data.quota_bytes)} quota</span>
                        </div>
                        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-l-full ${usedPct >= 80 && delta.state !== 'over' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${withinQuotaWidth}%` }}
                            />
                            {delta.state === 'over' && (
                                <div
                                    className="absolute top-0 h-full rounded-r-full bg-red-500"
                                    style={{
                                        left: `${quotaMarkerPct}%`,
                                        width: `${overQuotaWidth}%`,
                                    }}
                                />
                            )}
                            <div
                                className="absolute top-0 h-full w-0.5 bg-gold shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                                style={{ left: `calc(${Math.min(100, quotaMarkerPct)}% - 1px)` }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{data.utilization_pct.toFixed(1)}% utilization</span>
                            <span className="flex items-center gap-1">
                                <span className="h-2.5 w-0.5 bg-gold" />
                                Quota marker
                            </span>
                            {delta.state === 'over' && (
                                <span className="text-red-300">Red span is over-quota storage.</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StorageMetric label="Used" value={formatBytes(data.used_bytes)} />
                    <StorageMetric label="Objects" value={data.object_count.toLocaleString()} />
                    <StorageMetric label="DB-tracked" value={formatBytes(data.db_tracked_bytes)} />
                    <StorageMetric label="Untracked gap" value={formatBytes(dbGap)} detail={`${gapPct.toFixed(1)}% of live`} />
                    <StorageMetric label="Quota" value={formatBytes(data.quota_bytes)} />
                    <StorageMetric label="Updated" value={new Date(data.live_stats_at).toLocaleTimeString()} />
                    <StorageMetric label="Cold tier" value={coldTierLabel(data)} detail={coldTierDetail(data)} />
                    <StorageMetric label="Live source" value={data.aggregation_error ? 'Fallback' : 'R2 live'} detail={data.aggregation_error ? 'DB totals shown' : 'Aggregation stats'} />
                </div>

                {data.cold_enabled && data.cold && (
                    <div className="flex items-center gap-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
                        <Snowflake className="h-5 w-5 text-cyan-400" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Cold tier ready</p>
                            <p className="text-xs text-muted-foreground">
                                {formatBytes(data.cold.used_bytes)} across {data.cold.object_count.toLocaleString()} objects in the secondary bucket.
                            </p>
                        </div>
                    </div>
                )}
                {data.cold_enabled && !data.cold && (
                    <div className="flex items-center gap-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                        <Snowflake className="h-4 w-4 text-yellow-400" />
                        <div className="flex-1">
                            <p className="font-medium text-yellow-300">Cold tier query failed</p>
                            <p className="text-muted-foreground">
                                Cold tier is enabled, but Aggregation could not return cold stats.
                            </p>
                        </div>
                    </div>
                )}
                {!data.cold_enabled && (
                    <div className="flex items-center gap-3 rounded border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
                        <Snowflake className="h-4 w-4 text-orange-400" />
                        <span className="text-muted-foreground">Cold tier is unavailable; pressure relief depends on re-encode and recoverable-delete guardrails.</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StorageMetric({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div className="rounded border border-border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-base font-semibold">{value}</p>
            {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
    );
}

function ArtifactGroupRow({ group }: { group: ArtifactGroup }) {
    const toneClass = artifactToneClass(group.tone);
    return (
        <div className="rounded border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
                        <p className="font-medium">{group.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{group.actionHint}</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold">{formatBytes(group.bytes)}</p>
                    <p className="text-xs text-muted-foreground">
                        {group.percent.toFixed(1)}% · {group.prefixCount} prefix{group.prefixCount === 1 ? '' : 'es'}
                    </p>
                </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className={`h-full rounded-full ${toneClass.bar}`}
                    style={{ width: `${Math.max(2, Math.min(100, group.percent))}%` }}
                />
            </div>
            {group.details.length > 1 && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                        Show {group.details.length} grouped prefixes
                    </summary>
                    <div className="mt-2 space-y-1">
                        {group.details.slice(0, 8).map((detail) => (
                            <div key={detail.key} className="flex items-center justify-between gap-3 rounded bg-background/60 px-2 py-1 text-xs">
                                <span className="truncate font-mono" title={detail.key}>{detail.label}</span>
                                <span className="shrink-0 text-muted-foreground">{formatBytes(detail.bytes)}</span>
                            </div>
                        ))}
                        {group.details.length > 8 && (
                            <p className="text-xs text-muted-foreground">+{group.details.length - 8} more in raw prefixes.</p>
                        )}
                    </div>
                </details>
            )}
        </div>
    );
}

function ContentTypeAccountingRow({ row }: { row: ContentTypeRow }) {
    return (
        <div className="rounded border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {row.count.toLocaleString()} item{row.count === 1 ? '' : 's'} · avg {formatBytes(row.averageBytes)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-semibold">{formatBytes(row.bytes)}</p>
                    <p className="text-xs text-muted-foreground">{row.percent.toFixed(1)}% of CMS-tracked</p>
                </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${Math.max(2, Math.min(100, row.percent))}%` }}
                />
            </div>
        </div>
    );
}

function LiveCmsGap({ data }: { data: StorageStats }) {
    const gap = Math.max(0, data.used_bytes - data.db_tracked_bytes);
    const gapPct = data.used_bytes > 0 ? (gap / data.used_bytes) * 100 : 0;
    const isLargeGap = gapPct >= 20;

    return (
        <div className={`rounded border p-3 text-sm ${isLargeGap ? 'border-amber-500/35 bg-amber-500/10' : 'border-border bg-muted/20'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Live vs CMS gap</p>
                <Badge variant={isLargeGap ? 'secondary' : 'outline'}>{formatBytes(gap)} untracked</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                Live R2 shows {formatBytes(data.used_bytes)}. CMS rows account for {formatBytes(data.db_tracked_bytes)}.
                {isLargeGap ? ' This gap is large enough to investigate orphan objects, old renditions, or missing file_size_bytes.' : ' The gap is within a normal inspection range.'}
            </p>
        </div>
    );
}

function RawPrefixDrawer({
    rawPrefixes,
    totalBytes,
}: {
    rawPrefixes: Array<{ key: string; bytes: number }>;
    totalBytes: number;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Raw key prefixes</CardTitle>
                <CardDescription>
                    Exact live prefixes remain available for investigation, sorted by bytes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {rawPrefixes.length === 0 ? (
                    <EmptyStorageMessage title="No raw prefixes yet" detail="Aggregation has not returned live artifact prefix data." />
                ) : (
                    <details>
                        <summary className="cursor-pointer rounded border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                            Show top {Math.min(40, rawPrefixes.length)} of {rawPrefixes.length} raw prefixes
                        </summary>
                        <div className="mt-3 overflow-x-auto">
                            <Table className="min-w-[420px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Prefix</TableHead>
                                        <TableHead className="text-right">Bytes</TableHead>
                                        <TableHead className="text-right">Share</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rawPrefixes.slice(0, 40).map((prefix) => (
                                        <TableRow key={prefix.key}>
                                            <TableCell className="max-w-[260px] truncate font-mono text-xs" title={prefix.key}>
                                                {prefix.key}
                                            </TableCell>
                                            <TableCell className="text-right">{formatBytes(prefix.bytes)}</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {totalBytes > 0 ? `${((prefix.bytes / totalBytes) * 100).toFixed(1)}%` : '0.0%'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </details>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyStorageMessage({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="rounded border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-muted-foreground">{detail}</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Operations panel — Class A / Class B free-tier tracking
// ─────────────────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (!n || n <= 0) return '0';
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 2)}M`;
    return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function statusColor(status: OpClassStatus): string {
    switch (status) {
        case 'cap':  return 'bg-red-500';
        case 'warn': return 'bg-yellow-500';
        default:     return 'bg-emerald-500';
    }
}

function statusLabel(status: OpClassStatus): string {
    switch (status) {
        case 'cap':  return 'CAPPED';
        case 'warn': return 'WARN';
        default:     return 'OK';
    }
}

function OperationsPanel() {
    const { data, isLoading } = useStorageOperations(30);

    if (isLoading || !data) {
        return (
            <Card>
                <CardContent className="p-6">
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        );
    }

    const worstStatus: OpClassStatus =
        data.class_a.status === 'cap' || data.class_b.status === 'cap' ? 'cap'
        : data.class_a.status === 'warn' || data.class_b.status === 'warn' ? 'warn'
        : 'ok';

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-cyan-400" />
                        <div>
                            <CardTitle>S3 operations — {data.month}</CardTitle>
                            <CardDescription>
                                Cloudflare R2 free-tier tracking. Auto-sweeps pause when a class hits its cap.
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={worstStatus === 'cap' ? 'destructive' : worstStatus === 'warn' ? 'secondary' : 'success'}>
                        {statusLabel(worstStatus)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {worstStatus === 'cap' && (
                    <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                        <div>
                            <p className="font-medium text-red-300">Free-tier cap reached</p>
                            <p className="text-muted-foreground">
                                Auto-sweeps and rule-driven re-encodes are paused until next month. Manual
                                actions (Run sweep now, Re-encode) still work but consume the same budget.
                            </p>
                        </div>
                    </div>
                )}

                {/* Two-up budget bars */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <BudgetBar title="Class A (writes, lists)" summary={data.class_a} />
                    <BudgetBar title="Class B (reads, heads)" summary={data.class_b} />
                </div>

                {/* Daily trend chart */}
                {data.daily.length > 0 && (
                    <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            Daily operations — last {data.daily.length} day(s)
                        </p>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={data.daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => formatCount(Number(v))} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    formatter={(v) => formatCount(Number(v))}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="class_a" stackId="1" stroke="#f59e0b" fill="#f59e0b80" name="Class A" />
                                <Area type="monotone" dataKey="class_b" stackId="1" stroke="#0ea5e9" fill="#0ea5e980" name="Class B" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Per-op-type table + per-source chips — collapsed by default to
                    keep the dashboard scannable. Power users expand for detail. */}
                <details className="rounded border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                        Show op-type breakdown &amp; source contribution
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            By operation type (this month)
                        </p>
                        {data.by_op_type.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No operations recorded yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Op type</TableHead>
                                        <TableHead>Class</TableHead>
                                        <TableHead className="text-right">Count</TableHead>
                                        <TableHead className="text-right">% of class</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.by_op_type.slice(0, 10).map((r) => (
                                        <TableRow key={`${r.op_class}-${r.op_type}`}>
                                            <TableCell className="font-mono text-xs">{r.op_type}</TableCell>
                                            <TableCell>
                                                <Badge variant={r.op_class === 'A' ? 'destructive' : 'secondary'}>
                                                    {r.op_class === 'F' ? 'Free' : r.op_class === 'U' ? 'Unknown' : r.op_class}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{formatCount(r.count)}</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {r.pct_of_class.toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            Source breakdown
                        </p>
                        <div className="space-y-2">
                            {data.by_source.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No sources yet.</p>
                            ) : (
                                data.by_source.map((s) => (
                                    <div
                                        key={s.source}
                                        className="flex items-center justify-between rounded border border-border bg-muted/30 px-3 py-2"
                                    >
                                        <span className="text-sm capitalize">
                                            {s.source === 'cloudflare' ? (
                                                <span className="flex items-center gap-1">
                                                    <Zap className="h-3 w-3 text-orange-400" /> Cloudflare
                                                </span>
                                            ) : s.source === 'cloudflare_legacy' ? 'Legacy Cloudflare (unqualified)' : 'Internal SDK'}
                                        </span>
                                        <span className="font-mono text-sm">{formatCount(s.count)}</span>
                                    </div>
                                ))
                            )}
                            <p className="text-xs text-muted-foreground">
                                <strong>Internal</strong> = ops we made via our S3 SDK.{' '}
                                <strong>Cloudflare</strong> = R2 Analytics, including public CDN reads. Sources overlap and must not be added. Totals use the highest observed daily source per tier/class; gaps and legacy counts remain unqualified. These are usage observations, not an invoice.
                            </p>
                        </div>
                    </div>
                    </div>
                </details>
            </CardContent>
        </Card>
    );
}

function BudgetBar({ title, summary }: { title: string; summary: StorageOperationsResponse['class_a'] }) {
    const isCapped = summary.status === 'cap';
    const noCap = summary.budget <= 0;
    return (
        <div className="rounded border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{title}</span>
                <Badge variant={isCapped ? 'destructive' : summary.status === 'warn' ? 'secondary' : 'success'}>
                    {statusLabel(summary.status)}
                </Badge>
            </div>
            <p className="text-2xl font-semibold">
                {formatCount(summary.used)}
                {!noCap && (
                    <span className="text-base font-normal text-muted-foreground">
                        {' '}/ {formatCount(summary.budget)} ({summary.pct.toFixed(1)}%)
                    </span>
                )}
            </p>
            {!noCap && (
                <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
                    <div
                        className={`h-full ${statusColor(summary.status)}`}
                        style={{ width: `${Math.min(100, summary.pct)}%` }}
                    />
                </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
                {noCap
                    ? 'No budget cap configured (cost projection only).'
                    : (
                        <>
                            {formatCount(summary.remaining)} remaining this month.
                            {summary.projected_to_exceed_at && summary.pct < 100 && (
                                <>
                                    {' '}At current burn rate, projected to exceed budget on{' '}
                                    <strong>{summary.projected_to_exceed_at}</strong>.
                                </>
                            )}
                        </>
                    )}
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy card (Global default)
// ─────────────────────────────────────────────────────────────────────────────

function PolicyCard() {
    const { data, isLoading } = useStoragePolicy('global');
    const { data: stats } = useStorageStats({ paused: true });
    const update = useUpdateStoragePolicy();

    if (isLoading || !data) {
        return (
            <Card>
                <CardContent className="p-6">
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <PolicyForm
            policy={data}
            scope="global"
            coldEnabled={stats?.cold_enabled ?? false}
            onSave={(req) => update.mutate(req)}
            saving={update.isPending}
        />
    );
}

interface PolicyFormProps {
    policy: StoragePolicy;
    scope: 'global' | 'tenant';
    tenantId?: string;
    coldEnabled?: boolean;
    onSave: (req: UpdatePolicyRequest) => void;
    saving: boolean;
}

function PolicyForm({ policy, scope, tenantId, coldEnabled = false, onSave, saving }: PolicyFormProps) {
    const [enabled, setEnabled] = useState(policy.enabled);
    const [preset, setPreset] = useState(policy.preset || 'balanced');
    const [maxGB, setMaxGB] = useState((policy.max_storage_bytes / (1024 * 1024 * 1024)).toFixed(2));
    const [target, setTarget] = useState(String(policy.target_utilization_pct));
    const [minAge, setMinAge] = useState(String(policy.min_age_days));
    const [minViews, setMinViews] = useState(String(policy.min_view_count_for_keep));
    const [interval, setInterval] = useState(String(policy.sweep_interval_minutes));
    const [deleteFailed, setDeleteFailed] = useState(policy.delete_failed_immediately);
    const [preserveThumbs, setPreserveThumbs] = useState(policy.preserve_thumbnails);
    const [protectN, setProtectN] = useState(String(policy.protect_top_n_by_views ?? 50));
    const [protectWindow, setProtectWindow] = useState(String(policy.protect_top_n_window_days ?? 30));
    const [archiveAction, setArchiveAction] = useState<'delete' | 'move_to_cold' | 're_encode'>(
        policy.archive_action ?? 're_encode'
    );
    // re_encode target — null = "auto" (resolved per item by source_type).
    const [reEncodeTarget, setReEncodeTarget] = useState<string>(
        policy.re_encode_target_profile_id ? String(policy.re_encode_target_profile_id) : ''
    );
    // Pull profiles so the re-encode action can offer a target picker.
    const qualityProfiles = useQualityProfiles();
    // Operation budgets (Cloudflare R2 free-tier defaults).
    const [classABudget, setClassABudget] = useState(String(policy.class_a_free_budget ?? 1_000_000));
    const [classBBudget, setClassBBudget] = useState(String(policy.class_b_free_budget ?? 10_000_000));
    const [classAWarn, setClassAWarn] = useState(String(policy.class_a_warn_pct ?? 80));
    const [classACap, setClassACap] = useState(String(policy.class_a_cap_pct ?? 95));
    const [classBWarn, setClassBWarn] = useState(String(policy.class_b_warn_pct ?? 80));
    const [classBCap, setClassBCap] = useState(String(policy.class_b_cap_pct ?? 95));

    function resetBudgetsToR2Defaults() {
        setClassABudget('1000000');
        setClassBBudget('10000000');
        setClassAWarn('80');
        setClassACap('95');
        setClassBWarn('80');
        setClassBCap('95');
    }

    function handleSave() {
        const payload: UpdatePolicyRequest = {
            scope,
            preset,
            enabled,
            max_storage_bytes: Math.round(parseFloat(maxGB) * 1024 * 1024 * 1024),
            target_utilization_pct: parseInt(target, 10),
            min_age_days: parseInt(minAge, 10),
            min_view_count_for_keep: parseInt(minViews, 10),
            sweep_interval_minutes: parseInt(interval, 10),
            delete_failed_immediately: deleteFailed,
            preserve_thumbnails: preserveThumbs,
            protect_top_n_by_views: parseInt(protectN, 10),
            protect_top_n_window_days: parseInt(protectWindow, 10),
            archive_action: archiveAction,
            re_encode_target_profile_id: archiveAction === 're_encode'
                ? (reEncodeTarget ? parseInt(reEncodeTarget, 10) : 0)
                : undefined,
            class_a_free_budget: parseInt(classABudget, 10) || 0,
            class_b_free_budget: parseInt(classBBudget, 10) || 0,
            class_a_warn_pct: parseInt(classAWarn, 10),
            class_a_cap_pct: parseInt(classACap, 10),
            class_b_warn_pct: parseInt(classBWarn, 10),
            class_b_cap_pct: parseInt(classBCap, 10),
        };
        if (scope === 'tenant' && tenantId) {
            payload.tenant_id = tenantId;
        }
        onSave(payload);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Auto-circulation {scope === 'global' ? '(Global default)' : `(Tenant: ${tenantId})`}
                </CardTitle>
                <CardDescription>
                    When enabled, the storage worker periodically re-encodes, cold-moves,
                    or recoverable-deletes eligible artifacts while keeping CMS recovery memory.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded border border-border p-3">
                    <Checkbox
                        id={`enabled-${scope}-${tenantId ?? 'global'}`}
                        checked={enabled}
                        onCheckedChange={(v) => setEnabled(v === true)}
                    />
                    <Label htmlFor={`enabled-${scope}-${tenantId ?? 'global'}`}>
                        Enable auto-circulation
                    </Label>
                </div>

                <Field label="Preset" hint="Bounded v1 modes; advanced formulas come later through Autopilot">
                    <select
                        className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                        value={preset}
                        onChange={(e) => setPreset(e.target.value)}
                    >
                        <option value="conservative">Conservative — re-encode first, delete rarely</option>
                        <option value="balanced">Balanced — default cost relief with recovery guardrails</option>
                        <option value="storage_saver">Storage saver — shorter retention, stronger compression</option>
                        <option value="critical_pressure">Critical pressure — approval-gated emergency cleanup</option>
                    </select>
                </Field>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Max storage (GB)" hint="Hard cap before sweeping kicks in">
                        <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={maxGB}
                            onChange={(e) => setMaxGB(e.target.value)}
                        />
                    </Field>
                    <Field label="Target utilization %" hint="Sweep until usage <= this %">
                        <Input
                            type="number"
                            min="10"
                            max="100"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                        />
                    </Field>
                    <Field label="Sweep interval (minutes)" hint="How often the worker tick runs">
                        <Input
                            type="number"
                            min="1"
                            max="1440"
                            value={interval}
                            onChange={(e) => setInterval(e.target.value)}
                        />
                    </Field>
                    <Field label="Min age (days)" hint="Never purge content younger than this">
                        <Input
                            type="number"
                            min="0"
                            value={minAge}
                            onChange={(e) => setMinAge(e.target.value)}
                        />
                    </Field>
                    <Field label="Max view count" hint="Items at or below this count are eligible">
                        <Input
                            type="number"
                            min="0"
                            value={minViews}
                            onChange={(e) => setMinViews(e.target.value)}
                        />
                    </Field>
                    <div className="space-y-3 self-end">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`failed-${scope}-${tenantId ?? 'global'}`}
                                checked={deleteFailed}
                                onCheckedChange={(v) => setDeleteFailed(v === true)}
                            />
                            <Label htmlFor={`failed-${scope}-${tenantId ?? 'global'}`}>
                                Purge FAILED items immediately
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`thumbs-${scope}-${tenantId ?? 'global'}`}
                                checked={preserveThumbs}
                                onCheckedChange={(v) => setPreserveThumbs(v === true)}
                            />
                            <Label htmlFor={`thumbs-${scope}-${tenantId ?? 'global'}`}>
                                Keep thumbnails on archive
                            </Label>
                        </div>
                    </div>
                </div>

                <details className="rounded border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                        <Shield className="mr-2 inline h-4 w-4 text-emerald-500" />
                        Hot-content protection
                    </summary>
                    <div className="mt-3 space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Top-viewed items in the recent window are exempt from purge regardless of
                            the age/view rules above. Set top-N to 0 to disable.
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Field label="Protect top-N by views" hint="Most-viewed items kept regardless of age">
                                <Input
                                    type="number"
                                    min="0"
                                    max="10000"
                                    value={protectN}
                                    onChange={(e) => setProtectN(e.target.value)}
                                />
                            </Field>
                            <Field label="Window (days)" hint="Look-back range for the top-N ranking">
                                <Input
                                    type="number"
                                    min="0"
                                    max="365"
                                    value={protectWindow}
                                    onChange={(e) => setProtectWindow(e.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                </details>

                <div className="rounded border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Snowflake className="h-4 w-4 text-cyan-400" />
                        Archive action
                    </div>
                    <p className="text-xs text-muted-foreground">
                        What to do with eligible items. <strong>Move to cold</strong> requires the
                        secondary bucket to be configured (COLD_STORAGE_* env vars on Aggregation).
                    </p>
                    <div className="flex gap-3">
                        <label className="flex flex-1 cursor-pointer items-start gap-2 rounded border border-border p-2 hover:bg-muted/30">
                            <input
                                type="radio"
                                name={`action-${scope}-${tenantId ?? 'global'}`}
                                value="delete"
                                checked={archiveAction === 'delete'}
                                onChange={() => setArchiveAction('delete')}
                                className="mt-1"
                            />
                            <div>
                                <p className="text-sm font-medium">Delete from primary</p>
                                <p className="text-xs text-muted-foreground">
                                    Mark storage as recoverable-deleted, drop the bytes. Restore re-fetches.
                                </p>
                            </div>
                        </label>
                        <label
                            className={`flex flex-1 cursor-pointer items-start gap-2 rounded border p-2 hover:bg-muted/30 ${
                                archiveAction === 'move_to_cold' && !coldEnabled
                                    ? 'border-orange-500/60'
                                    : 'border-border'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`action-${scope}-${tenantId ?? 'global'}`}
                                value="move_to_cold"
                                checked={archiveAction === 'move_to_cold'}
                                onChange={() => setArchiveAction('move_to_cold')}
                                className="mt-1"
                            />
                            <div>
                                <p className="text-sm font-medium">Move to cold tier</p>
                                <p className="text-xs text-muted-foreground">
                                    Copy to secondary bucket, drop from primary. Item stays
                                    playable from cold URL.
                                </p>
                            </div>
                        </label>
                        <label className="flex flex-1 cursor-pointer items-start gap-2 rounded border border-border p-2 hover:bg-muted/30">
                            <input
                                type="radio"
                                name={`action-${scope}-${tenantId ?? 'global'}`}
                                value="re_encode"
                                checked={archiveAction === 're_encode'}
                                onChange={() => setArchiveAction('re_encode')}
                                className="mt-1"
                            />
                            <div>
                                <p className="text-sm font-medium">Re-encode (shrink)</p>
                                <p className="text-xs text-muted-foreground">
                                    Encode eligible items to a smaller ingest profile. Item stays
                                    playable. Slower than delete/move; produces real byte savings.
                                </p>
                            </div>
                        </label>
                    </div>

                    {archiveAction === 're_encode' && (
                        <div className="space-y-2 rounded border border-cyan-500/40 bg-cyan-500/5 p-3">
                            <Label className="text-sm">Target profile</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={reEncodeTarget}
                                onChange={(e) => setReEncodeTarget(e.target.value)}
                            >
                                <option value="">
                                    Auto — use each item&apos;s resolved ingest profile by source type
                                </option>
                                {(qualityProfiles.data?.data ?? []).map((p) => {
                                    const preset = getPreset(p.preset_key);
                                    // Prefix the preset display name when known so operators can
                                    // identify "this is our Mobile Feed profile" at a glance.
                                    const presetPrefix = preset ? `[${preset.displayName}] ` : '';
                                    return (
                                        <option key={p.id} value={String(p.id)}>
                                            {presetPrefix}{p.name}
                                            {p.tenant_id ? ' · tenant' : ' · global'}
                                            {p.source_type ? ` · ${p.source_type}` : ''}
                                            {' · '}
                                            {p.max_height > 0 ? `${p.max_height}p` : 'no cap'}
                                            {' · '}
                                            {p.target_bitrate_kbps > 0 ? `${p.target_bitrate_kbps}kbps` : `CRF ${p.crf}`}
                                        </option>
                                    );
                                })}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                <strong>Auto</strong> uses the most-specific ingest profile for each
                                item (typically the global default). Pick an explicit profile to force
                                all eligible items down to e.g. <code>archival-480p</code>. Manage
                                profiles in <a className="text-cyan-400 underline" href="/platform/storage?section=quality">Quality profiles</a>.
                                Re-encodes happen async on the quality queue; sweep activity reports
                                the count enqueued (byte savings emerge as each item completes).
                            </p>
                            {(qualityProfiles.data?.data?.length ?? 0) === 0 && (
                                <div className="flex items-start gap-2 rounded border border-orange-500/40 bg-orange-500/10 p-2 text-xs">
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                                    <span>
                                        No ingest profiles exist yet. Re-encode needs at least one
                                        global profile to fall back on — create one in{' '}
                                        <a className="underline" href="/platform/storage?section=quality">Quality profiles</a>.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {archiveAction === 'move_to_cold' && !coldEnabled && (
                        <div className="flex items-start gap-2 rounded border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                            <div>
                                <p className="font-medium text-orange-400">Cold storage is not configured</p>
                                <p className="mt-0.5 text-muted-foreground">
                                    Without <code className="rounded bg-muted px-1 py-0.5 text-xs">COLD_STORAGE_*</code> environment
                                    variables set on Aggregation, automatic sweeps enter degraded
                                    behaviour and fall back to re-encode guardrails instead of moving
                                    files cold. Broad deletion should stay approval-gated.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <details className="rounded border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                        <Activity className="mr-2 inline h-4 w-4 text-cyan-400" />
                        Operation budgets — Cloudflare R2 free-tier defaults
                    </summary>
                    <div className="mt-3 space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Set the per-month free-tier cap for each operation class. When monthly usage
                            (internal SDK + Cloudflare Analytics) exceeds the warn % the Operations panel
                            shows a warning; at the cap %, auto-sweepers refuse to enqueue work. Manual
                            triggers always run. Set a budget to <strong>0</strong> to disable the cap (e.g.
                            paid AWS S3 plans).
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Field label="Class A budget / month" hint="Writes, lists, deletes — R2 free: 1M">
                                <Input type="number" min="0" value={classABudget}
                                    onChange={(e) => setClassABudget(e.target.value)} />
                            </Field>
                            <Field label="Class A warn %" hint="Yellow status above this">
                                <Input type="number" min="0" max="100" value={classAWarn}
                                    onChange={(e) => setClassAWarn(e.target.value)} />
                            </Field>
                            <Field label="Class A cap %" hint="Auto-sweeps refused above this">
                                <Input type="number" min="0" max="100" value={classACap}
                                    onChange={(e) => setClassACap(e.target.value)} />
                            </Field>
                            <Field label="Class B budget / month" hint="Reads, heads — R2 free: 10M">
                                <Input type="number" min="0" value={classBBudget}
                                    onChange={(e) => setClassBBudget(e.target.value)} />
                            </Field>
                            <Field label="Class B warn %" hint="Yellow status above this">
                                <Input type="number" min="0" max="100" value={classBWarn}
                                    onChange={(e) => setClassBWarn(e.target.value)} />
                            </Field>
                            <Field label="Class B cap %" hint="Auto-sweeps refused above this">
                                <Input type="number" min="0" max="100" value={classBCap}
                                    onChange={(e) => setClassBCap(e.target.value)} />
                            </Field>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={resetBudgetsToR2Defaults}>
                            Reset to R2 free-tier defaults
                        </Button>
                    </div>
                </details>

                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        Last swept:{' '}
                        {policy.last_sweep_at
                            ? new Date(policy.last_sweep_at).toLocaleString()
                            : 'never'}
                    </p>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save policy
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label className="text-sm">{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage composition helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeArtifactKey(key: string): NormalizedArtifact {
    const normalized = key.trim().toLowerCase();
    if (/^segment[_-]?\d+$/.test(normalized)) {
        return {
            groupId: 'media_segments',
            groupLabel: 'Media segments',
            detailLabel: key,
            actionHint: 'Usually chapter/HLS segment bytes; investigate when segments dominate hot storage.',
            tone: 'cyan',
        };
    }
    if (normalized === 'processed' || normalized.startsWith('processed.')) {
        return {
            groupId: 'processed_renditions',
            groupLabel: 'Processed renditions',
            detailLabel: key === 'processed' ? 'processed current' : key.replace('processed.', 'processed '),
            actionHint: 'Primary playback renditions; re-encode and duplicate-version cleanup affect this group.',
            tone: 'emerald',
        };
    }
    if (normalized.includes('thumbnail') || normalized.includes('thumb') || normalized.includes('poster')) {
        return {
            groupId: 'thumbnails',
            groupLabel: 'Thumbnails',
            detailLabel: key,
            actionHint: 'Small visual assets; usually preserve because they are cheap and keep placeholders useful.',
            tone: 'amber',
        };
    }
    if (normalized.includes('index') || normalized.includes('manifest') || normalized === 'm3u8') {
        return {
            groupId: 'indexes_manifests',
            groupLabel: 'Indexes and manifests',
            detailLabel: key,
            actionHint: 'Playback routing files; tiny but important for health checks and recovery.',
            tone: 'violet',
        };
    }
    return {
        groupId: 'other_artifacts',
        groupLabel: 'Other artifacts',
        detailLabel: key,
        actionHint: 'Mixed or unknown prefixes; inspect raw rows before attaching policy.',
        tone: 'slate',
    };
}

function buildArtifactGroups(
    byArtifactType: Record<string, number>,
    totalBytes: number
): ArtifactGroup[] {
    const groups = new Map<string, ArtifactGroup>();
    Object.entries(byArtifactType).forEach(([key, bytes]) => {
        const artifact = normalizeArtifactKey(key);
        const existing = groups.get(artifact.groupId);
        const detail = {
            key,
            label: artifact.detailLabel,
            bytes,
            percent: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
        };

        if (!existing) {
            groups.set(artifact.groupId, {
                id: artifact.groupId,
                label: artifact.groupLabel,
                bytes,
                prefixCount: 1,
                percent: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
                actionHint: artifact.actionHint,
                tone: artifact.tone,
                details: [detail],
            });
            return;
        }

        existing.bytes += bytes;
        existing.prefixCount += 1;
        existing.percent = totalBytes > 0 ? (existing.bytes / totalBytes) * 100 : 0;
        existing.details.push(detail);
    });

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            details: group.details.sort((a, b) => b.bytes - a.bytes),
        }))
        .sort((a, b) => b.bytes - a.bytes);
}

function buildContentTypeRows(
    byContentType: StorageStats['by_content_type'],
    totalTrackedBytes: number
): ContentTypeRow[] {
    return Object.entries(byContentType)
        .map(([name, value]) => ({
            name,
            bytes: value.bytes,
            count: value.count,
            averageBytes: value.count > 0 ? value.bytes / value.count : 0,
            percent: totalTrackedBytes > 0 ? (value.bytes / totalTrackedBytes) * 100 : 0,
        }))
        .sort((a, b) => b.bytes - a.bytes);
}

function formatStorageDelta(usedBytes: number, quotaBytes: number) {
    if (quotaBytes <= 0) {
        return {
            state: 'unknown' as const,
            label: 'No quota',
            deltaLabel: 'No quota set',
        };
    }
    const delta = quotaBytes - usedBytes;
    if (delta < 0) {
        return {
            state: 'over' as const,
            label: 'Over quota',
            deltaLabel: `${formatBytes(Math.abs(delta))} over`,
        };
    }
    return {
        state: 'under' as const,
        label: 'Within quota',
        deltaLabel: `${formatBytes(delta)} left`,
    };
}

function coldTierLabel(data: StorageStats): string {
    if (!data.cold_enabled) return 'Unavailable';
    return data.cold ? 'Ready' : 'Query failed';
}

function coldTierDetail(data: StorageStats): string {
    if (!data.cold_enabled) return 'Degraded mode';
    if (!data.cold) return 'Check Aggregation';
    return `${formatBytes(data.cold.used_bytes)} cold`;
}

function artifactToneClass(tone: ArtifactTone) {
    switch (tone) {
        case 'emerald':
            return { dot: 'bg-emerald-400', bar: 'bg-emerald-400' };
        case 'amber':
            return { dot: 'bg-amber-400', bar: 'bg-amber-400' };
        case 'violet':
            return { dot: 'bg-violet-400', bar: 'bg-violet-400' };
        case 'slate':
            return { dot: 'bg-slate-400', bar: 'bg-slate-400' };
        default:
            return { dot: 'bg-cyan-400', bar: 'bg-cyan-400' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidates tab
// ─────────────────────────────────────────────────────────────────────────────

function CandidatesTable() {
    const [params, setParams] = useState({
        min_age_days: undefined as number | undefined,
        max_view_count: undefined as number | undefined,
        status: '',
        limit: 100,
    });
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [preserveThumbs, setPreserveThumbs] = useState(true);

    const candidates = useStorageCandidates({
        min_age_days: params.min_age_days,
        max_view_count: params.max_view_count,
        status: params.status || undefined,
        limit: params.limit,
    });
    const purge = usePurgeStorage();

    const items = useMemo(() => candidates.data?.data ?? [], [candidates.data]);
    const allSelected = items.length > 0 && selected.size === items.length;

    function toggleAll() {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(items.map((i) => i.id)));
    }

    function toggleOne(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const selectedBytes = useMemo(
        () => items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.file_size_bytes, 0),
        [items, selected]
    );

    function handleDryRun() {
        purge.mutate({
            ids: Array.from(selected),
            dry_run: true,
            preserve_thumbnails: preserveThumbs,
        });
    }

    function handlePurge() {
        purge.mutate(
            {
                ids: Array.from(selected),
                dry_run: false,
                preserve_thumbnails: preserveThumbs,
            },
            {
                onSuccess: () => {
                    setSelected(new Set());
                    setConfirmOpen(false);
                    candidates.refetch();
                },
            }
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Purge candidates</CardTitle>
                    <CardDescription>
                        Items eligible for storage purge, sorted worst-first.
                        {candidates.data && (
                            <> Total candidates: <strong>{candidates.data.total}</strong>, freeable:{' '}
                                <strong>{formatBytes(candidates.data.total_bytes)}</strong></>
                        )}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDryRun}
                        disabled={selected.size === 0 || purge.isPending}
                    >
                        Dry run ({selected.size})
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => setConfirmOpen(true)}
                        disabled={selected.size === 0 || purge.isPending}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Purge selected ({formatBytes(selectedBytes)})
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
                    <div>
                        <Label>Min age (days)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={params.min_age_days ?? ''}
                            onChange={(e) =>
                                setParams((p) => ({ ...p, min_age_days: e.target.value ? parseInt(e.target.value, 10) : undefined }))
                            }
                        />
                    </div>
                    <div>
                        <Label>Max view count</Label>
                        <Input
                            type="number"
                            min="0"
                            value={params.max_view_count ?? ''}
                            onChange={(e) =>
                                setParams((p) => ({ ...p, max_view_count: e.target.value ? parseInt(e.target.value, 10) : undefined }))
                            }
                        />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Input
                            placeholder="e.g. FAILED"
                            value={params.status}
                            onChange={(e) => setParams((p) => ({ ...p, status: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button variant="outline" className="w-full" onClick={() => candidates.refetch()}>
                            Apply filters
                        </Button>
                    </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                    <Checkbox
                        id="preserve-thumbs-purge"
                        checked={preserveThumbs}
                        onCheckedChange={(v) => setPreserveThumbs(v === true)}
                    />
                    <Label htmlFor="preserve-thumbs-purge" className="text-sm">
                        Keep thumbnails (recommended — they are tiny and let the placeholder render)
                    </Label>
                </div>

                {candidates.isLoading ? (
                    <Skeleton className="h-48 w-full" />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8">
                                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                                </TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Fit</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead className="text-right">Size</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                                        No candidates match the current filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selected.has(c.id)}
                                                onCheckedChange={() => toggleOne(c.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{c.title || c.id}</TableCell>
                                        <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                                        <TableCell>
                                            <Badge variant="outline" title={c.protection_reason}>
                                                {(c.content_role || 'candidate').replaceAll('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={c.media_suitability === 'unsuitable' || c.media_suitability === 'visual_dependent' ? 'secondary' : 'outline'}>
                                                {(c.media_suitability || 'unknown').replaceAll('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={c.status === 'FAILED' ? 'destructive' : 'secondary'}>
                                                {c.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{c.view_count}</TableCell>
                                        <TableCell className="text-right">{formatBytes(c.file_size_bytes)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm purge</DialogTitle>
                        <DialogDescription>
                            About to recoverable-delete S3 objects for {selected.size} items, freeing approximately{' '}
                            <strong>{formatBytes(selectedBytes)}</strong>. The DB rows stay, with status set to
                            storage-recoverable. Restore is possible via the Activity tab.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handlePurge} disabled={purge.isPending}>
                            {purge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Purge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant overrides tab
// ─────────────────────────────────────────────────────────────────────────────

function OverridesTable() {
    const { data, isLoading } = usePolicyOverrides();
    const { data: stats } = useStorageStats({ paused: true });
    const update = useUpdateStoragePolicy();
    const remove = useDeletePolicyOverride();
    const [newTenant, setNewTenant] = useState('');
    const [editing, setEditing] = useState<string | null>(null);

    if (isLoading || !data) {
        return <Skeleton className="h-32 w-full" />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Per-tenant overrides</CardTitle>
                <CardDescription>
                    Overrides fully replace the global policy for the named tenant.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Label>Add override for tenant</Label>
                        <Input
                            placeholder="tenant_id"
                            value={newTenant}
                            onChange={(e) => setNewTenant(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            if (!newTenant.trim()) return;
                            update.mutate(
                                { scope: 'tenant', tenant_id: newTenant.trim(), enabled: false },
                                { onSuccess: () => setNewTenant('') }
                            );
                        }}
                        disabled={!newTenant.trim() || update.isPending}
                    >
                        Create
                    </Button>
                </div>

                {data.overrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No tenant overrides yet — global default applies to all tenants.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tenant</TableHead>
                                <TableHead>Enabled</TableHead>
                                <TableHead className="text-right">Cap</TableHead>
                                <TableHead className="text-right">Target %</TableHead>
                                <TableHead className="text-right">Min age</TableHead>
                                <TableHead className="text-right">Interval</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.overrides.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.tenant_id}</TableCell>
                                    <TableCell>
                                        <Badge variant={p.enabled ? 'success' : 'secondary'}>
                                            {p.enabled ? 'on' : 'off'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{formatBytes(p.max_storage_bytes)}</TableCell>
                                    <TableCell className="text-right">{p.target_utilization_pct}%</TableCell>
                                    <TableCell className="text-right">{p.min_age_days}d</TableCell>
                                    <TableCell className="text-right">{p.sweep_interval_minutes}m</TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(editing === p.tenant_id ? null : p.tenant_id ?? null)}
                                        >
                                            {editing === p.tenant_id ? 'Close' : 'Edit'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => p.tenant_id && remove.mutate(p.tenant_id)}
                                            disabled={remove.isPending}
                                        >
                                            Remove
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {editing && data.overrides.find((o) => o.tenant_id === editing) && (
                    <PolicyForm
                        scope="tenant"
                        tenantId={editing}
                        policy={data.overrides.find((o) => o.tenant_id === editing)!}
                        coldEnabled={stats?.cold_enabled ?? false}
                        onSave={(req) => update.mutate(req)}
                        saving={update.isPending}
                    />
                )}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity log
// ─────────────────────────────────────────────────────────────────────────────

function ActivityLog() {
    const { data, isLoading } = useSweepRuns();
    const restore = useRestoreStorageItem();
    const [restoreId, setRestoreId] = useState('');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sweep activity</CardTitle>
                <CardDescription>Every circulation tick — auto and manual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-2 rounded border border-border p-3">
                    <div className="flex-1">
                        <Label>Restore by content ID</Label>
                        <Input
                            placeholder="UUID"
                            value={restoreId}
                            onChange={(e) => setRestoreId(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (restoreId.trim()) {
                                restore.mutate(restoreId.trim(), { onSuccess: () => setRestoreId('') });
                            }
                        }}
                        disabled={restore.isPending || !restoreId.trim()}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                    </Button>
                </div>

                {isLoading || !data ? (
                    <Skeleton className="h-32 w-full" />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Started</TableHead>
                                <TableHead>Trigger</TableHead>
                                <TableHead className="text-right">Deleted</TableHead>
                                <TableHead className="text-right">Freed</TableHead>
                                <TableHead>Tenant</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        No sweep runs yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.data.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="text-xs">
                                            {new Date(r.started_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={r.trigger === 'manual' ? 'default' : 'secondary'}>
                                                {r.trigger}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{r.deleted_count}</TableCell>
                                        <TableCell className="text-right">{formatBytes(r.freed_bytes)}</TableCell>
                                        <TableCell>{r.tenant_id}</TableCell>
                                        <TableCell>
                                            {r.error ? (
                                                <Badge variant="destructive" title={r.error}>error</Badge>
                                            ) : (
                                                <Badge variant="success">ok</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────

function ToolsCard({
    onReconcile,
    reconciling,
    reconcileResult,
}: {
    onReconcile: () => void;
    reconciling: boolean;
    reconcileResult?: ReconcileResponse;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tools</CardTitle>
                <CardDescription>One-shot maintenance actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded border border-border p-3">
                    <div>
                        <p className="font-medium">Reconcile S3 ↔ DB</p>
                        <p className="text-xs text-muted-foreground">
                            Lists every object in the bucket and compares against CMS rows. Use this when you suspect drift.
                        </p>
                    </div>
                    <Button onClick={onReconcile} disabled={reconciling}>
                        {reconciling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Run reconcile
                    </Button>
                </div>

                {reconcileResult && (
                    <div className={`rounded border p-3 text-sm ${reconcileResult.partial ? 'border-amber-500/35 bg-amber-500/10' : 'border-border'}`}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">
                                {reconcileResult.partial ? 'Partial reconcile result' : 'Reconcile result'}
                            </p>
                            <Badge variant={reconcileResult.partial ? 'secondary' : 'success'}>
                                {reconcileResult.partial ? 'partial' : 'complete'}
                            </Badge>
                        </div>
                        <p>
                            <strong>{reconcileResult.orphan_count}</strong> orphan keys (in S3, not referenced by DB)
                        </p>
                        <p>
                            <strong>{reconcileResult.missing_count}</strong> missing objects (DB references missing in S3)
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Scanned {reconcileResult.scanned_object_count?.toLocaleString() ?? 'unknown'} objects and{' '}
                            {reconcileResult.scanned_cms_item_count?.toLocaleString() ?? 'unknown'} CMS rows.
                            {reconcileResult.truncated_reason ? ` Limit: ${reconcileResult.truncated_reason}.` : ''}
                        </p>
                        {reconcileResult.orphan_count > 0 && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground">
                                    Show orphan keys
                                </summary>
                                <pre className="mt-1 max-h-48 overflow-auto bg-muted/30 p-2 text-xs">
                                    {reconcileResult.orphan_keys.slice(0, 200).join('\n')}
                                    {reconcileResult.orphan_keys.length > 200 ? '\n…' : ''}
                                </pre>
                            </details>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
