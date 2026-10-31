import {
    deriveFleetState,
    deriveServicesDetail,
    deriveSpendState,
    deriveWorstRux,
    feedScoreSeries,
    label,
    relative,
    ruxHealthSeries,
    spendDailySeries,
    tone,
    topAttention,
} from '@/components/platform/overview/overview-logic';
import type { AISpendBudget, AISpendRollup } from '@/lib/api/cms/ai-spend';
import type { OpsAttentionItem, OpsFleetStatus } from '@/lib/api/cms/operations';
import type { FeedIntegrityRun } from '@/types/platform/feed-integrity';
import type { ExperienceRun, SurfaceVerdict } from '@/types/platform/real-experience';
import type { ServiceHealth } from '@/types/platform/system-health';

describe('tone', () => {
    it.each([
        ['healthy', 'success'],
        ['all_clear', 'success'],
        ['within', 'success'],
        ['idle', 'success'],
        ['stalled', 'destructive'],
        ['bounded_stop', 'destructive'],
        ['degraded_major', 'destructive'],
        ['broken', 'destructive'],
        ['over_budget', 'destructive'],
        ['telemetry_degraded', 'warning'],
        ['degraded_minor', 'warning'],
        ['watching', 'warning'],
        ['paused', 'warning'],
        ['over_pace', 'warning'],
        ['ALL_CLEAR', 'success'],
    ])('%s → %s', (value, expected) => {
        expect(tone(value)).toBe(expected);
    });

    it('maps unknown and empty values to secondary', () => {
        expect(tone('something_new')).toBe('secondary');
        expect(tone(undefined)).toBe('secondary');
        expect(tone(null)).toBe('secondary');
        expect(tone('')).toBe('secondary');
    });
});

describe('label', () => {
    it('replaces underscores and falls back to unknown', () => {
        expect(label('degraded_major')).toBe('degraded major');
        expect(label(undefined)).toBe('unknown');
    });
});

describe('relative', () => {
    const now = new Date('2026-07-13T12:00:00Z').getTime();

    it('formats past minutes, hours, and days', () => {
        expect(relative('2026-07-13T11:55:00Z', now)).toBe('5 minutes ago');
        expect(relative('2026-07-13T09:00:00Z', now)).toBe('3 hours ago');
        expect(relative('2026-07-11T12:00:00Z', now)).toBe('2 days ago');
    });

    it('clamps future timestamps to just now', () => {
        expect(relative('2026-07-13T12:10:00Z', now)).toBe('just now');
    });

    it('handles missing values', () => {
        expect(relative(undefined, now)).toBe('never');
        expect(relative(null, now)).toBe('never');
    });
});

const budget = (overrides: Partial<AISpendBudget>): AISpendBudget => ({
    id: 1,
    scope: 'platform',
    cap_usd: 100,
    warn_pct: 80,
    hard_pct: 100,
    spend_usd: 0,
    reserved_usd: 0,
    paused_until: null,
    ...overrides,
});

describe('deriveSpendState', () => {
    const now = new Date('2026-07-13T12:00:00Z');

    it('returns undefined for empty budgets', () => {
        expect(deriveSpendState(undefined, now)).toBeUndefined();
        expect(deriveSpendState([], now)).toBeUndefined();
    });

    it('returns within when under warn threshold', () => {
        expect(deriveSpendState([budget({ spend_usd: 10 })], now)).toBe('within');
    });

    it('returns warning at warn threshold', () => {
        expect(deriveSpendState([budget({ spend_usd: 80 })], now)).toBe('warning');
    });

    it('returns over_budget at hard threshold', () => {
        expect(deriveSpendState([budget({ spend_usd: 100 })], now)).toBe('over_budget');
    });

    it('paused wins over over_budget', () => {
        const budgets = [budget({ spend_usd: 100 }), budget({ paused_until: '2026-07-14T00:00:00Z' })];
        expect(deriveSpendState(budgets, now)).toBe('paused');
    });

    it('ignores expired paused_until', () => {
        expect(deriveSpendState([budget({ paused_until: '2026-07-12T00:00:00Z', spend_usd: 10 })], now)).toBe('within');
    });

    it('uncapped budgets never warn', () => {
        expect(deriveSpendState([budget({ cap_usd: null, spend_usd: 5000 })], now)).toBe('within');
    });
});

const surface = (verdict: SurfaceVerdict['verdict']): SurfaceVerdict => ({ verdict, slis: [] });

describe('deriveWorstRux', () => {
    it('returns undefined when status has not loaded', () => {
        expect(deriveWorstRux(undefined)).toBeUndefined();
    });

    it('returns insufficient_data for null or empty verdict maps', () => {
        expect(deriveWorstRux(null)).toBe('insufficient_data');
        expect(deriveWorstRux({})).toBe('insufficient_data');
    });

    it('picks the worst verdict across surfaces', () => {
        expect(deriveWorstRux({ pods: surface('healthy'), news: surface('degraded') })).toBe('degraded');
        expect(deriveWorstRux({ pods: surface('watching'), news: surface('critical') })).toBe('critical');
        expect(deriveWorstRux({ pods: surface('healthy') })).toBe('healthy');
    });
});

const lane = (state: OpsFleetStatus['state']): OpsFleetStatus =>
    ({ member_key: 'm', member_label: 'M', family: 'f', kind: 'k', lane_key: state, lane_label: state, state, enabled: true, pausable: true, liveness: 'ok', cockpit_path: '/x' }) as OpsFleetStatus;

describe('deriveFleetState', () => {
    it('returns undefined state for empty fleet', () => {
        expect(deriveFleetState(undefined).state).toBeUndefined();
        expect(deriveFleetState([]).lanes).toBe(0);
    });

    it('stalled and errored lanes dominate', () => {
        const summary = deriveFleetState([lane('running'), lane('errored'), lane('paused')]);
        expect(summary.state).toBe('stalled');
        expect(summary.stalled).toBe(1);
        expect(summary.paused).toBe(1);
    });

    it('paused beats all_clear', () => {
        expect(deriveFleetState([lane('idle'), lane('paused')]).state).toBe('paused');
    });

    it('all clear when everything runs', () => {
        expect(deriveFleetState([lane('running'), lane('idle')]).state).toBe('all_clear');
    });
});

describe('deriveServicesDetail', () => {
    const service = (displayName: string, status: ServiceHealth['status']): ServiceHealth =>
        ({ name: displayName.toLowerCase(), displayName, endpointUrl: '', status, latencyMs: null, httpStatus: null, deps: [] }) as unknown as ServiceHealth;

    it('returns undefined before load', () => {
        expect(deriveServicesDetail(undefined)).toBeUndefined();
    });

    it('names unhealthy services', () => {
        expect(deriveServicesDetail([service('CMS', 'healthy'), service('IAM', 'unhealthy')])).toBe('IAM not healthy');
    });

    it('counts healthy services', () => {
        expect(deriveServicesDetail([service('CMS', 'healthy'), service('IAM', 'healthy')])).toBe('2 services healthy');
    });
});

describe('topAttention', () => {
    const item = (key: string, snoozed: boolean): OpsAttentionItem =>
        ({ key, fingerprint: key, system: 's', kind: 'k', severity: 'minor', title: key, detail: '', count: 1, first_seen: '2026-07-13T00:00:00Z', href: '/x', snoozed }) as OpsAttentionItem;

    it('filters snoozed and caps the list', () => {
        const items = [item('a', false), item('b', true), item('c', false), item('d', false), item('e', false), item('f', false), item('g', false), item('h', false)];
        const top = topAttention(items, 6);
        expect(top).toHaveLength(6);
        expect(top.map((i) => i.key)).toEqual(['a', 'c', 'd', 'e', 'f', 'g']);
    });

    it('handles undefined input', () => {
        expect(topAttention(undefined)).toEqual([]);
    });
});

const integrityRun = (overrides: Partial<FeedIntegrityRun>): FeedIntegrityRun =>
    ({
        id: 'r',
        trigger: 'scheduled',
        tier: 'light',
        status: 'completed',
        headline: 'all_clear',
        started_at: '2026-07-13T00:00:00Z',
        ...overrides,
    }) as FeedIntegrityRun;

const feedResult = (feed: string, score: number) =>
    ({ feed, variant: 'default', consumer_verdict: 'healthy', readiness_verdict: 'healthy', consumer_score: score, readiness_score: score, violations: 0, checked: 10 });

describe('feedScoreSeries', () => {
    it('returns empty for undefined or runs without results', () => {
        expect(feedScoreSeries(undefined)).toEqual([]);
        expect(feedScoreSeries([integrityRun({ feed_results: undefined })])).toEqual([]);
        expect(feedScoreSeries([integrityRun({ status: 'failed', feed_results: { pods: feedResult('pods', 90) } })])).toEqual([]);
    });

    it('uses the worst feed score and sorts oldest first', () => {
        const runs = [
            integrityRun({ id: 'b', started_at: '2026-07-13T02:00:00Z', feed_results: { pods: feedResult('pods', 95), news: feedResult('news', 70) } }),
            integrityRun({ id: 'a', started_at: '2026-07-13T01:00:00Z', feed_results: { pods: feedResult('pods', 88) } }),
        ];
        const series = feedScoreSeries(runs);
        expect(series.map((p) => p.count)).toEqual([88, 70]);
    });

    it('caps the series length', () => {
        const runs = Array.from({ length: 20 }, (_, i) =>
            integrityRun({ id: `${i}`, started_at: `2026-07-13T${String(i).padStart(2, '0')}:00:00Z`, feed_results: { pods: feedResult('pods', i) } }),
        );
        expect(feedScoreSeries(runs, 12)).toHaveLength(12);
    });
});

const experienceRun = (overrides: Partial<ExperienceRun>): ExperienceRun =>
    ({
        id: 'r',
        trigger: 'scheduled',
        status: 'completed',
        telemetry_fresh: true,
        surface_verdicts: null,
        summary: '',
        buckets_processed: 1,
        started_at: '2026-07-13T00:00:00Z',
        finished_at: null,
        error: '',
        error_class: '',
        ...overrides,
    }) as ExperienceRun;

describe('ruxHealthSeries', () => {
    it('skips runs with null or empty surface verdicts', () => {
        expect(ruxHealthSeries([experienceRun({})])).toEqual([]);
        expect(ruxHealthSeries([experienceRun({ surface_verdicts: {} })])).toEqual([]);
    });

    it('computes percent healthy per run', () => {
        const run = experienceRun({
            surface_verdicts: {
                pods: { verdict: 'healthy', slis: [] },
                news: { verdict: 'degraded', slis: [] },
            },
        });
        expect(ruxHealthSeries([run]).map((p) => p.count)).toEqual([50]);
    });
});

const rollup = (day: string, cost: number): AISpendRollup =>
    ({ id: 1, day, spend_class: 'llm', operation: 'op', provider: 'p', model: 'm', trigger_source: 't', events: 1, cost_usd: cost, avoided_cost_usd: 0, cache_hits: 0 }) as AISpendRollup;

describe('spendDailySeries', () => {
    it('returns empty for undefined input', () => {
        expect(spendDailySeries(undefined)).toEqual([]);
    });

    it('sums multiple rollup rows per day and sorts days ascending', () => {
        const series = spendDailySeries([rollup('2026-07-12', 1.5), rollup('2026-07-11', 2), rollup('2026-07-12', 0.25)]);
        expect(series.map((p) => p.day)).toEqual(['2026-07-11', '2026-07-12']);
        expect(series.map((p) => p.count)).toEqual([2, 1.75]);
    });

    it('keeps only the trailing window', () => {
        const rollups = Array.from({ length: 20 }, (_, i) => rollup(`2026-06-${String(i + 1).padStart(2, '0')}`, 1));
        expect(spendDailySeries(rollups, 14)).toHaveLength(14);
    });
});


describe('fleet evidence completeness', () => {
  it('keeps unknown and unconfigured lanes from becoming green', () => {
    const unknown = { state: 'unknown' } as OpsFleetStatus;
    const unconfigured = { state: 'unconfigured' } as OpsFleetStatus;
    expect(deriveFleetState([unknown]).state).toBe('unknown');
    expect(deriveFleetState([unconfigured, { state: 'idle' } as OpsFleetStatus]).state).toBe('unknown');
  });
  it('counts stuck runs as fleet failures', () => {
    expect(deriveFleetState([{ state: 'run_stuck' } as OpsFleetStatus])).toMatchObject({ state: 'stalled', stalled: 1 });
  });
});
