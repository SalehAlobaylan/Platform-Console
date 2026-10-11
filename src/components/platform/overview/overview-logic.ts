import type { OpsAttentionItem, OpsFleetStatus } from '@/lib/api/cms/operations';
import type { AISpendBudget, AISpendRollup } from '@/lib/api/cms/ai-spend';
import type { ExperienceRun, RuxVerdict, SurfaceVerdict } from '@/types/platform/real-experience';
import type { ServiceHealth } from '@/types/platform/system-health';
import type { FeedIntegrityRun } from '@/types/platform/feed-integrity';
import type { ContentDailyPoint } from '@/types/platform/content';

export type BadgeTone = 'success' | 'warning' | 'destructive' | 'secondary';

const GOOD = ['healthy', 'all_clear', 'within', 'ok', 'running', 'idle', 'completed'];
const BAD = ['degraded_major', 'broken', 'critical', 'unhealthy', 'incident', 'errored', 'stalled', 'failed', 'over_budget', 'bounded_stop'];
const WATCH = ['watching', 'watch', 'warning', 'degraded', 'degraded_minor', 'minor', 'attention', 'paused', 'pressure', 'over_pace', 'recovering', 'telemetry_degraded'];

/** Maps the fleet's verdict vocabulary onto console badge variants. Unknown values stay neutral. */
export function tone(value?: string | null): BadgeTone {
    if (!value) return 'secondary';
    const v = value.toLowerCase();
    if (GOOD.includes(v)) return 'success';
    if (BAD.includes(v)) return 'destructive';
    if (WATCH.includes(v)) return 'warning';
    return 'secondary';
}

export const label = (value?: string | null) => (value ? value.replaceAll('_', ' ') : 'unknown');

/** Human relative time. Future timestamps (clock skew) clamp to "just now". */
export function relative(value?: string | null, now = Date.now()): string {
    if (!value) return 'never';
    const minutes = Math.min(0, Math.round((new Date(value).getTime() - now) / 60_000));
    if (minutes === 0) return 'just now';
    const fmt = new Intl.RelativeTimeFormat('en');
    if (Math.abs(minutes) >= 60 * 24) return fmt.format(Math.round(minutes / (60 * 24)), 'day');
    if (Math.abs(minutes) >= 60) return fmt.format(Math.round(minutes / 60), 'hour');
    return fmt.format(minutes, 'minute');
}

/** Worst budget state across all AI spend budgets: paused > over_budget > warning > within. */
export function deriveSpendState(budgets: AISpendBudget[] | undefined, now = new Date()): string | undefined {
    if (!budgets?.length) return undefined;
    if (budgets.some((b) => b.paused_until && new Date(b.paused_until) > now)) return 'paused';
    if (budgets.some((b) => b.cap_usd && b.spend_usd >= b.cap_usd * (b.hard_pct / 100))) return 'over_budget';
    if (budgets.some((b) => b.cap_usd && b.spend_usd >= b.cap_usd * (b.warn_pct / 100))) return 'warning';
    return 'within';
}

const RUX_ORDER: RuxVerdict[] = ['critical', 'degraded', 'telemetry_degraded', 'watching', 'insufficient_data', 'healthy'];

/** Worst surface verdict; empty/null verdict maps mean the run produced nothing yet. */
export function deriveWorstRux(surfaceVerdicts: Record<string, SurfaceVerdict> | null | undefined): RuxVerdict | undefined {
    if (surfaceVerdicts === undefined) return undefined;
    const verdicts = Object.values(surfaceVerdicts ?? {}).map((s) => s.verdict);
    return RUX_ORDER.find((v) => verdicts.includes(v)) ?? 'insufficient_data';
}

export interface FleetSummary {
    state?: string;
    lanes: number;
    stalled: number;
    paused: number;
}

/** Rolls the ops fleet lane states into one dashboard verdict. */
export function deriveFleetState(fleet: OpsFleetStatus[] | undefined): FleetSummary {
    const lanes = fleet ?? [];
    const stalled = lanes.filter((f) => f.state === 'stalled' || f.state === 'errored').length;
    const paused = lanes.filter((f) => f.state === 'paused').length;
    return {
        state: lanes.length ? (stalled ? 'stalled' : paused ? 'paused' : 'all_clear') : undefined,
        lanes: lanes.length,
        stalled,
        paused,
    };
}

/** One-line services detail: which services are not healthy, or the healthy count. */
export function deriveServicesDetail(services: ServiceHealth[] | undefined): string | undefined {
    if (!services) return undefined;
    const unhealthy = services.filter((s) => s.status !== 'healthy');
    return unhealthy.length
        ? `${unhealthy.map((s) => s.displayName).join(', ')} not healthy`
        : `${services.length} services healthy`;
}

/** Unsnoozed attention items, capped for the dashboard preview. */
export function topAttention(items: OpsAttentionItem[] | undefined, cap = 6): OpsAttentionItem[] {
    return (items ?? []).filter((item) => !item.snoozed).slice(0, cap);
}

// --- Trend series -----------------------------------------------------------
// All builders emit ContentDailyPoint[] because the shared Sparkline consumes
// that shape and reads only `.count`. `day` is an opaque label — ISO strings
// sort lexicographically, so no Date parsing.

const byStartedAtAsc = (a: { started_at: string }, b: { started_at: string }) =>
    a.started_at.localeCompare(b.started_at);

/** Worst consumer score per completed Feed Integrity run, oldest → newest. */
export function feedScoreSeries(runs: FeedIntegrityRun[] | undefined, cap = 12): ContentDailyPoint[] {
    return (runs ?? [])
        .filter(
            (run) =>
                (run.status === 'completed' || run.status === 'partial') &&
                run.feed_results &&
                Object.values(run.feed_results).some((f) => typeof f.consumer_score === 'number'),
        )
        .sort(byStartedAtAsc)
        .slice(-cap)
        .map((run) => ({
            day: run.started_at,
            count: Math.round(Math.min(...Object.values(run.feed_results!).map((f) => f.consumer_score).filter((score): score is number => typeof score === 'number'))),
            failed: 0,
        }));
}

/** Percent of surfaces healthy per completed Experience run, oldest → newest. */
export function ruxHealthSeries(runs: ExperienceRun[] | undefined, cap = 12): ContentDailyPoint[] {
    return (runs ?? [])
        .filter(
            (run) =>
                (run.status === 'completed' || run.status === 'partial') &&
                run.surface_verdicts &&
                Object.keys(run.surface_verdicts).length > 0,
        )
        .sort(byStartedAtAsc)
        .slice(-cap)
        .map((run) => {
            const verdicts = Object.values(run.surface_verdicts!);
            const healthy = verdicts.filter((s) => s.verdict === 'healthy').length;
            return { day: run.started_at, count: Math.round((healthy / verdicts.length) * 100), failed: 0 };
        });
}

/** Daily AI spend summed across rollup rows (multiple rows per day per model/provider). */
export function spendDailySeries(rollups: AISpendRollup[] | undefined, days = 14): ContentDailyPoint[] {
    const byDay = new Map<string, number>();
    for (const rollup of rollups ?? []) {
        byDay.set(rollup.day, (byDay.get(rollup.day) ?? 0) + rollup.cost_usd);
    }
    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-days)
        .map(([day, cost]) => ({ day, count: Math.round(cost * 100) / 100, failed: 0 }));
}
