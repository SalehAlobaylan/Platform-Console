'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Ban,
    Bot,
    CheckCircle2,
    Clock3,
    Eye,
    EyeOff,
    FileClock,
    Gauge,
    History,
    Loader2,
    Minus,
    PauseCircle,
    Pin,
    Play,
    Plus,
    Power,
    RefreshCw,
    RotateCcw,
    Save,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    TrendingUp,
    Wand2,
    X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    useApplyCirculationPreset,
    useApplySourceRecommendation,
    useBoostCirculationAutopilot,
    useCirculationAudit,
    useCirculationAutopilotRuns,
    useCirculationAutopilotStatus,
    useCirculationMetrics,
    useCirculationPolicy,
    useCirculationPreview,
    useDeleteStoryOverride,
    useGenerateSourceRecommendations,
    usePauseCirculationAutopilot,
    useRunCirculationAutopilot,
    useSourceRecommendations,
    useStoryOverrides,
    useUpdateCirculationPolicy,
    useUpdateCirculationAutopilotSettings,
    useUpsertStoryOverride,
} from '@/hooks/use-news';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type {
    AuditLogEntry,
    AutopilotState,
    CirculationStorySummary,
    CirculationWindowMetric,
    NewsAutopilotAction,
    NewsAutopilotRun,
    NewsAutopilotStatus,
    NewsCirculationPolicy,
    NewsLifecycle,
    NewsStoryOverride,
    NewsWindow,
    SourceCadenceMode,
    SourceCirculationRecommendation,
} from '@/types/platform/news';

const WINDOWS: Array<{ value: NewsWindow; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
];

const ATTENTION_TONE_LABELS: Record<AttentionItem['tone'], string> = {
    warning: 'Needs review',
    success: 'Healthy',
    secondary: 'Note',
};

const LIFECYCLE_LABELS: Record<NewsLifecycle, string> = {
    breaking: 'Breaking',
    active: 'Active',
    cooling: 'Cooling',
    historical: 'Historical',
};

const AUTOPILOT_STATE_LABELS: Record<AutopilotState, string> = {
    healthy: 'Healthy',
    watching: 'Watching',
    boosting: 'Boosting',
    safety: 'Safety Mode',
    paused: 'Paused',
    degraded: 'Degraded',
};

const FRESHNESS_VERDICT_LABELS: Record<NonNullable<NewsAutopilotStatus['freshness']>['verdict'], string> = {
    fresh: 'Fresh',
    watching: 'Watching',
    thin: 'Thin',
    stale: 'Stale',
    blocked: 'Blocked',
    degraded: 'Degraded',
};

const AUTOPILOT_ACTION_LABELS: Record<string, string> = {
    'health.evaluate': 'Checked freshness',
    'source_recommendations.generate': 'Reviewed source cadence',
    'snapshots.refresh': 'Queued snapshot refresh',
    'circulation.sweep': 'Queued source pulls',
    'discovery.sweep': 'Checked new source evidence',
    'source_graph.build': 'Updated source graph',
    'autopilot.action_limit': 'Stopped at action limit',
};

function autopilotStateClass(state: AutopilotState | undefined): string {
    switch (state) {
        case 'boosting':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'watching':
        case 'healthy':
            return 'border-sky-200 bg-sky-50 text-sky-700';
        case 'safety':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'degraded':
            return 'border-red-200 bg-red-50 text-red-700';
        default:
            return 'border-slate-200 bg-slate-50 text-slate-700';
    }
}

function freshnessVerdictClass(verdict: NewsAutopilotStatus['freshness']['verdict'] | undefined): string {
    switch (verdict) {
        case 'fresh':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'watching':
            return 'border-sky-200 bg-sky-50 text-sky-700';
        case 'thin':
        case 'stale':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'blocked':
        case 'degraded':
            return 'border-red-200 bg-red-50 text-red-700';
        default:
            return 'border-slate-200 bg-slate-50 text-slate-700';
    }
}

type DeskTab = 'overview' | 'policy' | 'sources' | 'exceptions' | 'history';

type PolicyDraft = Pick<NewsCirculationPolicy, 'source_cadence_mode'> & {
    min_today_stories: string;
    carryover_hours: string;
    carryover_min_score: string;
    breaking_max_age_minutes: string;
    breaking_min_members: string;
    recency_weight: string;
    importance_weight: string;
    momentum_weight: string;
    coverage_weight: string;
    source_quality_weight: string;
    diversity_weight: string;
    trending_weight: string;
    source_claim_interval_minutes: string;
    source_claim_batch_size: string;
    source_min_interval_minutes: string;
    source_max_interval_minutes: string;
    source_max_change_percent: string;
    automation_enabled: boolean;
    automation_interval_minutes: string;
    auto_apply_speedups: boolean;
    max_auto_applies_per_run: string;
    min_runs_for_auto: string;
};

type WeightKey =
    | 'recency_weight'
    | 'importance_weight'
    | 'momentum_weight'
    | 'coverage_weight'
    | 'source_quality_weight'
    | 'diversity_weight'
    | 'trending_weight';

type PolicyRecipe = {
    id: string;
    label: string;
    description: string;
    changes: Partial<PolicyDraft>;
};

type AttentionItem = {
    tone: 'warning' | 'success' | 'secondary';
    title: string;
    detail: string;
    tab?: DeskTab;
    action?: string;
};

const emptyDraft: PolicyDraft = {
    min_today_stories: '8',
    carryover_hours: '72',
    carryover_min_score: '0.25',
    breaking_max_age_minutes: '180',
    breaking_min_members: '3',
    recency_weight: '0.55',
    importance_weight: '0.15',
    momentum_weight: '0.10',
    coverage_weight: '0.30',
    source_quality_weight: '0.10',
    diversity_weight: '0.05',
    trending_weight: '0.05',
    source_cadence_mode: 'suggest',
    source_claim_interval_minutes: '15',
    source_claim_batch_size: '20',
    source_min_interval_minutes: '10',
    source_max_interval_minutes: '360',
    source_max_change_percent: '50',
    automation_enabled: false,
    automation_interval_minutes: '60',
    auto_apply_speedups: false,
    max_auto_applies_per_run: '5',
    min_runs_for_auto: '4',
};

const POLICY_RECIPES: PolicyRecipe[] = [
    {
        id: 'freshest',
        label: 'Freshest Today',
        description: 'Tighter Today feed with minimal carryover.',
        changes: {
            min_today_stories: '8',
            carryover_hours: '36',
            carryover_min_score: '0.35',
            recency_weight: '0.65',
            importance_weight: '0.12',
            momentum_weight: '0.10',
            coverage_weight: '0.18',
            diversity_weight: '0.04',
        },
    },
    {
        id: 'major_stories',
        label: 'Major Stories',
        description: 'Keeps big developing stories visible longer.',
        changes: {
            min_today_stories: '10',
            carryover_hours: '72',
            carryover_min_score: '0.20',
            recency_weight: '0.48',
            importance_weight: '0.18',
            momentum_weight: '0.12',
            coverage_weight: '0.38',
            source_quality_weight: '0.12',
        },
    },
    {
        id: 'low_noise',
        label: 'Low Noise',
        description: 'More conservative freshness and source cadence.',
        changes: {
            min_today_stories: '6',
            carryover_min_score: '0.45',
            breaking_min_members: '4',
            recency_weight: '0.52',
            importance_weight: '0.20',
            coverage_weight: '0.32',
            source_cadence_mode: 'suggest',
            source_claim_interval_minutes: '20',
        },
    },
];

const POLICY_FIELD_LABELS: Record<keyof PolicyDraft, string> = {
    min_today_stories: 'Today minimum',
    carryover_hours: 'Carryover span',
    carryover_min_score: 'Carryover score',
    breaking_max_age_minutes: 'Breaking age',
    breaking_min_members: 'Breaking members',
    recency_weight: 'Recency weight',
    importance_weight: 'Importance weight',
    momentum_weight: 'Momentum weight',
    coverage_weight: 'Coverage weight',
    source_quality_weight: 'Source quality weight',
    diversity_weight: 'Diversity weight',
    trending_weight: 'Trending weight',
    source_cadence_mode: 'Source cadence mode',
    source_claim_interval_minutes: 'Claim tick',
    source_claim_batch_size: 'Claim batch size',
    source_min_interval_minutes: 'Minimum source interval',
    source_max_interval_minutes: 'Maximum source interval',
    source_max_change_percent: 'Maximum cadence change',
    automation_enabled: 'Automatic tuning',
    automation_interval_minutes: 'Automation cadence',
    auto_apply_speedups: 'Auto-apply speed-ups',
    max_auto_applies_per_run: 'Max changes per run',
    min_runs_for_auto: 'Min runs before auto',
};

function draftFromPolicy(policy?: NewsCirculationPolicy): PolicyDraft {
    if (!policy) return emptyDraft;
    return {
        min_today_stories: String(policy.min_today_stories),
        carryover_hours: String(policy.carryover_hours),
        carryover_min_score: String(policy.carryover_min_score),
        breaking_max_age_minutes: String(policy.breaking_max_age_minutes),
        breaking_min_members: String(policy.breaking_min_members),
        recency_weight: String(policy.recency_weight),
        importance_weight: String(policy.importance_weight),
        momentum_weight: String(policy.momentum_weight),
        coverage_weight: String(policy.coverage_weight),
        source_quality_weight: String(policy.source_quality_weight),
        diversity_weight: String(policy.diversity_weight),
        trending_weight: String(policy.trending_weight),
        source_cadence_mode: policy.source_cadence_mode,
        source_claim_interval_minutes: String(policy.source_claim_interval_minutes),
        source_claim_batch_size: String(policy.source_claim_batch_size),
        source_min_interval_minutes: String(policy.source_min_interval_minutes),
        source_max_interval_minutes: String(policy.source_max_interval_minutes),
        source_max_change_percent: String(policy.source_max_change_percent),
        automation_enabled: policy.automation_enabled,
        automation_interval_minutes: String(policy.automation_interval_minutes),
        auto_apply_speedups: policy.auto_apply_speedups,
        max_auto_applies_per_run: String(policy.max_auto_applies_per_run),
        min_runs_for_auto: String(policy.min_runs_for_auto),
    };
}

function numberValue(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function storyTitle(story: CirculationStorySummary): string {
    return story.title || story.label || story.excerpt || story.story_id;
}

function lifecycleClass(lifecycle: NewsLifecycle): string {
    switch (lifecycle) {
        case 'breaking':
            return 'border-red-200 bg-red-50 text-red-700';
        case 'active':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'cooling':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        default:
            return 'border-slate-200 bg-slate-50 text-slate-700';
    }
}

function minutesLabel(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function metricPercent(count: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((count / total) * 100)}%`;
}

function valueChanged(draft: PolicyDraft, policy?: NewsCirculationPolicy): boolean {
    if (!policy) return false;
    const baseline = draftFromPolicy(policy);
    return Object.keys(baseline).some((key) => baseline[key as keyof PolicyDraft] !== draft[key as keyof PolicyDraft]);
}

function policyChanges(draft: PolicyDraft, policy?: NewsCirculationPolicy) {
    if (!policy) return [];
    const baseline = draftFromPolicy(policy);
    return (Object.keys(baseline) as Array<keyof PolicyDraft>)
        .filter((key) => baseline[key] !== draft[key])
        .map((key) => ({
            key,
            label: POLICY_FIELD_LABELS[key],
            from: formatDraftValue(baseline[key]),
            to: formatDraftValue(draft[key]),
        }));
}

function formatDraftValue(value: string | boolean): string {
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    return value;
}

function policyFromDraft(policy: NewsCirculationPolicy, draft: PolicyDraft): NewsCirculationPolicy {
    return {
        ...policy,
        min_today_stories: numberValue(draft.min_today_stories, policy.min_today_stories),
        carryover_hours: numberValue(draft.carryover_hours, policy.carryover_hours),
        carryover_min_score: numberValue(draft.carryover_min_score, policy.carryover_min_score),
        breaking_max_age_minutes: numberValue(draft.breaking_max_age_minutes, policy.breaking_max_age_minutes),
        breaking_min_members: numberValue(draft.breaking_min_members, policy.breaking_min_members),
        recency_weight: numberValue(draft.recency_weight, policy.recency_weight),
        importance_weight: numberValue(draft.importance_weight, policy.importance_weight),
        momentum_weight: numberValue(draft.momentum_weight, policy.momentum_weight),
        coverage_weight: numberValue(draft.coverage_weight, policy.coverage_weight),
        source_quality_weight: numberValue(draft.source_quality_weight, policy.source_quality_weight),
        diversity_weight: numberValue(draft.diversity_weight, policy.diversity_weight),
        trending_weight: numberValue(draft.trending_weight, policy.trending_weight),
        source_cadence_mode: draft.source_cadence_mode,
        source_claim_interval_minutes: numberValue(
            draft.source_claim_interval_minutes,
            policy.source_claim_interval_minutes
        ),
        source_claim_batch_size: numberValue(draft.source_claim_batch_size, policy.source_claim_batch_size),
        source_min_interval_minutes: numberValue(
            draft.source_min_interval_minutes,
            policy.source_min_interval_minutes
        ),
        source_max_interval_minutes: numberValue(
            draft.source_max_interval_minutes,
            policy.source_max_interval_minutes
        ),
        source_max_change_percent: numberValue(
            draft.source_max_change_percent,
            policy.source_max_change_percent
        ),
        automation_enabled: draft.automation_enabled,
        automation_interval_minutes: numberValue(draft.automation_interval_minutes, policy.automation_interval_minutes),
        auto_apply_speedups: draft.auto_apply_speedups,
        max_auto_applies_per_run: numberValue(draft.max_auto_applies_per_run, policy.max_auto_applies_per_run),
        min_runs_for_auto: numberValue(draft.min_runs_for_auto, policy.min_runs_for_auto),
    };
}

function metricNumber(metrics: Record<string, unknown> | undefined, key: string): number | undefined {
    const value = metrics?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

// Turns the recommendation's raw telemetry into a few human chips, so an admin
// can see WHY an interval change is proposed instead of an opaque score.
function recommendationEvidence(metrics?: Record<string, unknown>): string[] {
    if (!metrics) return [];
    const chips: string[] = [];
    const runs = metricNumber(metrics, 'runs');
    const yieldValue = metricNumber(metrics, 'yield');
    const failureRate = metricNumber(metrics, 'failure_rate');
    const duplicates = metricNumber(metrics, 'duplicates');
    if (yieldValue !== undefined) chips.push(`${Math.round(yieldValue * 100)}% new`);
    if (failureRate !== undefined && failureRate > 0) chips.push(`${Math.round(failureRate * 100)}% failures`);
    if (duplicates !== undefined && duplicates > 0) chips.push(`${duplicates} duplicates`);
    if (runs !== undefined) chips.push(`${runs} runs / 7d`);
    return chips;
}

function cadenceModeLabel(mode: SourceCadenceMode): string {
    if (mode === 'auto_apply') return 'Auto apply';
    if (mode === 'manual') return 'Manual';
    return 'Suggest';
}

export function NewsCirculationCard() {
    const [window, setWindow] = useState<NewsWindow>('today');
    const [deskTab, setDeskTab] = useState<DeskTab>('overview');
    const [draft, setDraft] = useState<PolicyDraft>(emptyDraft);
    const [manualStoryId, setManualStoryId] = useState('');
    const [manualNote, setManualNote] = useState('');

    const policyQuery = useCirculationPolicy();
    const policy = policyQuery.data;
    const hasPolicyChanges = valueChanged(draft, policy);
    const previewPolicy = useMemo(
        () => (policy && hasPolicyChanges ? policyFromDraft(policy, draft) : undefined),
        [draft, hasPolicyChanges, policy]
    );
    const metricsQuery = useCirculationMetrics();
    const previewQuery = useCirculationPreview(window, previewPolicy);
    const overridesQuery = useStoryOverrides();
    const recommendationsQuery = useSourceRecommendations();
    const auditQuery = useCirculationAudit();
    const autopilotStatusQuery = useCirculationAutopilotStatus();
    const autopilotRunsQuery = useCirculationAutopilotRuns();

    const updatePolicy = useUpdateCirculationPolicy();
    const updateAutopilotSettings = useUpdateCirculationAutopilotSettings();
    const runAutopilot = useRunCirculationAutopilot();
    const boostAutopilot = useBoostCirculationAutopilot();
    const pauseAutopilot = usePauseCirculationAutopilot();
    const applyPreset = useApplyCirculationPreset();
    const upsertOverride = useUpsertStoryOverride();
    const deleteOverride = useDeleteStoryOverride();
    const generateRecommendations = useGenerateSourceRecommendations();
    const applyRecommendation = useApplySourceRecommendation();

    const metrics = metricsQuery.data?.windows ?? [];
    const todayMetric = metrics.find((item) => item.window === 'today');
    const previewStories = previewQuery.data?.slides.map((slide) => slide.featured) ?? [];
    const activeRecommendations = useMemo(
        () => (recommendationsQuery.data?.data ?? []).filter((rec) => !rec.applied),
        [recommendationsQuery.data?.data]
    );
    const activeOverrides = overridesQuery.data?.data ?? [];
    const changedPolicyFields = useMemo(() => policyChanges(draft, policy), [draft, policy]);
    const attentionItems = useMemo<AttentionItem[]>(() => {
        const items: AttentionItem[] = [];
        const minToday = numberValue(draft.min_today_stories, policy?.min_today_stories ?? 8);
        if (!metricsQuery.isLoading && todayMetric && todayMetric.stories < minToday) {
            items.push({
                tone: 'warning',
                title: 'Today is thin',
                detail: `${todayMetric.stories}/${minToday} stories. Carryover will fill the gap.`,
                tab: 'policy',
                action: 'Tune Today',
            });
        }
        if (!metricsQuery.isLoading && todayMetric && todayMetric.stories > 0 && todayMetric.carryover > todayMetric.stories / 2) {
            items.push({
                tone: 'warning',
                title: 'Carryover is dominating',
                detail: `${todayMetric.carryover} carried stories are visible in Today.`,
                tab: 'policy',
                action: 'Adjust carryover',
            });
        }
        if (activeRecommendations.length > 0) {
            items.push({
                tone: 'warning',
                title: 'Source cadence pending',
                detail: `${activeRecommendations.length} source interval recommendation${activeRecommendations.length === 1 ? '' : 's'} waiting.`,
                tab: 'sources',
                action: 'Review sources',
            });
        }
        if (activeOverrides.length > 0) {
            items.push({
                tone: activeOverrides.length > 8 ? 'warning' : 'secondary',
                title: 'Exceptions active',
                detail: `${activeOverrides.length} story override${activeOverrides.length === 1 ? '' : 's'} currently affect circulation.`,
                tab: 'exceptions',
                action: 'Inspect',
            });
        }
        if (policy?.source_cadence_mode === 'auto_apply') {
            items.push({
                tone: 'success',
                title: 'Auto-apply is enabled',
                detail: 'Source cadence recommendations can apply inside guardrails.',
                tab: 'sources',
                action: 'Check guardrails',
            });
        }
        return items;
    }, [
        activeOverrides.length,
        activeRecommendations.length,
        draft.min_today_stories,
        metricsQuery.isLoading,
        policy?.min_today_stories,
        policy?.source_cadence_mode,
        todayMetric,
    ]);

    useEffect(() => {
        setDraft(draftFromPolicy(policy));
    }, [policy]);

    const setDraftValue = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const handleSavePolicy = () => {
        if (!policy) return;
        updatePolicy.mutate(policyFromDraft(policy, draft));
    };

    const resetDraft = () => setDraft(draftFromPolicy(policy));
    const applyRecipe = (recipe: PolicyRecipe) => {
        setDraft((current) => ({ ...current, ...recipe.changes }));
        setDeskTab('policy');
    };

    const quickOverride = (
        storyId: string,
        data: { pin_to_top?: boolean; suppress?: boolean; exclude_from_feed?: boolean; importance_boost?: number },
        note: string
    ) => {
        upsertOverride.mutate({
            storyId,
            data: {
                ...data,
                notes: note,
            },
        });
    };

    const prepareException = (story: CirculationStorySummary) => {
        setManualStoryId(story.story_id);
        setManualNote(storyTitle(story));
        setDeskTab('exceptions');
    };

    const submitManualOverride = (kind: 'pin' | 'suppress' | 'exclude') => {
        const storyId = manualStoryId.trim();
        if (!storyId) return;
        const data =
            kind === 'pin'
                ? { pin_to_top: true, importance_boost: 1.4 }
                : kind === 'suppress'
                    ? { suppress: true, importance_boost: 0.65 }
                    : { exclude_from_feed: true };
        quickOverride(storyId, data, manualNote.trim() || `Console ${kind} override`);
    };

    return (
        <div className="space-y-5">
            <div className="rounded-md border bg-background">
                <div className="flex flex-col gap-4 border-b p-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold">News Circulation Desk</h2>
                            {hasPolicyChanges && <Badge variant="warning">Unsaved policy</Badge>}
                            {policy?.source_cadence_mode && (
                                <Badge variant="outline">{cadenceModeLabel(policy.source_cadence_mode)}</Badge>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Story windows, freshness mix, source cadence, and circulation exceptions.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyPreset.mutate('latest_plus')}
                            disabled={applyPreset.isPending}
                        >
                            {applyPreset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            latest_plus
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetDraft}
                            disabled={!hasPolicyChanges || updatePolicy.isPending}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSavePolicy}
                            disabled={!policy || !hasPolicyChanges || updatePolicy.isPending}
                        >
                            {updatePolicy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save policy
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                    <KpiTile
                        icon={<Activity className="h-4 w-4" />}
                        label="Today stories"
                        value={todayMetric?.stories ?? 0}
                        caption={`${todayMetric?.breaking ?? 0} breaking · ${todayMetric?.carryover ?? 0} carryover`}
                        loading={metricsQuery.isLoading}
                    />
                    <KpiTile
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Riyadh window"
                        value={policy?.timezone ?? 'Asia/Riyadh'}
                        caption={`Week starts Sunday · ${draft.carryover_hours}h carryover`}
                        loading={policyQuery.isLoading}
                    />
                    <KpiTile
                        icon={<SlidersHorizontal className="h-4 w-4" />}
                        label="Source cadence"
                        value={cadenceModeLabel(draft.source_cadence_mode)}
                        caption={`${draft.source_claim_interval_minutes}m claim tick · ${activeRecommendations.length} pending`}
                        loading={policyQuery.isLoading || recommendationsQuery.isLoading}
                    />
                    <KpiTile
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Exceptions"
                        value={activeOverrides.length}
                        caption="Pinned, suppressed, or excluded stories"
                        loading={overridesQuery.isLoading}
                    />
                </div>
            </div>

            <AutopilotCockpit
                status={autopilotStatusQuery.data}
                runs={autopilotRunsQuery.data?.data ?? []}
                loading={autopilotStatusQuery.isLoading}
                busy={
                    updateAutopilotSettings.isPending ||
                    runAutopilot.isPending ||
                    boostAutopilot.isPending ||
                    pauseAutopilot.isPending
                }
                onStart={() => updateAutopilotSettings.mutate({ autopilot_enabled: true, autopilot_mode: 'safe_auto' })}
                onRun={() => runAutopilot.mutate()}
                onBoost={() => boostAutopilot.mutate({ duration_minutes: 120 })}
                onPause={() => pauseAutopilot.mutate()}
                onReviewSources={() => setDeskTab('sources')}
            />

            <Tabs value={deskTab} onValueChange={(value) => setDeskTab(value as DeskTab)} className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start">
                    <TabsTrigger value="overview">
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                    </TabsTrigger>
                    <TabsTrigger value="policy">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Policy
                    </TabsTrigger>
                    <TabsTrigger value="sources">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sources
                    </TabsTrigger>
                    <TabsTrigger value="exceptions">
                        <Pin className="mr-2 h-4 w-4" />
                        Exceptions
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <History className="mr-2 h-4 w-4" />
                        Audit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <AttentionPanel items={attentionItems} onOpenTab={setDeskTab} />
                    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.4fr]">
                        <LifecyclePanel metrics={metrics} loading={metricsQuery.isLoading} />
                        <PreviewPanel
                            window={window}
                            setWindow={setWindow}
                            stories={previewStories}
                            loading={previewQuery.isLoading}
                            draftPreview={Boolean(previewPolicy)}
                            onPin={(story) => quickOverride(story.story_id, { pin_to_top: true, importance_boost: 1.4 }, 'Pinned from circulation preview')}
                            onSuppress={(story) => quickOverride(story.story_id, { suppress: true, importance_boost: 0.65 }, 'Suppressed from circulation preview')}
                            onExclude={(story) => quickOverride(story.story_id, { exclude_from_feed: true }, 'Excluded from circulation preview')}
                            onPrepareException={prepareException}
                            busy={upsertOverride.isPending}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="policy" className="space-y-4">
                    <RecipePanel recipes={POLICY_RECIPES} onApply={applyRecipe} />
                    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                        <PolicyWindowPanel draft={draft} setDraftValue={setDraftValue} />
                        <PolicyRankingPanel draft={draft} setDraftValue={setDraftValue} />
                    </div>
                    <PolicyCadencePanel draft={draft} setDraftValue={setDraftValue} />
                    <PolicyChangeSummary changes={changedPolicyFields} onReset={resetDraft} />
                </TabsContent>

                <TabsContent value="sources" className="space-y-4">
                    <AutomationPanel
                        draft={draft}
                        setDraftValue={setDraftValue}
                        lastRunAt={policy?.last_automation_run_at}
                        dirty={hasPolicyChanges}
                        saving={updatePolicy.isPending}
                        onSave={handleSavePolicy}
                    />
                    <SourceCadencePanel
                        mode={draft.source_cadence_mode}
                        activeSources={metricsQuery.data?.active_sources ?? 0}
                        recommendations={activeRecommendations}
                        loading={recommendationsQuery.isLoading}
                        refreshing={generateRecommendations.isPending}
                        applying={applyRecommendation.isPending}
                        onRefresh={() => generateRecommendations.mutate()}
                        onApply={(id) => applyRecommendation.mutate(id)}
                    />
                </TabsContent>

                <TabsContent value="exceptions" className="space-y-4">
                    <ExceptionPanel
                        storyId={manualStoryId}
                        note={manualNote}
                        setStoryId={setManualStoryId}
                        setNote={setManualNote}
                        overrides={activeOverrides}
                        loading={overridesQuery.isLoading}
                        saving={upsertOverride.isPending}
                        deleting={deleteOverride.isPending}
                        onSubmit={submitManualOverride}
                        onDelete={(storyId) => deleteOverride.mutate(storyId)}
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <AuditPanel entries={auditQuery.data?.data ?? []} loading={auditQuery.isLoading} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AutopilotCockpit({
    status,
    runs,
    loading,
    busy,
    onStart,
    onRun,
    onBoost,
    onPause,
    onReviewSources,
}: {
    status?: NewsAutopilotStatus;
    runs: NewsAutopilotRun[];
    loading: boolean;
    busy: boolean;
    onStart: () => void;
    onRun: () => void;
    onBoost: () => void;
    onPause: () => void;
    onReviewSources: () => void;
}) {
    const state = status?.state ?? 'paused';
    const health = status?.health;
    const freshness = status?.freshness;
    const enabled = Boolean(status?.policy.autopilot_enabled);
    const latestRun = status?.latest_run ?? runs[0];
    const actions = status?.latest_actions ?? latestRun?.actions ?? [];
    const snapshotIssues = health?.snapshots.filter((snapshot) => snapshot.dirty || (snapshot.age_seconds ?? 0) > 60).length ?? 0;
    const queueBlocked = health ? !health.aggregation_reachable || health.queue_depth > health.max_queue_depth : false;
    const carryoverPercent = Math.round((health?.today_carryover_ratio ?? 0) * 100);
    const snapshotSummary =
        snapshotIssues === 0
            ? 'All windows clean'
            : `${snapshotIssues} window${snapshotIssues === 1 ? '' : 's'} need refresh`;
    const recommendedAction = !enabled ? 'start' : freshness?.recommended_action ?? 'none';
    const primaryAction = {
        start: { label: 'Start Autopilot', icon: <Power className="mr-2 h-4 w-4" />, onClick: onStart, disabled: busy || loading },
        none: { label: 'No action needed', icon: <CheckCircle2 className="mr-2 h-4 w-4" />, onClick: undefined, disabled: true },
        run_once: { label: 'Run Check', icon: <Play className="mr-2 h-4 w-4" />, onClick: onRun, disabled: busy || loading },
        boost_freshness: { label: 'Boost Freshness', icon: <Sparkles className="mr-2 h-4 w-4" />, onClick: onBoost, disabled: busy || loading || queueBlocked },
        review_sources: { label: 'Review Sources', icon: <RefreshCw className="mr-2 h-4 w-4" />, onClick: onReviewSources, disabled: busy || loading },
        pause: { label: 'Pause Autopilot', icon: <PauseCircle className="mr-2 h-4 w-4" />, onClick: onPause, disabled: busy || loading || !enabled },
    }[recommendedAction];

    const reasonToneClass: Record<'good' | 'warning' | 'danger', string> = {
        good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        danger: 'border-red-200 bg-red-50 text-red-800',
    };

    return (
        <Card className={cn(state === 'boosting' && 'border-emerald-300', state === 'safety' && 'border-amber-300', state === 'degraded' && 'border-red-300')}>
            <CardHeader className="gap-4 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                    <div className={cn('flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-md border text-center', freshnessVerdictClass(freshness?.verdict))}>
                        {loading ? (
                            <Skeleton className="h-8 w-12" />
                        ) : (
                            <span className="text-3xl font-semibold leading-none">{freshness?.score ?? 0}</span>
                        )}
                        <span className="mt-1 text-[11px] font-medium uppercase">Freshness</span>
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                            <Bot className="h-4 w-4 text-primary" />
                            News Circulation Autopilot
                            <Badge variant="outline" className={cn('capitalize', freshnessVerdictClass(freshness?.verdict))}>
                                {freshness ? FRESHNESS_VERDICT_LABELS[freshness.verdict] : 'Checking'}
                            </Badge>
                            <Badge variant="outline" className={cn('capitalize', autopilotStateClass(state))}>
                                {AUTOPILOT_STATE_LABELS[state]}
                            </Badge>
                            {status?.policy.autopilot_boost_until && state === 'boosting' && (
                                <Badge variant="success">until {formatRelativeTime(status.policy.autopilot_boost_until)}</Badge>
                            )}
                        </CardTitle>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                            {freshness?.summary ?? 'Checking circulation health and freshness signals.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(freshness?.reasons ?? []).slice(0, 3).map((reason) => (
                                <span key={`${reason.label}-${reason.detail}`} className={cn('rounded-md border px-2.5 py-1 text-xs', reasonToneClass[reason.tone])}>
                                    <span className="font-medium">{reason.label}</span>
                                    <span className="ml-1 opacity-80">{reason.detail}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button size="sm" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                        {busy && recommendedAction !== 'none' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : primaryAction.icon}
                        {primaryAction.label}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onRun} disabled={busy || loading}>
                        <Play className="mr-2 h-4 w-4" />
                        Run Once
                    </Button>
                    <Button variant="outline" size="sm" onClick={onBoost} disabled={busy || loading || queueBlocked}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Boost
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onPause} disabled={busy || loading || !enabled}>
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Pause
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <KpiTile
                        icon={<Activity className="h-4 w-4" />}
                        label="Today"
                        value={health?.today_story_count ?? 0}
                        caption={`${status?.policy.min_today_stories ?? 8} target stories`}
                        loading={loading}
                    />
                    <KpiTile
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Carryover"
                        value={`${carryoverPercent}%`}
                        caption={`${health?.today_carryover_count ?? 0} carried stories`}
                        loading={loading}
                    />
                    <KpiTile
                        icon={<FileClock className="h-4 w-4" />}
                        label="Snapshots"
                        value={snapshotIssues}
                        caption={snapshotSummary}
                        loading={loading}
                    />
                    <KpiTile
                        icon={<RefreshCw className="h-4 w-4" />}
                        label="Sources due"
                        value={health?.due_sources ?? 0}
                        caption={`${health?.active_sources ?? 0} active sources`}
                        loading={loading}
                    />
                    <KpiTile
                        icon={<Gauge className="h-4 w-4" />}
                        label="Queue"
                        value={`${health?.queue_depth ?? 0}/${health?.max_queue_depth ?? 0}`}
                        caption={health?.aggregation_reachable ? 'Aggregation reachable' : health?.aggregation_error || 'Aggregation unavailable'}
                        loading={loading}
                    />
                    <KpiTile
                        icon={<History className="h-4 w-4" />}
                        label="Last run"
                        value={latestRun ? formatRelativeTime(latestRun.started_at) : 'Never'}
                        caption={latestRun?.summary || 'No ledger yet'}
                        loading={loading}
                    />
                </div>

                <div className="rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">What Autopilot did</p>
                        {latestRun && <Badge variant={latestRun.status === 'completed' ? 'success' : latestRun.status === 'failed' ? 'destructive' : 'warning'}>{latestRun.status}</Badge>}
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)
                        ) : actions.length === 0 ? (
                            <EmptyState icon={<History className="h-5 w-5" />} title="No Autopilot actions yet" />
                        ) : (
                            actions.slice(0, 6).map((action) => <AutopilotActionRow key={action.id} action={action} />)
                        )}
                    </div>
                </div>

                <details className="rounded-md border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Safety and tool access</summary>
                    <div className="mt-3 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-medium text-muted-foreground">Allowed tools</p>
                                <Badge variant={state === 'boosting' ? 'success' : 'secondary'}>
                                    {state === 'boosting' ? 'Boosted toolbelt' : 'Core toolbelt'}
                                </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {(status?.allowed_tools ?? []).map((tool) => (
                                    <Badge key={tool} variant="outline" className="font-normal">
                                        {tool.replaceAll('_', ' ')}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Blocked tools</p>
                            {(status?.blocked_tools ?? []).slice(0, 4).map((tool) => (
                                <div key={tool.name} className="rounded-sm border bg-background px-2 py-1.5">
                                    <p className="text-xs font-medium">{tool.name.replaceAll('_', ' ')}</p>
                                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{tool.reason}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </details>
            </CardContent>
        </Card>
    );
}

function AutopilotActionRow({ action }: { action: NewsAutopilotAction }) {
    const variant =
        action.status === 'success'
            ? 'success'
            : action.status === 'error'
                ? 'destructive'
                : action.status === 'skipped'
                    ? 'warning'
                    : 'secondary';
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-2.5">
            <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{AUTOPILOT_ACTION_LABELS[action.tool_name] ?? action.tool_name.replaceAll('_', ' ')}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {action.error || action.reason || formatRelativeTime(action.started_at)}
                </p>
            </div>
            <Badge variant={variant}>{action.status}</Badge>
        </div>
    );
}

function KpiTile({
    icon,
    label,
    value,
    caption,
    loading,
}: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
    caption: string;
    loading?: boolean;
}) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <span className="rounded-md bg-background p-1.5 text-muted-foreground">{icon}</span>
            </div>
            {loading ? (
                <Skeleton className="mt-3 h-7 w-24" />
            ) : (
                <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
            )}
            <p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p>
        </div>
    );
}

function AttentionPanel({
    items,
    onOpenTab,
}: {
    items: AttentionItem[];
    onOpenTab: (tab: DeskTab) => void;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Attention Queue
                </CardTitle>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center gap-3">
                            <span className="rounded-md bg-background p-2 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold">No immediate circulation work</p>
                                <p className="text-xs text-muted-foreground">Windows, cadence, and exceptions look steady.</p>
                            </div>
                        </div>
                        <Badge variant="success">Clear</Badge>
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {items.map((item) => (
                            <div key={`${item.title}-${item.detail}`} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={item.tone}>{ATTENTION_TONE_LABELS[item.tone]}</Badge>
                                        <p className="truncate text-sm font-semibold">{item.title}</p>
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                                {item.tab && item.action && (
                                    <Button variant="outline" size="sm" onClick={() => onOpenTab(item.tab!)}>
                                        {item.action}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RecipePanel({
    recipes,
    onApply,
}: {
    recipes: PolicyRecipe[];
    onApply: (recipe: PolicyRecipe) => void;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Wand2 className="h-4 w-4 text-primary" />
                    Policy Recipes
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
                {recipes.map((recipe) => (
                    <button
                        key={recipe.id}
                        type="button"
                        onClick={() => onApply(recipe)}
                        className="rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/40"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">{recipe.label}</p>
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{recipe.description}</p>
                    </button>
                ))}
            </CardContent>
        </Card>
    );
}

function PolicyChangeSummary({
    changes,
    onReset,
}: {
    changes: Array<{ key: keyof PolicyDraft; label: string; from: string; to: string }>;
    onReset: () => void;
}) {
    if (changes.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <span className="rounded-md bg-muted p-2 text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-sm font-semibold">Policy matches production</p>
                            <p className="text-xs text-muted-foreground">No draft changes waiting to save.</p>
                        </div>
                    </div>
                    <Badge variant="secondary">Synced</Badge>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="gap-3 pb-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Save className="h-4 w-4 text-primary" />
                    Before Save
                </CardTitle>
                <Button variant="outline" size="sm" onClick={onReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset draft
                </Button>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {changes.map((change) => (
                    <div key={change.key} className="rounded-md border bg-background p-3">
                        <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                        <p className="mt-1 truncate text-sm">
                            <span className="text-muted-foreground">{change.from}</span>
                            <span className="px-2 text-muted-foreground">→</span>
                            <span className="font-semibold">{change.to}</span>
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function LifecyclePanel({ metrics, loading }: { metrics: CirculationWindowMetric[]; loading: boolean }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Window Health
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
                ) : metrics.length === 0 ? (
                    <EmptyState icon={<FileClock className="h-5 w-5" />} title="No lifecycle metrics yet" />
                ) : (
                    metrics.map((metric) => <LifecycleWindow key={metric.window} metric={metric} />)
                )}
            </CardContent>
        </Card>
    );
}

function LifecycleWindow({ metric }: { metric: CirculationWindowMetric }) {
    const total = Math.max(metric.stories, 1);
    const segments = [
        { key: 'breaking', label: 'Breaking', value: metric.breaking, className: 'bg-red-500' },
        { key: 'active', label: 'Active', value: metric.active, className: 'bg-emerald-500' },
        { key: 'cooling', label: 'Cooling', value: metric.cooling, className: 'bg-amber-500' },
        { key: 'historical', label: 'Historical', value: metric.historical, className: 'bg-slate-400' },
    ];
    return (
        <div className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold capitalize">{metric.window}</p>
                    <p className="text-xs text-muted-foreground">{metric.stories} stories</p>
                </div>
                {metric.carryover > 0 && <Badge variant="warning">{metric.carryover} carryover</Badge>}
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                {segments.map((segment) => (
                    <div
                        key={segment.key}
                        className={segment.className}
                        style={{ width: `${(segment.value / total) * 100}%` }}
                    />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {segments.map((segment) => (
                    <div key={segment.key} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">{segment.label}</span>
                        <span className="font-medium">{segment.value} · {metricPercent(segment.value, metric.stories)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PreviewPanel({
    window,
    setWindow,
    stories,
    loading,
    draftPreview,
    onPin,
    onSuppress,
    onExclude,
    onPrepareException,
    busy,
}: {
    window: NewsWindow;
    setWindow: (window: NewsWindow) => void;
    stories: CirculationStorySummary[];
    loading: boolean;
    draftPreview: boolean;
    onPin: (story: CirculationStorySummary) => void;
    onSuppress: (story: CirculationStorySummary) => void;
    onExclude: (story: CirculationStorySummary) => void;
    onPrepareException: (story: CirculationStorySummary) => void;
    busy: boolean;
}) {
    return (
        <Card>
            <CardHeader className="gap-3 pb-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-4 w-4 text-primary" />
                    Top Story Simulation
                    {draftPreview && <Badge variant="warning">Draft policy</Badge>}
                </CardTitle>
                <SegmentedControl label="Story window" value={window} options={WINDOWS} onValueChange={setWindow} size="sm" />
            </CardHeader>
            <CardContent className="space-y-2">
                {loading ? (
                    Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
                ) : stories.length === 0 ? (
                    <EmptyState icon={<FileClock className="h-5 w-5" />} title="No stories in this window" />
                ) : (
                    stories.slice(0, 10).map((story, index) => (
                        <PreviewStoryRow
                            key={story.story_id}
                            story={story}
                            rank={index + 1}
                            busy={busy}
                            onPin={onPin}
                            onSuppress={onSuppress}
                            onExclude={onExclude}
                            onPrepareException={onPrepareException}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function PreviewStoryRow({
    story,
    rank,
    busy,
    onPin,
    onSuppress,
    onExclude,
    onPrepareException,
}: {
    story: CirculationStorySummary;
    rank: number;
    busy: boolean;
    onPin: (story: CirculationStorySummary) => void;
    onSuppress: (story: CirculationStorySummary) => void;
    onExclude: (story: CirculationStorySummary) => void;
    onPrepareException: (story: CirculationStorySummary) => void;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-md border bg-background p-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {rank}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{storyTitle(story)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn('capitalize', lifecycleClass(story.lifecycle))}>
                            {LIFECYCLE_LABELS[story.lifecycle]}
                        </Badge>
                        {story.is_carryover && <Badge variant="warning">Carryover</Badge>}
                        {story.reason && <Badge variant="secondary">{story.reason}</Badge>}
                        <span className="text-xs text-muted-foreground">
                            {story.member_count} posts{story.source_count ? ` · ${story.source_count} sources` : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">Updated {formatRelativeTime(story.last_member_at)}</span>
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
                <IconAction label="Pin" icon={<Pin className="h-3.5 w-3.5" />} onClick={() => onPin(story)} disabled={busy} />
                <IconAction label="Suppress" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => onSuppress(story)} disabled={busy} />
                <IconAction label="Exclude" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => onExclude(story)} disabled={busy} />
                <Button variant="outline" size="sm" onClick={() => onPrepareException(story)}>
                    Edit
                </Button>
            </div>
        </div>
    );
}

function PolicyWindowPanel({
    draft,
    setDraftValue,
}: {
    draft: PolicyDraft;
    setDraftValue: <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => void;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Story Windows
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
                <NumberControl
                    label="Today minimum"
                    value={draft.min_today_stories}
                    onChange={(value) => setDraftValue('min_today_stories', value)}
                    min={1}
                    step={1}
                    suffix="stories"
                />
                <NumberControl
                    label="Carryover span"
                    value={draft.carryover_hours}
                    onChange={(value) => setDraftValue('carryover_hours', value)}
                    min={1}
                    step={6}
                    suffix="hours"
                />
                <NumberControl
                    label="Carryover score"
                    value={draft.carryover_min_score}
                    onChange={(value) => setDraftValue('carryover_min_score', value)}
                    min={0}
                    step={0.05}
                />
                <NumberControl
                    label="Breaking age"
                    value={draft.breaking_max_age_minutes}
                    onChange={(value) => setDraftValue('breaking_max_age_minutes', value)}
                    min={1}
                    step={15}
                    suffix="min"
                />
                <NumberControl
                    label="Breaking members"
                    value={draft.breaking_min_members}
                    onChange={(value) => setDraftValue('breaking_min_members', value)}
                    min={1}
                    step={1}
                    suffix="posts"
                />
            </CardContent>
        </Card>
    );
}

function PolicyRankingPanel({
    draft,
    setDraftValue,
}: {
    draft: PolicyDraft;
    setDraftValue: <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => void;
}) {
    const fields: Array<{ key: WeightKey; label: string; icon: ReactNode }> = [
        { key: 'recency_weight', label: 'Recency', icon: <Clock3 className="h-3.5 w-3.5" /> },
        { key: 'importance_weight', label: 'Importance', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
        { key: 'momentum_weight', label: 'Momentum', icon: <TrendingUp className="h-3.5 w-3.5" /> },
        { key: 'coverage_weight', label: 'Coverage', icon: <Activity className="h-3.5 w-3.5" /> },
        { key: 'source_quality_weight', label: 'Source quality', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
        { key: 'diversity_weight', label: 'Diversity', icon: <Sparkles className="h-3.5 w-3.5" /> },
        { key: 'trending_weight', label: 'Trending', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    ];
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    Ranking Mix
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {fields.map((field) => (
                    <WeightControl
                        key={field.key}
                        icon={field.icon}
                        label={field.label}
                        value={draft[field.key]}
                        onChange={(value) => setDraftValue(field.key, value)}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function PolicyCadencePanel({
    draft,
    setDraftValue,
}: {
    draft: PolicyDraft;
    setDraftValue: <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => void;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Source Cadence Guardrails
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                    <Label className="text-xs">Mode</Label>
                    <Select
                        value={draft.source_cadence_mode}
                        onValueChange={(value) => setDraftValue('source_cadence_mode', value as SourceCadenceMode)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="suggest">Suggest</SelectItem>
                            <SelectItem value="auto_apply">Auto apply</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                        Suggest files recommendations for review · Auto apply moves intervals inside the guardrails below · Manual freezes cadence.
                    </p>
                </div>
                <NumberControl label="Claim tick" value={draft.source_claim_interval_minutes} onChange={(value) => setDraftValue('source_claim_interval_minutes', value)} min={1} step={5} suffix="min" />
                <NumberControl label="Claim batch" value={draft.source_claim_batch_size} onChange={(value) => setDraftValue('source_claim_batch_size', value)} min={1} step={5} suffix="sources" />
                <NumberControl label="Min interval" value={draft.source_min_interval_minutes} onChange={(value) => setDraftValue('source_min_interval_minutes', value)} min={1} step={5} suffix="min" />
                <NumberControl label="Max interval" value={draft.source_max_interval_minutes} onChange={(value) => setDraftValue('source_max_interval_minutes', value)} min={1} step={30} suffix="min" />
                <NumberControl label="Max change" value={draft.source_max_change_percent} onChange={(value) => setDraftValue('source_max_change_percent', value)} min={1} step={5} suffix="%" />
            </CardContent>
        </Card>
    );
}

function AutomationPanel({
    draft,
    setDraftValue,
    lastRunAt,
    dirty,
    saving,
    onSave,
}: {
    draft: PolicyDraft;
    setDraftValue: <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => void;
    lastRunAt?: string;
    dirty: boolean;
    saving: boolean;
    onSave: () => void;
}) {
    const enabled = draft.automation_enabled;
    const isAutoApply = draft.source_cadence_mode === 'auto_apply';
    const cadence = numberValue(draft.automation_interval_minutes, 60);

    // Plain-English summary of what the heartbeat will do, given the current mode.
    const behavior = !isAutoApply
        ? 'The system recomputes recommendations on its own and files them for your review. Nothing changes until you apply.'
        : draft.auto_apply_speedups
            ? 'The system applies cadence changes on its own — both slowing sources down AND speeding them up — inside your guardrails.'
            : 'The system slows noisy or failing sources down on its own. Speeding a source up (the only change that raises fetch volume) is filed for your approval.';

    return (
        <Card className={cn(enabled && 'border-primary/40')}>
            <CardHeader className="gap-3 pb-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bot className="h-4 w-4 text-primary" />
                        Automatic Source Tuning
                        <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'On' : 'Off'}</Badge>
                    </CardTitle>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                        Let the news pipeline tune itself: the engine recomputes source cadence on a schedule instead of
                        waiting pods to press “Recompute”. Turn it off any time to take back full manual control.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch
                        checked={enabled}
                        onCheckedChange={(value) => setDraftValue('automation_enabled', value)}
                        aria-label="Toggle automatic source tuning"
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className={cn('rounded-md border p-3', enabled ? 'bg-primary/5' : 'bg-muted/20')}>
                    <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-xs text-muted-foreground">{behavior}</p>
                    </div>
                </div>

                {enabled && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <NumberControl
                                label="Run every"
                                value={draft.automation_interval_minutes}
                                onChange={(value) => setDraftValue('automation_interval_minutes', value)}
                                min={5}
                                step={5}
                                suffix="min"
                            />
                            <div className="rounded-md border bg-background p-3">
                                <p className="text-xs font-medium text-muted-foreground">Last automated run</p>
                                <p className="mt-2 text-sm font-semibold">
                                    {lastRunAt ? formatRelativeTime(lastRunAt) : 'Not run yet'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Heartbeat checks every minute · runs every {minutesLabel(cadence)}</p>
                            </div>
                        </div>

                        {isAutoApply ? (
                            <div className="space-y-3 rounded-md border bg-background p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">Auto-apply speed-ups</p>
                                        <p className="text-xs text-muted-foreground">
                                            Off keeps cost-increasing changes human-gated. Turn on only if you want the engine to
                                            pull sources <span className="font-medium">more</span> often on its own.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={draft.auto_apply_speedups}
                                        onCheckedChange={(value) => setDraftValue('auto_apply_speedups', value)}
                                        aria-label="Toggle auto-apply speed-ups"
                                    />
                                </div>
                                {draft.auto_apply_speedups && (
                                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <p className="text-xs">
                                            Speed-ups increase fetch volume and provider cost. Changes still stay inside the
                                            min-interval and max-change guardrails below.
                                        </p>
                                    </div>
                                )}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <NumberControl
                                        label="Max changes per run"
                                        value={draft.max_auto_applies_per_run}
                                        onChange={(value) => setDraftValue('max_auto_applies_per_run', value)}
                                        min={1}
                                        step={1}
                                        suffix="sources"
                                    />
                                    <NumberControl
                                        label="Min runs before auto"
                                        value={draft.min_runs_for_auto}
                                        onChange={(value) => setDraftValue('min_runs_for_auto', value)}
                                        min={2}
                                        step={1}
                                        suffix="runs"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
                                <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                    Cadence mode is <span className="font-medium">{cadenceModeLabel(draft.source_cadence_mode)}</span>, so
                                    automation only files suggestions. Switch the mode to <span className="font-medium">Auto apply</span>{' '}
                                    in Policy → Source Cadence Guardrails to let it apply changes within limits.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {dirty && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-800">Automation settings aren’t saved yet.</p>
                        <Button size="sm" onClick={onSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SourceCadencePanel({
    mode,
    activeSources,
    recommendations,
    loading,
    refreshing,
    applying,
    onRefresh,
    onApply,
}: {
    mode: SourceCadenceMode;
    activeSources: number;
    recommendations: SourceCirculationRecommendation[];
    loading: boolean;
    refreshing: boolean;
    applying: boolean;
    onRefresh: () => void;
    onApply: (id: string) => void;
}) {
    return (
        <Card>
            <CardHeader className="gap-3 pb-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        Source Cadence Queue
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{activeSources} active sources</Badge>
                        <Badge variant="outline">{cadenceModeLabel(mode)}</Badge>
                        <Badge variant={recommendations.length > 0 ? 'warning' : 'success'}>{recommendations.length} pending</Badge>
                    </div>
                    <p className="mt-2 max-w-prose text-xs text-muted-foreground">
                        Recommendations are computed from each source&apos;s last 7 days of fetch telemetry (new-content yield
                        and failure rate) and always stay inside the min/max interval and max-change guardrails.
                        {mode === 'auto_apply'
                            ? ' Auto-apply mode applies them on refresh; no manual step needed.'
                            : ' Review and apply each below.'}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                    <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                    Recompute now
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
                ) : recommendations.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No pending cadence changes" />
                ) : (
                    recommendations.slice(0, 10).map((rec) => (
                        <SourceRecommendationRow key={rec.id} rec={rec} applying={applying} onApply={onApply} />
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function SourceRecommendationRow({
    rec,
    applying,
    onApply,
}: {
    rec: SourceCirculationRecommendation;
    applying: boolean;
    onApply: (id: string) => void;
}) {
    const faster = rec.recommended_interval_minutes < rec.current_interval_minutes;
    const evidence = recommendationEvidence(rec.metrics);
    return (
        <div className="rounded-md border bg-background p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{rec.source_name || rec.source_id}</p>
                        <Badge variant={faster ? 'success' : 'warning'} className="gap-1">
                            {faster ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            {minutesLabel(rec.current_interval_minutes)} → {minutesLabel(rec.recommended_interval_minutes)}
                        </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{rec.reason}</p>
                    {evidence.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {evidence.map((chip) => (
                                <Badge key={chip} variant="outline" className="font-normal text-muted-foreground">
                                    {chip}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => onApply(rec.id)} disabled={applying}>
                        <Wand2 className="mr-2 h-3.5 w-3.5" />
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ExceptionPanel({
    storyId,
    note,
    setStoryId,
    setNote,
    overrides,
    loading,
    saving,
    deleting,
    onSubmit,
    onDelete,
}: {
    storyId: string;
    note: string;
    setStoryId: (value: string) => void;
    setNote: (value: string) => void;
    overrides: NewsStoryOverride[];
    loading: boolean;
    saving: boolean;
    deleting: boolean;
    onSubmit: (kind: 'pin' | 'suppress' | 'exclude') => void;
    onDelete: (storyId: string) => void;
}) {
    return (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Pin className="h-4 w-4 text-primary" />
                        Add Exception
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Label className="text-xs">Story UUID</Label>
                        <Input value={storyId} onChange={(event) => setStoryId(event.target.value)} placeholder="Story UUID" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Note</Label>
                        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or context" rows={4} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <Button variant="outline" size="sm" onClick={() => onSubmit('pin')} disabled={!storyId.trim() || saving}>
                            <Pin className="mr-2 h-3.5 w-3.5" />
                            Pin
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onSubmit('suppress')} disabled={!storyId.trim() || saving}>
                            <EyeOff className="mr-2 h-3.5 w-3.5" />
                            Suppress
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onSubmit('exclude')} disabled={!storyId.trim() || saving}>
                            <Ban className="mr-2 h-3.5 w-3.5" />
                            Exclude
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Active Exceptions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
                    ) : overrides.length === 0 ? (
                        <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No active exceptions" />
                    ) : (
                        overrides.slice(0, 12).map((override) => (
                            <OverrideRow key={override.id} override={override} deleting={deleting} onDelete={onDelete} />
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function OverrideRow({
    override,
    deleting,
    onDelete,
}: {
    override: NewsStoryOverride;
    deleting: boolean;
    onDelete: (storyId: string) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
            <div className="min-w-0">
                <p className="truncate text-xs font-mono">{override.story_id}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                    {override.pin_to_top && <Badge>Pin</Badge>}
                    {override.suppress && <Badge variant="warning">Suppress</Badge>}
                    {override.exclude_from_feed && <Badge variant="destructive">Exclude</Badge>}
                    <Badge variant="outline">×{override.importance_boost.toFixed(2)}</Badge>
                    {override.expires_at && <Badge variant="secondary">expires {formatRelativeTime(override.expires_at)}</Badge>}
                </div>
                {override.notes && <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{override.notes}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onDelete(override.story_id)} disabled={deleting}>
                <X className="mr-2 h-3.5 w-3.5" />
                Remove
            </Button>
        </div>
    );
}

function AuditPanel({ entries, loading }: { entries: AuditLogEntry[]; loading: boolean }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-primary" />
                    Audit Trail
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {loading ? (
                    Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
                ) : entries.length === 0 ? (
                    <EmptyState icon={<History className="h-5 w-5" />} title="No circulation audit entries" />
                ) : (
                    entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)
                )}
            </CardContent>
        </Card>
    );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
    return (
        <div className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{entry.action.replace('circulation.', '').replaceAll('.', ' ')}</p>
                <Badge variant={entry.status === 'success' ? 'success' : 'destructive'}>{entry.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                {entry.user_email || 'system'} · {formatRelativeTime(entry.created_at)}
            </p>
        </div>
    );
}

function NumberControl({
    label,
    value,
    onChange,
    min,
    step,
    suffix,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    step: number;
    suffix?: string;
}) {
    const numeric = numberValue(value, min);
    const update = (next: number) => onChange(String(Math.max(min, Number(next.toFixed(2)))));
    return (
        <div className="space-y-2">
            <Label className="text-xs">{label}</Label>
            <div className="flex h-10 items-center rounded-md border bg-background">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-sm px-2"
                    onClick={() => update(numeric - step)}
                >
                    <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                    type="number"
                    value={value}
                    min={min}
                    step={step}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-9 border-0 text-center shadow-none focus-visible:ring-0"
                />
                {suffix && <span className="pr-2 text-xs text-muted-foreground">{suffix}</span>}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-sm px-2"
                    onClick={() => update(numeric + step)}
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

function WeightControl({
    icon,
    label,
    value,
    onChange,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const numeric = Math.max(0, Math.min(1, numberValue(value, 0)));
    return (
        <div className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{icon}</span>
                    {label}
                </Label>
                <Input
                    type="number"
                    value={value}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-8 w-20 text-right"
                />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${numeric * 100}%` }} />
            </div>
        </div>
    );
}

function IconAction({
    label,
    icon,
    onClick,
    disabled,
}: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
            {icon}
            <span className="ml-2">{label}</span>
        </Button>
    );
}

function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
    return (
        <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 p-6 text-center">
            <div className="rounded-md bg-background p-2 text-muted-foreground">{icon}</div>
            <p className="mt-2 text-sm font-medium">{title}</p>
        </div>
    );
}
