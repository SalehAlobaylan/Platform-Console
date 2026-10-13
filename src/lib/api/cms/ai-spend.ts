import { cmsClient } from '@/lib/api/client';

const BASE = '/admin/ai-spend';

export interface AISpendPolicy {
  compute_watch_limits?: Record<string, number>;
  enabled: boolean;
  aggregation_interval_minutes: number;
  forecast_horizon_days: number;
  spike_multiplier: number;
  retention_days: number;
  last_run_at?: string | null;
  paused_until?: string | null;
}
export interface AISpendBudget {
  updated_at?: string;
  id: number;
  scope: string;
  cap_usd?: number | null;
  warn_pct: number;
  hard_pct: number;
  spend_usd: number;
  reserved_usd: number;
  paused_until?: string | null;
  window_started_at?: string;
}
export interface AISpendRollup {
  human_actor_id?: string;
  id: number;
  day: string;
  spend_class: string;
  operation: string;
  provider: string;
  model: string;
  trigger_source: string;
  system_run_id?: string;
  events: number;
  cost_usd: number;
  avoided_cost_usd: number;
  cache_hits: number;
}
export interface AISpendRun {
  id: number;
  trigger: string;
  status: string;
  headline: string;
  events_folded: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}
export interface AISpendEpisode {
  evidence?: Record<string, unknown>;
  attribution?: Record<string, unknown>;
  close_reason?: string;
  id: number;
  kind: string;
  scope?: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
}
export interface AISpendEvidence {
  hygiene?: Record<string, unknown>;
  ledger_health?: string;
  legacy_unallocated_present?: boolean;
  emitters?: AISpendEmitter[];
  event_count: number;
  rollup_count: number;
  run_count: number;
  last_event_at?: string | null;
  last_rollup_at?: string | null;
}
export interface AISpendTotals {
  cost_usd: number;
  avoided_cost_usd: number;
  avoided_estimated_usd: number;
  events: number;
  cache_hits: number;
  estimated_events: number;
  unpriced_events: number;
  unknown_events: number;
  usage_unavailable_events: number;
}
export interface AISpendDimension {
  avoided_cost_usd?: number;
  avoided_estimated_usd?: number;
  key: string;
  cost_usd: number;
  events: number;
}
export interface AISpendEmitter {
  process_id: string;
  source_service: string;
  updated_at: string;
  emitted: number;
  accepted: number;
  dropped: number;
  unobservable: number;
}
export interface AISpendAllowance {
  reporting_lag_seconds?: number;
  tolerance_status?: string;
  tolerance_usd?: number | null;
  allowed: boolean;
  verdict: string;
  reason: string;
  remaining_usd?: number | null;
  ledger_health: string;
  margin_usd?: number;
}
export interface AISpendInvoice {
  id: number;
  provider: string;
  month: string;
  amount_usd: number;
  note: string;
  ledger_usd: number;
  delta_usd: number;
}
export interface AIPrice {
  id: number;
  spend_class: string;
  provider: string;
  model_pattern: string;
  input_usd_per_1m: number;
  output_usd_per_1m: number;
  unit_usd: number;
  effective_from: string;
  note?: string;
}
export interface AISpendEvent extends AISpendRollup {
  event_id: string;
  occurred_at: string;
  units: Record<string, number>;
  cached: boolean;
  estimated: boolean;
  unpriced: boolean;
  over_cap_human: boolean;
}
export interface AISpendPeriod {
  human_actor_id?: string;
  status?: string;
  trigger?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
  spend_class?: string;
  operation?: string;
  provider?: string;
  model?: string;
  trigger_source?: string;
  system_run_id?: string;
}
export interface AISpendForecast {
  status: 'estimate' | 'insufficient_history';
  history_days: number;
  horizon_days: number;
  daily_pace_usd?: number;
  projected_window_usd?: number;
  horizon_spend_usd?: number;
  cap_reached_at?: string;
  as_of: string;
  method: string;
}
export interface AISpendStatus {
  daily_by_class?: { day: string; spend_class: string; cost_usd: number }[];
  item_economics?: {
    operation: string;
    items: number;
    cost_usd: number;
    captured_events: number;
    total_events: number;
  }[];
  budget_verdicts?: Record<
    string,
    { verdict: string; evidence: { enforcement: string } }
  >;
  compute_watch?: {
    spend_class: string;
    unit: string;
    used: number;
    daily_threshold: number;
    status: string;
    day: string;
  }[];
  headline?: string;
  forecasts?: Record<string, AISpendForecast>;
  totals?: AISpendTotals;
  breakdown?: Record<string, AISpendDimension[]>;
  units?: {
    spend_class: string;
    operation: string;
    key: string;
    value: number;
  }[];
  allowance?: AISpendAllowance;
  latest_run?: AISpendRun;
  stt_owner?: {
    drift_status?: string;
    drift?: Record<string, unknown>;
    configured: boolean;
    cap_usd: number;
    spend_usd: number;
    reserved_usd: number;
    url: string;
  };
  coverage?: Record<string, string>[];
  storage?: {
    bill_usd?: number | null;
    bill_status?: string;
    url: string;
    status: string;
    month?: string;
    as_of?: string;
    quota_bytes?: number;
    class_a?: { used: number; budget: number; status: string };
    class_b?: { used: number; budget: number; status: string };
  };
  policy: AISpendPolicy;
  budgets: AISpendBudget[];
  episodes: AISpendEpisode[];
  evidence: AISpendEvidence;
}

type LegacyRecord = Record<string, unknown>;

const pick = (row: LegacyRecord, canonical: string, legacy: string) =>
  row[canonical] ?? row[legacy];
const asNumber = (value: unknown) =>
  typeof value === 'number' ? value : Number(value ?? 0);
const asString = (value: unknown) => (typeof value === 'string' ? value : '');

export function normalizeAISpendPolicy(
  row: LegacyRecord | undefined
): AISpendPolicy {
  return {
    compute_watch_limits: row?.compute_watch_limits as
      | Record<string, number>
      | undefined,
    enabled: Boolean(pick(row ?? {}, 'enabled', 'Enabled')),
    aggregation_interval_minutes: asNumber(
      pick(
        row ?? {},
        'aggregation_interval_minutes',
        'AggregationIntervalMinutes'
      )
    ),
    forecast_horizon_days: asNumber(
      pick(row ?? {}, 'forecast_horizon_days', 'ForecastHorizonDays')
    ),
    spike_multiplier: asNumber(
      pick(row ?? {}, 'spike_multiplier', 'SpikeMultiplier')
    ),
    retention_days: asNumber(
      pick(row ?? {}, 'retention_days', 'RetentionDays')
    ),
    paused_until:
      (pick(row ?? {}, 'paused_until', 'PausedUntil') as
        | string
        | null
        | undefined) ?? null,
    last_run_at:
      (pick(row ?? {}, 'last_run_at', 'LastRunAt') as
        | string
        | null
        | undefined) ?? null,
  };
}

export function normalizeAISpendBudget(row: LegacyRecord): AISpendBudget {
  return {
    id: asNumber(pick(row, 'id', 'ID')),
    scope: asString(pick(row, 'scope', 'Scope')),
    window_started_at: asString(
      pick(row, 'window_started_at', 'WindowStartedAt')
    ),
    updated_at: asString(pick(row, 'updated_at', 'UpdatedAt')),
    cap_usd:
      (pick(row, 'cap_usd', 'CapUSD') as number | null | undefined) ?? null,
    warn_pct: asNumber(pick(row, 'warn_pct', 'WarnPct')),
    hard_pct: asNumber(pick(row, 'hard_pct', 'HardPct')),
    spend_usd: asNumber(pick(row, 'spend_usd', 'SpendUSD')),
    reserved_usd: asNumber(pick(row, 'reserved_usd', 'ReservedUSD')),
    paused_until:
      (pick(row, 'paused_until', 'PausedUntil') as string | null | undefined) ??
      null,
  };
}

export function normalizeAISpendRollup(row: LegacyRecord): AISpendRollup {
  return {
    human_actor_id: asString(pick(row, 'human_actor_id', 'HumanActorID')),
    id: asNumber(pick(row, 'id', 'ID')),
    day: asString(pick(row, 'day', 'Day')),
    spend_class: asString(pick(row, 'spend_class', 'SpendClass')),
    operation: asString(pick(row, 'operation', 'Operation')),
    provider: asString(pick(row, 'provider', 'Provider')),
    model: asString(pick(row, 'model', 'Model')),
    trigger_source: asString(pick(row, 'trigger_source', 'TriggerSource')),
    system_run_id: asString(pick(row, 'system_run_id', 'SystemRunID')),
    events: asNumber(pick(row, 'events', 'Events')),
    cost_usd: asNumber(pick(row, 'cost_usd', 'CostUSD')),
    avoided_cost_usd: asNumber(pick(row, 'avoided_cost_usd', 'AvoidedCostUSD')),
    cache_hits: asNumber(pick(row, 'cache_hits', 'CacheHits')),
  };
}

export function normalizeAISpendRun(row: LegacyRecord): AISpendRun {
  return {
    id: asNumber(pick(row, 'id', 'ID')),
    trigger: asString(pick(row, 'trigger', 'Trigger')),
    status: asString(pick(row, 'status', 'Status')),
    headline: asString(pick(row, 'headline', 'Headline')),
    events_folded: asNumber(pick(row, 'events_folded', 'EventsFolded')),
    started_at: asString(pick(row, 'started_at', 'StartedAt')),
    completed_at:
      (pick(row, 'completed_at', 'CompletedAt') as string | null | undefined) ??
      undefined,
    error:
      (pick(row, 'error', 'Error') as string | null | undefined) ?? undefined,
  };
}

const list = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export function normalizeAISpendStatus(row: LegacyRecord): AISpendStatus {
  const rawEvidence = (row.evidence ?? {}) as LegacyRecord;
  const rawBudgets = (row.budgets ?? row.Budgets) as unknown;
  const rawEpisodes = (row.episodes ?? row.Episodes) as unknown;
  return {
    headline: row.headline as string | undefined,
    daily_by_class: list<NonNullable<AISpendStatus['daily_by_class']>[number]>(
      row.daily_by_class
    ),
    item_economics: list<NonNullable<AISpendStatus['item_economics']>[number]>(
      row.item_economics
    ),
    budget_verdicts: row.budget_verdicts as AISpendStatus['budget_verdicts'],
    compute_watch: list<NonNullable<AISpendStatus['compute_watch']>[number]>(
      row.compute_watch
    ),
    totals: row.totals as AISpendTotals | undefined,
    forecasts: row.forecasts as AISpendStatus['forecasts'],
    breakdown: Object.fromEntries(
      Object.entries((row.breakdown ?? {}) as Record<string, unknown>).map(
        ([key, value]) => [key, list<AISpendDimension>(value)]
      )
    ),
    units: list<NonNullable<AISpendStatus['units']>[number]>(row.units),
    allowance: row.allowance as AISpendAllowance | undefined,
    coverage: list<NonNullable<AISpendStatus['coverage']>[number]>(
      row.coverage
    ),
    latest_run: row.latest_run as AISpendRun | undefined,
    stt_owner: row.stt_owner as AISpendStatus['stt_owner'],
    storage: row.storage as AISpendStatus['storage'],
    policy: normalizeAISpendPolicy(
      (row.policy ?? row.Policy) as LegacyRecord | undefined
    ),
    budgets: Array.isArray(rawBudgets)
      ? rawBudgets.map((item) => normalizeAISpendBudget(item as LegacyRecord))
      : [],
    episodes: Array.isArray(rawEpisodes)
      ? rawEpisodes.map((item) => item as AISpendEpisode)
      : [],
    evidence: {
      hygiene: rawEvidence.hygiene as AISpendEvidence['hygiene'],
      ledger_health: rawEvidence.ledger_health as string | undefined,
      legacy_unallocated_present: Boolean(
        rawEvidence.legacy_unallocated_present
      ),
      emitters: list<AISpendEmitter>(rawEvidence.emitters),
      event_count: asNumber(pick(rawEvidence, 'event_count', 'EventCount')),
      rollup_count: asNumber(pick(rawEvidence, 'rollup_count', 'RollupCount')),
      run_count: asNumber(pick(rawEvidence, 'run_count', 'RunCount')),
      last_event_at:
        (pick(rawEvidence, 'last_event_at', 'LastEventAt') as
          | string
          | null
          | undefined) ?? null,
      last_rollup_at:
        (pick(rawEvidence, 'last_rollup_at', 'LastRollupAt') as
          | string
          | null
          | undefined) ?? null,
    },
  };
}

const query = (period: AISpendPeriod = {}) => {
  const params = new URLSearchParams();
  Object.entries(period).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
};
export const getAISpendStatus = (period: AISpendPeriod = {}) =>
  cmsClient
    .get<LegacyRecord>(`${BASE}/status${query(period)}`)
    .then(normalizeAISpendStatus);
export const getAISpendRollups = (period: AISpendPeriod = {}) =>
  cmsClient
    .get<{
      rollups?: LegacyRecord[];
      total?: number;
    }>(`${BASE}/rollups${query(period)}`)
    .then((r) => ({
      rollups: (r.rollups ?? []).map(normalizeAISpendRollup),
      total: r.total ?? 0,
    }));
export const getAISpendRuns = (period: AISpendPeriod = {}) =>
  cmsClient
    .get<{
      runs?: LegacyRecord[];
      total?: number;
    }>(`${BASE}/runs${query(period)}`)
    .then((r) => ({
      runs: (r.runs ?? []).map(normalizeAISpendRun),
      total: r.total ?? r.runs?.length ?? 0,
    }));
export const updateAISpendPolicy = (policy: Partial<AISpendPolicy>) =>
  cmsClient
    .put<LegacyRecord>(`${BASE}/policy`, policy)
    .then(normalizeAISpendPolicy);
export const runAISpendGovernor = () =>
  cmsClient.post<LegacyRecord>(`${BASE}/run`, {}).then((row) => {
    const run = normalizeAISpendRun(row);
    if (run.status !== 'completed')
      throw new Error(run.error || 'Ledger run did not complete');
    return run;
  });
export const saveAISpendBudget = (budget: Partial<AISpendBudget>) =>
  cmsClient.put<AISpendBudget>(`${BASE}/budgets`, budget);
export const getAIPrices = () =>
  cmsClient
    .get<{ prices: AIPrice[] | null }>(`${BASE}/price-book`)
    .then((r) => ({ prices: list<AIPrice>(r.prices) }));
export const appendAIPrice = (price: Omit<AIPrice, 'id'>) =>
  cmsClient.post<AIPrice>(`${BASE}/price-book`, price);
export const getAISpendEvents = (period: AISpendPeriod = {}) =>
  cmsClient
    .get<{
      events: AISpendEvent[];
      total: number;
    }>(`${BASE}/events${query(period)}`)
    .then((r) => ({ ...r, events: list<AISpendEvent>(r.events) }));
export const getAISpendEpisodes = () =>
  cmsClient
    .get<{ episodes: AISpendEpisode[] | null }>(`${BASE}/episodes`)
    .then((r) => ({ episodes: list<AISpendEpisode>(r.episodes) }));
export const closeAISpendEpisode = (
  id: number,
  reason: string,
  false_positive: boolean
) => cmsClient.post(`${BASE}/episodes/${id}/close`, { reason, false_positive });
export const getAISpendInvoices = () =>
  cmsClient
    .get<{ invoices: AISpendInvoice[] | null }>(`${BASE}/invoices`)
    .then((r) => ({ invoices: list<AISpendInvoice>(r.invoices) }));
export const saveAISpendInvoice = (invoice: {
  provider: string;
  month: string;
  amount_usd: number;
  note: string;
}) => cmsClient.put(`${BASE}/invoices`, invoice);
export const previewAISpendOverride = (trigger: string) =>
  cmsClient.get<AISpendAllowance>(
    `${BASE}/override/preview?trigger_source=${encodeURIComponent(trigger)}`
  );
export const confirmAISpendOverride = (trigger_source: string) =>
  cmsClient.post<{ id: string; expires_at: string }>(
    `${BASE}/override/confirm`,
    { trigger_source, confirm: true }
  );
export const getAISpendByRun = (period: AISpendPeriod = {}) =>
  cmsClient
    .get<{
      runs: {
        trigger_source: string;
        system_run_id: string;
        cost_usd: number;
        events: number;
      }[];
    }>(`${BASE}/by-run${query(period)}`)
    .then((r) => ({ ...r, runs: r.runs ?? [] }));
export const getAISpendRun = (id: number) =>
  cmsClient.get<
    AISpendRun & {
      watermarks_advanced?: unknown;
      budget_verdicts?: unknown;
      hygiene_counters?: unknown;
    }
  >(`${BASE}/runs/${id}`);

export async function executeConfirmedAISpendWorkflow(
  trigger: string,
  grant: string,
  subject: string
) {
  const paths: Record<string, string> = {
    manual_story_label: '/admin/stories/label-batch',
    manual_story_digest: '/admin/stories/summary-batch',
    manual_chapter_planning: `/admin/content/${encodeURIComponent(subject)}/chapters/generate`,
  };
  if (!paths[trigger] || (trigger === 'manual_chapter_planning' && !subject))
    throw new Error('Choose a supported workflow and its content ID');
  return cmsClient.post(
    paths[trigger],
    { limit: 1 },
    { headers: { 'X-AI-Spend-Override': grant } }
  );
}

export const getAISpendRunSpend = (id: string, offset = 0) =>
  cmsClient.get<Record<string, unknown>>(
    `/admin/ai-spend/by-run/${encodeURIComponent(id)}?limit=100&offset=${offset}`
  );
