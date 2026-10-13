'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  FileSearch,
  Pause,
  Pencil,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  AISpendBudget,
  AISpendEpisode,
  AISpendForecast,
  AISpendStatus,
} from '@/lib/api/cms/ai-spend';

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n !== 0 && Math.abs(n) < 0.01 ? 7 : 3,
  }).format(n);
export const timeLabel = (s?: string | null) =>
  s ? new Date(s).toLocaleString() : 'Not available';
export const names: Record<string, string> = {
  llm: 'Language models',
  stt_api: 'Paid transcription',
  embedding: 'Text embeddings',
  rerank: 'Search reranking',
  image_embed: 'Image embeddings',
  stt_local: 'Local transcription',
  other: 'Other activity',
  preferences_autopilot: 'Preferences',
  studio_autopilot: 'Media Studio',
  operator: 'Wahb Operator',
  ingest_ai: 'Content enrichment',
  content_pipeline: 'Content pipeline',
  media_atomization: 'Media chapters',
  source_intelligence: 'Source intelligence',
  embedding_campaign: 'Embedding campaigns',
  retrieval: 'Search & retrieval',
  manual_story_digest: 'Manual digests',
  manual_story_label: 'Manual labels',
  manual_chapter_planning: 'Manual chapters',
  serving_news_summary: 'News summaries',
  unknown: 'Unattributed activity',
  translate: 'Translation',
  topic_digest: 'Story digests',
  chapter_proposal: 'Chapter proposals',
  chapters_generate: 'Chapter planning',
  topic_label: 'Topic labels',
  tag_extract: 'Tag extraction',
  classify_source: 'Source classification',
  operator_reason: 'Operator reasoning',
  stt_settlement: 'Transcription settlement',
  within: 'Within limit',
  drift_detected: 'Ledger mismatch',
  in_sync: 'In sync',
  watching: 'Above watch threshold',
  allowance: 'LLM allowance',
  budget_capped: 'Budget limit reached',
  governor_disabled: 'Monitoring only',
  policy_paused: 'Governance paused',
  class_paused: 'LLM budget paused',
  within_budget: 'Within budget',
  no_budget: 'No budget configured',
  uncapped: 'No cap',
  spend_class: 'Spend class',
  trigger_source: 'Workflow',
  human_actor_id: 'Human actor',
  system_run_id: 'Run',
  warning: 'Near limit',
  bounded_stop: 'Limit reached',
  over_pace: 'Above expected pace',
  paused: 'Paused',
  observe: 'Monitoring only',
  healthy: 'Up to date',
  stale: 'Update overdue',
  no_evidence: 'No evidence yet',
  untrusted: 'Incomplete evidence',
  lagging: 'Receipts delayed',
  unavailable: 'Unavailable',
  degraded: 'Accounting needs review',
  candidate: 'Watching',
  open: 'Needs review',
  recovering: 'Recovering',
  resolved: 'Resolved',
  flapping: 'Recurring · review required',
  spike: 'Unusual spend increase',
  stt_drift: 'Transcription ledger mismatch',
  compute_volume: 'Compute demand increased',
  unknown_attribution: 'Activity needs attribution',
  unpriced_events: 'Model price is missing',
  metering_loss: 'Spend receipts were lost',
  untrusted_ledger: 'Spend evidence is incomplete',
  restart_uncertainty: 'Emitter stopped without final accounting',
};
export const label = (value?: string) =>
  value ? (names[value] ?? value.replaceAll('_', ' ')) : 'Unavailable';
export const scopeLabel = (scope: string) =>
  scope === 'class:llm'
    ? 'Language model budget'
    : scope === 'platform'
      ? 'All AI activity'
      : scope.startsWith('system:')
        ? label(scope.slice(7))
        : scope;
const classKeys = [
  'llm',
  'stt_api',
  'embedding',
  'rerank',
  'image_embed',
  'stt_local',
  'other',
];
const colors = [
  '#355be8',
  '#c78729',
  '#16a085',
  '#9270c3',
  '#bd5c87',
  '#4b99a3',
  '#8a909c',
];

export function StatusPill({
  value,
  children,
}: {
  value?: string;
  children?: React.ReactNode;
}) {
  const tone = ['healthy', 'within', 'completed', 'resolved'].includes(
    value ?? ''
  )
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : ['untrusted', 'bounded_stop', 'failed', 'flapping', 'degraded'].includes(
          value ?? ''
        )
      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
      : [
            'warning',
            'over_pace',
            'stale',
            'lagging',
            'open',
            'recovering',
            'paused',
          ].includes(value ?? '')
        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? label(value)}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border bg-card ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function BudgetSummary({
  budget,
  forecast,
  verdict,
  action,
}: {
  budget: AISpendBudget;
  forecast?: AISpendForecast;
  verdict?: string;
  action?: React.ReactNode;
}) {
  const used = budget.spend_usd + budget.reserved_usd;
  const percent =
    budget.cap_usd == null
      ? null
      : budget.cap_usd === 0
        ? used > 0
          ? 100
          : 0
        : Math.min(100, (used / budget.cap_usd) * 100);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{scopeLabel(budget.scope)}</h3>
        <StatusPill value={verdict} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {money(budget.spend_usd)}
        </span>
        <span className="text-xs text-muted-foreground">
          {budget.cap_usd == null
            ? 'no cap set'
            : `of ${money(budget.cap_usd)} limit`}
        </span>
      </div>
      {percent != null && (
        <>
          <div
            role="meter"
            aria-label={`${scopeLabel(budget.scope)} used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full ${verdict === 'bounded_stop' ? 'bg-rose-500' : verdict === 'warning' ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{money(budget.reserved_usd)} reserved</span>
            <span>
              {money(Math.max(0, (budget.cap_usd ?? 0) - used))} available
            </span>
          </div>
        </>
      )}
      <div className="flex items-start justify-between gap-3 border-t pt-3 text-xs">
        <div className="space-y-1 text-muted-foreground">
          <p>
            {budget.scope === 'class:llm'
              ? 'Limit for new autonomous paid LLM work'
              : 'Advisory · does not stop work'}
          </p>
          <p>
            {forecast?.status === 'estimate'
              ? `${money(forecast.projected_window_usd ?? 0)} forecast at window end`
              : 'Forecast needs 3 complete days of spend'}
          </p>
          {forecast?.status === 'estimate' && (
            <details>
              <summary className="cursor-pointer text-[11px] underline decoration-dotted">
                Forecast details
              </summary>
              <p className="mt-2">
                {money(forecast.horizon_spend_usd ?? 0)} expected over the next{' '}
                {forecast.horizon_days} days · based on {forecast.history_days}{' '}
                complete days.
                {forecast.cap_reached_at
                  ? ` Limit expected ${timeLabel(forecast.cap_reached_at)}.`
                  : ''}
              </p>
            </details>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

export function BudgetEditor({
  budget,
  forecast,
  verdict,
  disabled,
  error,
  save,
}: {
  budget: AISpendBudget;
  forecast?: AISpendForecast;
  verdict?: string;
  disabled: boolean;
  error?: string;
  save: (value: Partial<AISpendBudget>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [cap, setCap] = useState(
    budget.cap_usd == null ? '' : String(budget.cap_usd)
  );
  const [warn, setWarn] = useState(String(budget.warn_pct));
  const [hard, setHard] = useState(String(budget.hard_pct));
  const paused = Boolean(
    budget.paused_until && new Date(budget.paused_until) > new Date()
  );
  return (
    <div className="rounded-xl border bg-card p-5">
      <BudgetSummary
        budget={budget}
        forecast={forecast}
        verdict={paused ? 'paused' : verdict}
        action={
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {disabled ? 'View' : 'Edit'}
            <span className="sr-only"> {scopeLabel(budget.scope)}</span>
          </Button>
        }
      />
      {paused && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Paused until {timeLabel(budget.paused_until)}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{scopeLabel(budget.scope)}</DialogTitle>
            <DialogDescription>
              {budget.scope === 'class:llm'
                ? 'This limit controls new autonomous paid language-model calls.'
                : 'This limit raises attention; it does not stop this workflow.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaveFailed(false);
              if (
                await save({
                  scope: budget.scope,
                  cap_usd: cap === '' ? null : Number(cap),
                  warn_pct: Number(warn),
                  hard_pct: Number(hard),
                })
              )
                setOpen(false);
              else setSaveFailed(true);
            }}
          >
            {saveFailed && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
              >
                {error ||
                  'Unable to save your budget. Your changes are kept; try again.'}
              </p>
            )}
            <label className="block text-sm font-medium">
              Budget limit (USD)
              <Input
                className="mt-2"
                aria-label={`${budget.scope} cap`}
                type="number"
                min="0"
                step="any"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                disabled={disabled}
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Leave blank for no cap. A zero-dollar LLM cap stops new
                autonomous paid calls.
              </span>
            </label>
            <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
              {money(budget.spend_usd)} already recorded in this window. Editing
              the limit preserves this spend and the window that began{' '}
              {timeLabel(budget.window_started_at)}.
            </p>
            <details>
              <summary className="cursor-pointer text-sm">
                Warning and stop thresholds
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs">
                  Warn at (%)
                  <Input
                    type="number"
                    min="1"
                    max={Number(hard) || 100}
                    required
                    value={warn}
                    onChange={(e) => setWarn(e.target.value)}
                    disabled={disabled}
                  />
                </label>
                <label className="text-xs">
                  Stop at (%)
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={hard}
                    onChange={(e) => setHard(e.target.value)}
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {budget.scope === 'class:llm' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={async () => {
                    setSaveFailed(false);
                    if (
                      await save({
                        scope: budget.scope,
                        paused_until: paused
                          ? null
                          : new Date(Date.now() + 3600000).toISOString(),
                      })
                    )
                      setOpen(false);
                    else setSaveFailed(true);
                  }}
                >
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  {paused ? 'Resume LLM' : 'Pause LLM for 1 hour'}
                </Button>
              ) : (
                <span />
              )}
              <Button disabled={disabled}>Save budget</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EconomicsOverview({
  status: s,
  onNavigate,
  onFilter,
}: {
  status: AISpendStatus;
  onNavigate: (tab: string) => void;
  onFilter: (key: 'trigger_source' | 'spend_class', value: string) => void;
}) {
  const totals = s.totals;
  const primary = s.budgets.find((b) => b.scope === 'class:llm');
  const forecast = primary ? s.forecasts?.[primary.scope] : undefined;
  const episodes = s.episodes.filter((e) =>
    ['open', 'recovering', 'flapping'].includes(e.status)
  );
  const advisoryWarnings = Object.entries(s.budget_verdicts ?? {}).filter(
    ([scope, verdict]) =>
      scope !== 'class:llm' &&
      ['warning', 'over_pace', 'bounded_stop'].includes(verdict.verdict)
  );
  const healthy = s.evidence.ledger_health === 'healthy';
  const paused = Boolean(
    s.policy.paused_until && new Date(s.policy.paused_until) > new Date()
  );
  const headline = !healthy
    ? 'Check spend evidence'
    : paused
      ? 'Autonomous LLM work is paused'
      : !s.policy.enabled
        ? 'Monitoring spend. Limits are not enforced.'
        : s.allowance?.allowed === false
          ? 'New autonomous LLM work is stopped'
          : s.allowance?.allowed === true
            ? 'Autonomous LLM work is allowed'
            : 'LLM allowance is unavailable';
  const hint = !healthy
    ? 'Totals may be incomplete. Review delivery and pricing before making budget decisions.'
    : paused
      ? 'Receipts, local compute and owner settlements continue.'
      : !s.policy.enabled
        ? 'Review budget limits and evidence before enabling governance.'
        : 'STT keeps its own admission rules. Existing work is never cancelled.';
  const daily = new Map<string, Record<string, string | number>>();
  for (const cell of s.daily_by_class ?? []) {
    const key = classKeys.includes(cell.spend_class)
      ? cell.spend_class
      : 'other';
    const row = daily.get(cell.day) ?? { day: cell.day };
    row[key] = Number(row[key] ?? 0) + cell.cost_usd;
    daily.set(cell.day, row);
  }
  for (const cell of s.breakdown?.day ?? []) {
    const row = daily.get(cell.key) ?? { day: cell.key, other: cell.cost_usd };
    row.measured_savings =
      (cell.avoided_cost_usd ?? 0) - (cell.avoided_estimated_usd ?? 0);
    row.estimated_savings = cell.avoided_estimated_usd ?? 0;
    daily.set(cell.key, row);
  }
  const drivers = [...(s.breakdown?.trigger_source ?? [])]
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 5);
  const paidClasses = [...(s.breakdown?.spend_class ?? [])].sort(
    (a, b) => b.cost_usd - a.cost_usd
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card md:grid-cols-4 md:divide-y-0">
        {[
          [
            'Recorded AI spend',
            totals ? money(totals.cost_usd) : 'Unavailable',
            'Selected period · all captured classes',
          ],
          [
            'Daily burn',
            forecast?.status === 'estimate'
              ? money(forecast.daily_pace_usd ?? 0)
              : 'Not enough history',
            'LLM budget · complete-day average',
          ],
          [
            'Cache savings',
            totals ? money(totals.avoided_cost_usd) : 'Unavailable',
            totals
              ? `${money(totals.avoided_estimated_usd)} estimated · remainder measured`
              : 'Savings evidence unavailable',
          ],
          [
            'Metered operations',
            totals ? totals.events.toLocaleString() : 'Unavailable',
            'Includes cache hits and local compute',
          ],
        ].map(([title, value, description]) => (
          <div className="min-w-0 p-4 md:p-5" key={title}>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-3 break-words text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">
              {value}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4 ${!healthy ? 'border-amber-500/30 bg-amber-500/5' : 'bg-muted/30'}`}
      >
        <div className="flex items-start gap-3">
          {!healthy ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">{headline}</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {hint}
            </p>
            {advisoryWarnings.length > 0 && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {advisoryWarnings
                  .map(
                    ([scope, verdict]) =>
                      `${scopeLabel(scope)}: ${label(verdict.verdict)}`
                  )
                  .join(' · ')}
                . Advisory limits raise attention; they do not stop work.
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNavigate(!healthy ? 'Debug' : 'Budgets')}
        >
          {!healthy ? 'Review evidence' : 'Review controls'}
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Spend over time"
          description="Recorded spend by class. Cache savings are shown separately."
          action={
            <span className="text-xs text-muted-foreground">USD · UTC</span>
          }
        >
          <div
            className="h-[240px] w-full"
            aria-label="Daily AI spend and cache savings chart"
          >
            {daily.size > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={[...daily.values()].sort((a, b) =>
                    String(a.day).localeCompare(String(b.day))
                  )}
                  margin={{ left: -18, right: 2, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) =>
                      new Date(
                        String(v).slice(0, 10) + 'T00:00:00Z'
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                    minTickGap={35}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v, name) => [money(Number(v)), name]}
                  />
                  {classKeys.map((key, i) => (
                    <Bar
                      key={key}
                      name={label(key)}
                      dataKey={key}
                      stackId="spend"
                      fill={colors[i]}
                      maxBarSize={26}
                      isAnimationActive={false}
                    />
                  ))}
                  <Line
                    type="monotone"
                    name="Measured cache savings"
                    dataKey="measured_savings"
                    stroke="#16a085"
                    dot={false}
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    name="Estimated cache savings"
                    dataKey="estimated_savings"
                    stroke="#8a909c"
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
                <Wallet className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm font-medium">
                  No spend recorded in this period
                </p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Try another date range or clear filters. Provider and workflow
                  details appear as receipts arrive.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            {paidClasses.map((cell) => (
              <button
                key={cell.key}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
                onClick={() => onFilter('spend_class', cell.key)}
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{
                    background:
                      colors[Math.max(0, classKeys.indexOf(cell.key))],
                  }}
                />
                {label(cell.key)}
              </button>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-emerald-600" />
              Measured cache savings
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-slate-400" />
              Estimated cache savings
            </span>
          </div>
        </Panel>
        <Panel
          title="LLM budget"
          description="Current anchored window · independent of report filters"
          action={<Wallet className="h-4 w-4 text-muted-foreground" />}
        >
          {primary ? (
            <BudgetSummary
              budget={primary}
              forecast={forecast}
              verdict={
                primary.paused_until &&
                new Date(primary.paused_until) > new Date()
                  ? 'paused'
                  : s.budget_verdicts?.[primary.scope]?.verdict
              }
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate('Budgets')}
                >
                  Manage
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xl font-semibold">No limit set</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Set a language-model budget to make autonomous paid work
                accountable. Governance starts in monitoring mode.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate('Budgets')}
              >
                Set up a budget
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="What is driving spend?"
          description="Click a workflow to investigate its recorded activity."
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('Usage')}
            >
              All activity
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          }
        >
          {drivers.length ? (
            drivers.map((d, i) => (
              <button
                key={d.key}
                onClick={() => onFilter('trigger_source', d.key)}
                className="group flex w-full items-center gap-3 border-b py-3 text-left first:pt-0 last:border-0 last:pb-0"
              >
                <span className="w-5 text-xs tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label(d.key)}</p>
                  <div className="mt-2 h-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/65"
                      style={{
                        width: `${Math.min(100, totals && totals.cost_usd > 0 ? Math.max(0, (d.cost_usd / totals.cost_usd) * 100) : 0)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">
                    {money(d.cost_usd)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.events.toLocaleString()} operations
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Workflow attribution will appear with metered activity.
            </p>
          )}
        </Panel>
        <Panel
          title="Needs your attention"
          description="Confirmed issues and the next useful action."
          action={
            <StatusPill value={episodes.length ? 'open' : 'resolved'}>
              {episodes.length
                ? `${episodes.length} to review`
                : 'No confirmed issues'}
            </StatusPill>
          }
        >
          {episodes.length ? (
            <div className="space-y-3">
              {episodes.slice(0, 2).map((e) => (
                <button
                  className="block w-full rounded-lg border p-3 text-left hover:bg-muted/40"
                  key={e.id}
                  onClick={() => onNavigate('Episodes')}
                >
                  <p className="text-sm font-medium">{label(e.kind)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {String(
                      e.evidence?.recommended_action ??
                        'Review the evidence and attributed activity.'
                    )}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 py-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">No confirmed spend issues</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {healthy
                    ? 'Keep watching cost drivers and budget pace.'
                    : 'Data quality still needs review before totals can be trusted.'}
                </p>
                <Button
                  className="mt-3 h-auto p-0 text-xs"
                  variant="link"
                  onClick={() => onNavigate('Episodes')}
                >
                  View issue history
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <button
          onClick={() => onNavigate('Savings & compute')}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted/30"
        >
          <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Efficiency & local compute</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Savings, unit costs and capacity watches
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <Link
          href={s.stt_owner?.url ?? '/platform/media'}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"
        >
          <FileSearch className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Transcription · owner managed</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {s.stt_owner?.configured
                ? `${money(s.stt_owner.spend_usd)} spent · ${label(s.stt_owner.drift_status)}`
                : 'Owner budget evidence unavailable'}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
        <Link
          href={s.storage?.url ?? '/platform/storage'}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"
        >
          <Database className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Storage · owner managed</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {s.storage?.bill_usd == null
                ? 'Dollar bill unavailable · view usage'
                : money(s.storage.bill_usd)}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const rows = (value: unknown) =>
  Array.isArray(value) ? value.map(record) : [];

export function RunInspector({
  detail,
  onClose,
  offset,
  total,
  onPage,
  pending,
  error,
}: {
  detail: unknown;
  onClose: () => void;
  offset: number;
  total: number;
  onPage?: (offset: number) => void;
  pending: boolean;
  error?: string;
}) {
  const data = record(detail);
  const amounts = record(data.totals);
  const spend = rows(data.rollups);
  const owners = rows(data.owner_references);
  const humans = rows(data.human_confirmations);
  const hygiene = record(data.hygiene_counters);
  return (
    <Dialog
      open={detail != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>
            {Boolean(data.system_run_id)
              ? 'Workflow cost investigation'
              : 'Accounting run'}
          </DialogTitle>
          <DialogDescription className="break-all">
            {String(data.system_run_id ?? `Run ${data.id ?? ''}`)}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        {Boolean(data.system_run_id) ? (
          <>
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total recorded cost
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {money(Number(amounts.cost_usd ?? 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Metered operations
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {Number(amounts.events ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            {owners.map((owner, i) => {
              const metadata = record(owner.metadata);
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">
                      {label(String(owner.trigger_source ?? 'unknown'))}
                    </strong>
                    <StatusPill
                      value={String(
                        metadata.status ?? metadata.state ?? owner.status
                      )}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {owner.status === 'matched'
                      ? `Initiated by ${metadata.actor_id ?? metadata.created_by ?? 'unavailable actor'}`
                      : 'Owner run evidence is unavailable'}
                  </p>
                  {typeof owner.owner_url === 'string' &&
                    owner.owner_url.startsWith('/platform/') && (
                      <Link
                        className="mt-2 inline-flex items-center text-xs text-primary underline"
                        href={owner.owner_url}
                      >
                        Open owning workflow
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    )}
                </div>
              );
            })}
            <h3 className="text-sm font-medium">Cost breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 font-medium">Operation / model</th>
                    <th className="pb-2 font-medium">Actor</th>
                    <th className="pb-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {spend.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3">
                        <p>{label(String(r.operation ?? ''))}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {String(r.provider ?? '')} · {String(r.model ?? '')}
                        </p>
                      </td>
                      <td className="max-w-[120px] break-all py-3 text-muted-foreground">
                        {String(r.human_actor_id || 'Not captured')}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {money(Number(r.cost_usd ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {humans.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Human confirmations</h3>
                {humans.map((h, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-medium">
                      {String(h.human_actor_id ?? 'Actor unavailable')}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {timeLabel(
                        typeof h.occurred_at === 'string'
                          ? h.occurred_at
                          : undefined
                      )}{' '}
                      · Reviewed state:{' '}
                      {label(
                        String(
                          record(record(h.admission_snapshot).allowance)
                            .reason ??
                            record(h.admission_snapshot).reason ??
                            'unavailable'
                        )
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {onPage && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || offset === 0}
                  onClick={() => onPage(Math.max(0, offset - 100))}
                >
                  Previous run evidence
                </Button>
                <span className="text-xs text-muted-foreground">
                  {total} evidence rows · Offset {offset}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || offset + 100 >= total}
                  onClick={() => onPage(offset + 100)}
                >
                  Next run evidence
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill value={String(data.status ?? 'unavailable')} />
              <span className="text-xs text-muted-foreground">
                {timeLabel(
                  typeof data.started_at === 'string'
                    ? data.started_at
                    : undefined
                )}{' '}
                · {Number(data.events_folded ?? 0)} folded receipts
              </span>
            </div>
            {Boolean(data.error) && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {String(data.error)}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(hygiene)
                .filter(([, v]) => typeof v === 'number')
                .map(([key, v]) => (
                  <div className="rounded-lg border p-3" key={key}>
                    <p className="text-[11px] text-muted-foreground">
                      {label(key)}
                    </p>
                    <p className="mt-1 text-sm font-medium tabular-nums">
                      {Number(v).toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          </>
        )}
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Technical evidence
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px]">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </details>
      </DialogContent>
    </Dialog>
  );
}

export function EpisodeReview({
  episode: e,
  disabled,
  onClose,
  onInspect,
}: {
  episode: AISpendEpisode;
  disabled: boolean;
  onClose: (
    id: number,
    reason: string,
    falsePositive: boolean
  ) => Promise<boolean>;
  onInspect: (run: string) => void;
}) {
  const [reason, setReason] = useState('');
  const evidence = e.evidence ?? {};
  const attributed = rows(e.attribution?.runs);
  const fields: Record<string, string> = {
    today_usd: 'Spend today',
    median_14d_usd: 'Usual daily spend',
    owner_usd: 'Owner settlement',
    ledger_usd: 'Recorded settlement',
    owner_reserved_usd: 'Owner reservations',
    job_reserved_usd: 'Job reservations',
    used: 'Units used',
    daily_threshold: 'Watch threshold',
    events: 'Affected receipts',
    lost_or_unobservable: 'Lost or unobservable receipts',
  };
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{label(e.kind)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {e.scope?.startsWith('class:')
              ? label(e.scope.slice(6))
              : e.scope?.startsWith('system:')
                ? scopeLabel(e.scope)
                : label(e.scope)}{' '}
            · Last seen {timeLabel(e.last_seen_at)}
          </p>
        </div>
        <StatusPill value={e.status} />
      </div>
      <p className="mt-4 text-sm leading-relaxed">
        {String(
          evidence.recommended_action ??
            'Review the evidence and attributed workflow before taking action.'
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-5">
        {Object.entries(fields)
          .filter(([key]) => typeof evidence[key] === 'number')
          .map(([key, title]) => (
            <div key={key}>
              <p className="text-[11px] text-muted-foreground">{title}</p>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {key.endsWith('_usd')
                  ? money(Number(evidence[key]))
                  : Number(evidence[key]).toLocaleString()}
              </p>
            </div>
          ))}
      </div>
      {attributed.length > 0 && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-[11px] text-muted-foreground">
            Related activity · correlation, not a proven cause
          </p>
          {attributed.map((r, i) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
              key={i}
            >
              <span>
                {label(String(r.trigger_source ?? 'unknown'))} ·{' '}
                {money(Number(r.cost_usd ?? 0))}
              </span>
              {Boolean(r.system_run_id) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onInspect(String(r.system_run_id))}
                >
                  Inspect run
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {e.kind === 'stt_drift' && (
        <Link
          className="mt-3 block text-xs text-primary underline"
          href="/platform/media"
        >
          Review transcription owner
        </Link>
      )}
      {e.status !== 'resolved' ? (
        <details className="mt-4 rounded-lg bg-muted/40 p-3">
          <summary className="cursor-pointer text-xs font-medium">
            Record a review outcome
          </summary>
          <label className="mt-3 block text-xs">
            Closure reason
            <Input
              className="mt-1.5"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What did you find, and what changed?"
              disabled={disabled}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled || !reason.trim()}
              onClick={() => void onClose(e.id, reason, false)}
            >
              Close after review
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !reason.trim()}
              onClick={() => void onClose(e.id, reason, true)}
            >
              Mark false positive
            </Button>
          </div>
        </details>
      ) : (
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Review outcome:{' '}
          {e.close_reason ?? 'Recovered after three healthy runs'}
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">
          Technical evidence
        </summary>
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all text-[11px]">
          {JSON.stringify(
            { evidence: e.evidence, attribution: e.attribution },
            null,
            2
          )}
        </pre>
      </details>
    </article>
  );
}
