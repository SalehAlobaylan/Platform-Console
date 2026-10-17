'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Filter,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BudgetEditor,
  EconomicsOverview,
  EpisodeReview,
  Panel,
  RunInspector,
  StatusPill,
  label,
  money as usd,
} from '@/components/platform/economics/economics-ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  useAISpendRollups,
  useAISpendRuns,
  useAISpendStatus,
  useRunAISpendGovernor,
} from '@/hooks/use-ai-spend';
import * as api from '@/lib/api/cms/ai-spend';
import { PlatformEconomics } from '@/components/platform/economics/platform-economics';

const date = (s?: string | null) =>
  s ? new Date(s).toLocaleString() : 'No evidence';
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const inputClass = 'rounded-md border bg-background px-3 py-2 text-sm';
const spendClasses = [
  'llm',
  'stt_api',
  'embedding',
  'rerank',
  'image_embed',
  'stt_local',
  'other',
];
const requestedItemLabel: Record<string, string> = {
  translate: 'requested translated item',
  chapter_proposal: 'requested proposal item',
  topic_digest: 'requested digest',
};
const admissionLabels: Record<string, string> = {
  governor_disabled: 'Allowed · Observe mode',
  governor_unavailable: 'Allowed · Governor unavailable',
  owner_delegated: 'Managed by the owning system',
  policy_paused: 'Stopped · Governor paused',
  class_paused: 'Stopped · LLM paused',
  no_budget: 'Allowed · No budget configured',
  uncapped: 'Allowed · No cap',
  budget_capped: 'Stopped · Budget reached',
  budget_warning: 'Allowed · Budget warning',
  human_confirmed_override: 'Allowed · Human confirmation',
  within_budget: 'Allowed · Within budget',
};
const admissionLabel = (reason?: string) =>
  admissionLabels[reason ?? ''] ?? 'Admission unavailable';
const tabs = [
  'Overview',
  'Users',
  'Budgets',
  'Usage',
  'Savings & compute',
  'Reconciliation',
  'Episodes',
  'Debug',
] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = {
  Overview: 'Overview',
  Users: 'Users',
  Usage: 'Activity',
  Budgets: 'Budgets',
  'Savings & compute': 'Savings & compute',
  Reconciliation: 'Billing',
  Episodes: 'Attention',
  Debug: 'Diagnostics',
};

export default function EconomicsPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === 'admin' ||
    Boolean(
      user?.permissions?.some(
        (p) => p === 'content:write' || p === '*' || p === '*:*'
      )
    );
  const [tab, setTab] = useState<Tab>('Overview');
  const [from, setFrom] = useState(day(-29));
  const [to, setTo] = useState(day(1));
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [usageOperation, setUsageOperation] = useState('');
  const [usageProvider, setUsageProvider] = useState('');
  const [usageModel, setUsageModel] = useState('');
  const [usageTrigger, setUsageTrigger] = useState('');
  const [usageRun, setUsageRun] = useState('');
  const [usageActor, setUsageActor] = useState('');
  const [runOffset, setRunOffset] = useState(0);
  const [runStatus, setRunStatus] = useState('');
  const period = {
    from,
    to,
    spend_class: filter,
    operation: usageOperation,
    provider: usageProvider,
    model: usageModel,
    trigger_source: usageTrigger,
    system_run_id: usageRun,
    human_actor_id: usageActor,
  };
  const status = useAISpendStatus(period);
  const rollups = useAISpendRollups(
    {
      ...period,
      spend_class: filter,
      limit: 50,
      offset,
    },
    tab === 'Usage'
  );
  const runs = useAISpendRuns(
    {
      from,
      to,
      status: runStatus,
      limit: 50,
      offset: runOffset,
    },
    tab === 'Debug'
  );
  const run = useRunAISpendGovernor();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scope, setScope] = useState('class:llm');
  const [cadence, setCadence] = useState('5');
  const [horizon, setHorizon] = useState('30');
  const [retention, setRetention] = useState('90');
  const [spikeMultiplier, setSpikeMultiplier] = useState('4');
  const [computeLimits, setComputeLimits] = useState<Record<string, number>>(
    {}
  );
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('*');
  const [priceClass, setPriceClass] = useState('llm');
  const [inputRate, setInputRate] = useState('');
  const [cachedInputRate, setCachedInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [priceDate, setPriceDate] = useState(day(0));
  const [priceNote, setPriceNote] = useState('');
  const [invoiceProvider, setInvoiceProvider] = useState('');
  const [invoiceMonth, setInvoiceMonth] = useState(day(0).slice(0, 7));
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceNote, setInvoiceNote] = useState('');
  const [trigger, setTrigger] = useState('manual_chapter_planning');
  const [preview, setPreview] = useState<api.AISpendAllowance | null>(null);
  const [grant, setGrant] = useState<{ id: string; expires_at: string } | null>(
    null
  );
  const [runDetail, setRunDetail] = useState<unknown>(null);
  const [runSpendID, setRunSpendID] = useState('');
  const [runSpendOffset, setRunSpendOffset] = useState(0);
  const [runSpendTotal, setRunSpendTotal] = useState(0);
  const [subject, setSubject] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateError, setDateError] = useState('');
  const [range, setRange] = useState('30');
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftThrough, setDraftThrough] = useState(day(0));
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const [dimension, setDimension] = useState('trigger_source');
  const [showHistory, setShowHistory] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  function clearFilters() {
    setFilter('');
    setUsageOperation('');
    setUsageProvider('');
    setUsageModel('');
    setUsageTrigger('');
    setUsageRun('');
    setUsageActor('');
    setOffset(0);
  }
  function drill(key: string, value: string) {
    if (key === 'spend_class') setFilter(value);
    if (key === 'trigger_source') setUsageTrigger(value);
    if (key === 'operation') setUsageOperation(value);
    if (key === 'provider') setUsageProvider(value);
    if (key === 'model') setUsageModel(value);
    setOffset(0);
    setTab('Usage');
  }
  useEffect(() => {
    const cadence = status.data?.policy.aggregation_interval_minutes;
    const horizon = status.data?.policy.forecast_horizon_days;
    if (cadence != null) setCadence(String(cadence));
    if (horizon != null) setHorizon(String(horizon));
    if (status.data?.policy.retention_days != null)
      setRetention(String(status.data.policy.retention_days));
    if (status.data?.policy.spike_multiplier != null)
      setSpikeMultiplier(String(status.data.policy.spike_multiplier));
  }, [
    status.data?.policy.aggregation_interval_minutes,
    status.data?.policy.forecast_horizon_days,
    status.data?.policy.retention_days,
    status.data?.policy.spike_multiplier,
  ]);
  const limitsKey = JSON.stringify(
    status.data?.compute_watch?.map((w) => [
      w.spend_class,
      w.daily_threshold,
    ]) ?? []
  );
  useEffect(() => {
    setComputeLimits(
      Object.fromEntries(JSON.parse(limitsKey) as [string, number][])
    );
  }, [limitsKey]);
  const monthStart = /^\d{4}-\d{2}$/.test(invoiceMonth)
    ? invoiceMonth + '-01'
    : day(0).slice(0, 7) + '-01';
  const monthEnd = new Date(
    Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 1)
  )
    .toISOString()
    .slice(0, 10);
  const monthly = useQuery({
    queryKey: ['ai-spend', 'month', monthStart, invoiceProvider],
    queryFn: () =>
      api.getAISpendStatus({
        from: monthStart,
        to: monthEnd,
        provider: invoiceProvider,
      }),
    enabled: tab === 'Reconciliation',
  });
  const prices = useQuery({
    queryKey: ['ai-spend', 'prices'],
    queryFn: api.getAIPrices,
    enabled: tab === 'Budgets',
  });
  const invoices = useQuery({
    queryKey: ['ai-spend', 'invoices'],
    queryFn: api.getAISpendInvoices,
    enabled: tab === 'Reconciliation',
  });
  const episodes = useQuery({
    queryKey: ['ai-spend', 'episodes'],
    queryFn: api.getAISpendEpisodes,
    enabled: tab === 'Episodes',
    refetchInterval: 30000,
  });
  const events = useQuery({
    queryKey: ['ai-spend', 'events', period, offset],
    queryFn: () => api.getAISpendEvents({ ...period, limit: 50, offset }),
    enabled: tab === 'Debug',
  });
  const byRun = useQuery({
    queryKey: ['ai-spend', 'by-run', period],
    queryFn: () => api.getAISpendByRun(period),
    enabled: tab === 'Usage',
  });
  async function action(fn: () => Promise<unknown>, message: string) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['ai-spend'] });
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        typeof e === 'object' && e && 'message' in e
          ? String(e.message)
          : 'Action failed'
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  async function loadRunSpend(id: string, offset: number) {
    const detail = await api.getAISpendRunSpend(id, offset);
    setRunDetail(detail);
    setRunSpendID(id);
    setRunSpendOffset(offset);
    setRunSpendTotal(
      Math.max(
        Number(detail.rollup_total ?? 0),
        Number(detail.human_total ?? 0)
      )
    );
  }
  const disabled = !canEdit || pending;
  if (status.isLoading)
    return (
      <div aria-label="Loading economics" className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  if (status.isError || !status.data)
    return (
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h1 className="text-2xl font-semibold">Economics</h1>
            <p role="alert">
              AI spending is unavailable. {status.error?.message}
            </p>
            <Button onClick={() => void status.refetch()}>
              Retry AI evidence
            </Button>
          </CardContent>
        </Card>
        {user?.role === 'admin' && (
          <>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Economics workspaces"
            >
              {(
                [
                  'Overview',
                  'Users',
                  'Usage',
                  'Reconciliation',
                  'Episodes',
                  'Debug',
                ] as const
              ).map((t) => (
                <Button
                  key={t}
                  variant={tab === t ? 'default' : 'outline'}
                  onClick={() => setTab(t)}
                >
                  {tabLabels[t]}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                From (UTC)
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                To (exclusive, UTC)
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <PlatformEconomics
              key={`${user?.tenant_id}:${user?.id}`}
              view={
                tab === 'Users'
                  ? 'users'
                  : tab === 'Usage'
                    ? 'activity'
                    : tab === 'Reconciliation'
                      ? 'billing'
                      : tab === 'Episodes'
                        ? 'attention'
                        : tab === 'Debug'
                          ? 'diagnostics'
                          : 'overview'
              }
              period={{ from, to }}
            />
          </>
        )}
      </div>
    );
  const s = status.data;
  const totals = s.totals;
  const health = s.evidence.ledger_health ?? 'unavailable';
  const paidAudioSeconds = (s.units ?? [])
    .filter((u) => u.spend_class === 'stt_api' && u.key === 'audio_sec')
    .reduce((sum, u) => sum + u.value, 0);
  const section = (
    title: string,
    description: string,
    children: React.ReactNode
  ) => (
    <Panel key={title} title={title} description={description}>
      <div className="space-y-4 text-sm [&_label]:text-xs [&_td]:py-3 [&_td]:pr-4 [&_th]:pb-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
        {children}
      </div>
    </Panel>
  );
  const loadError = (q: { isError: boolean; error: Error | null }) =>
    q.isError ? (
      <p role="alert" className="text-destructive">
        Could not load this section: {q.error?.message}
      </p>
    ) : null;
  const policyPaused =
    s.policy.paused_until && new Date(s.policy.paused_until) > new Date();
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Economics</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Understand platform costs, investigate accounts, and manage AI
            spending.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={health} />
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || run.isPending}
            onClick={() => run.mutate()}
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${run.isPending ? 'animate-spin' : ''}`}
            />
            {run.isPending ? 'Updating ledger…' : 'Refresh ledger'}
          </Button>{' '}
          <Button
            size="sm"
            variant="ghost"
            aria-label="Diagnostics"
            onClick={() => setTab('Debug')}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Economics sections"
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1"
        >
          {[
            ['Overview', 'Overview'],
            ...(user?.role === 'admin' ? [['Users', 'Users']] : []),
            ['Usage', 'Activity'],
            ['Budgets', 'Budgets'],
            ['Reconciliation', 'Billing'],
          ].map(([key, title]) => {
            const active =
              tab === key || (key === 'Usage' && tab === 'Savings & compute');
            return (
              <button
                key={key}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => {
                  setTab(key as Tab);
                  setOffset(0);
                }}
              >
                {title}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="economics-period">
            Report period
          </label>
          <select
            id="economics-period"
            className="h-9 rounded-md border bg-card px-2 text-xs"
            value={range}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                setDraftFrom(from);
                setDraftThrough(
                  new Date(new Date(to + 'T00:00:00Z').getTime() - 86400000)
                    .toISOString()
                    .slice(0, 10)
                );
                setDateError('');
                setDatesOpen(true);
                return;
              }
              setRange(value);
              setFrom(
                value === 'month'
                  ? day(0).slice(0, 7) + '-01'
                  : day(value === 'today' ? 0 : 1 - Number(value))
              );
              setTo(day(1));
              setOffset(0);
              setRunOffset(0);
            }}
          >
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
            <option value="today">Today</option>
            <option value="month">This month</option>
            <option value="custom">Custom dates</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraftFilters({
                spend_class: filter,
                operation: usageOperation,
                provider: usageProvider,
                model: usageModel,
                trigger_source: usageTrigger,
                system_run_id: usageRun,
                human_actor_id: usageActor,
              });
              setFiltersOpen(true);
            }}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            AI filters
            {Object.values(period).filter((v, i) => i > 1 && v).length > 0
              ? ` (${Object.values(period).filter((v, i) => i > 1 && v).length})`
              : ''}
          </Button>
          <Button
            size="sm"
            variant={tab === 'Episodes' ? 'secondary' : 'ghost'}
            onClick={() => setTab('Episodes')}
          >
            <CircleAlert className="mr-1.5 h-3.5 w-3.5" />
            Attention
            {s.episodes.filter((e) =>
              ['open', 'recovering', 'flapping'].includes(e.status)
            ).length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 text-amber-700 dark:text-amber-300">
                {
                  s.episodes.filter((e) =>
                    ['open', 'recovering', 'flapping'].includes(e.status)
                  ).length
                }
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
        <CalendarDays className="h-3 w-3" />
        <button
          aria-label="Change report dates"
          className="text-left underline decoration-dotted underline-offset-4 hover:text-foreground"
          onClick={() => {
            setDraftFrom(from);
            setDraftThrough(
              new Date(new Date(to + 'T00:00:00Z').getTime() - 86400000)
                .toISOString()
                .slice(0, 10)
            );
            setDateError('');
            setDatesOpen(true);
          }}
        >
          {from} –{' '}
          {new Date(new Date(to + 'T00:00:00Z').getTime() - 86400000)
            .toISOString()
            .slice(0, 10)}{' '}
          · UTC
        </button>
        <span className="hidden sm:inline">·</span>
        <span>Last ledger update {date(s.evidence.last_rollup_at)}</span>
        {!canEdit && (
          <span className="rounded bg-muted px-2 py-1">
            Your access is read only.
          </span>
        )}
        {Object.entries(period)
          .filter(([key, value]) => !['from', 'to'].includes(key) && value)
          .map(([key, value]) => (
            <span
              className="max-w-full break-all rounded-md border bg-card px-2 py-1 text-foreground"
              key={key}
            >
              {label(key)}: {label(value)}
            </span>
          ))}
        {Object.values(period).slice(2).some(Boolean) && (
          <button className="text-primary underline" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      {(error || run.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error || `Ledger run failed: ${run.error?.message}`}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs"
        >
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          {notice}
          <button
            aria-label="Dismiss notification"
            className="ml-auto"
            onClick={() => setNotice('')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {s.evidence.legacy_unallocated_present && (
        <details className="rounded-lg border p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Historical accounting note
          </summary>
          <p className="mt-2">
            Historical rollups contain mixed tenant data. They are retained as
            unallocated history and excluded from this tenant’s totals.
          </p>
        </details>
      )}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Filter activity</DialogTitle>
            <DialogDescription>
              These AI filters apply to AI totals and activity. Platform and
              user reports use the shared date period. Budget controls always
              use their full anchored window.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilter(draftFilters.spend_class ?? '');
              setUsageOperation(draftFilters.operation ?? '');
              setUsageProvider(draftFilters.provider ?? '');
              setUsageModel(draftFilters.model ?? '');
              setUsageTrigger(draftFilters.trigger_source ?? '');
              setUsageRun(draftFilters.system_run_id ?? '');
              setUsageActor(draftFilters.human_actor_id ?? '');
              setOffset(0);
              setFiltersOpen(false);
            }}
            className="space-y-4"
          >
            <label className="block text-xs">
              Spend class
              <select
                className={`${inputClass} mt-1.5 block w-full`}
                value={draftFilters.spend_class ?? ''}
                onChange={(e) =>
                  setDraftFilters({
                    ...draftFilters,
                    spend_class: e.target.value,
                  })
                }
              >
                <option value="">All classes</option>
                {spendClasses.map((key) => (
                  <option value={key} key={key}>
                    {label(key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Operation', 'operation'],
                ['Provider', 'provider'],
                ['Model', 'model'],
                ['Workflow', 'trigger_source'],
                ['Run ID', 'system_run_id'],
                ['Human actor ID', 'human_actor_id'],
              ].map(([title, key]) => (
                <label className="text-xs" key={key}>
                  {title}
                  <Input
                    className="mt-1.5"
                    value={draftFilters[key] ?? ''}
                    onChange={(e) =>
                      setDraftFilters({
                        ...draftFilters,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-between border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraftFilters({})}
              >
                Reset filters
              </Button>
              <Button>Apply filters</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={datesOpen} onOpenChange={setDatesOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl">
          <DialogHeader>
            <DialogTitle>Choose report dates</DialogTitle>
            <DialogDescription>
              Both selected dates are included. Reports use UTC and support up
              to 365 days.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const start = new Date(draftFrom + 'T00:00:00Z');
              const end = new Date(draftThrough + 'T00:00:00Z');
              if (
                end < start ||
                (end.getTime() - start.getTime()) / 86400000 >= 365
              ) {
                setDateError(
                  'Choose an ordered date range of at most 365 days.'
                );
                return;
              }
              setFrom(draftFrom);
              setTo(
                new Date(end.getTime() + 86400000).toISOString().slice(0, 10)
              );
              setRange('custom');
              setOffset(0);
              setRunOffset(0);
              setError('');
              setDatesOpen(false);
            }}
          >
            <label className="block text-xs">
              From (UTC)
              <Input
                required
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              Through (UTC)
              <Input
                required
                type="date"
                value={draftThrough}
                min={draftFrom}
                onChange={(e) => setDraftThrough(e.target.value)}
              />
            </label>
            {dateError && (
              <p role="alert" className="text-xs text-destructive">
                {dateError}
              </p>
            )}
            <Button className="w-full">Apply dates</Button>
          </form>
        </DialogContent>
      </Dialog>
      {(tab === 'Usage' || tab === 'Savings & compute') && (
        <div className="flex items-center gap-4 border-b text-xs">
          <button
            onClick={() => setTab('Usage')}
            className={`pb-3 ${tab === 'Usage' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
          >
            Costs & workflows
          </button>
          <button
            onClick={() => setTab('Savings & compute')}
            className={`pb-3 ${tab === 'Savings & compute' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
          >
            Efficiency & compute
          </button>
        </div>
      )}
      {(tab === 'Episodes' || tab === 'Debug') && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {tab === 'Episodes' ? 'Spend attention' : 'Accounting diagnostics'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setTab('Overview')}>
            <ArrowLeft className="mr-1.5 h-3 w-3" />
            Back to overview
          </Button>
        </div>
      )}
      {user?.role === 'admin' && tab === 'Overview' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="overview"
          period={{ from, to }}
        />
      )}
      {user?.role === 'admin' && tab === 'Users' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="users"
          period={{ from, to }}
        />
      )}
      {user?.role === 'admin' && tab === 'Usage' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="activity"
          period={{ from, to }}
        />
      )}
      {user?.role === 'admin' && tab === 'Reconciliation' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="billing"
          period={{ from, to }}
        />
      )}
      {user?.role === 'admin' && tab === 'Episodes' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="attention"
          period={{ from, to }}
        />
      )}
      {user?.role === 'admin' && tab === 'Debug' && (
        <PlatformEconomics
          key={`${user?.tenant_id}:${user?.id}`}
          view="diagnostics"
          period={{ from, to }}
        />
      )}
      {tab === 'Overview' && (
        <EconomicsOverview
          status={s}
          onNavigate={(value) => setTab(value as Tab)}
          onFilter={drill}
        />
      )}
      {tab === 'Budgets' && (
        <>
          {section(
            'Autonomous spend controls',
            'Enable governance to apply the language-model limit to new autonomous paid calls. Metering and owner controls continue.',
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void action(
                      () =>
                        api.updateAISpendPolicy({ enabled: !s.policy.enabled }),
                      'Policy saved'
                    )
                  }
                >
                  {s.policy.enabled
                    ? 'Disable governance'
                    : 'Enable governance'}
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void action(
                      () =>
                        api.updateAISpendPolicy({
                          paused_until: policyPaused
                            ? null
                            : new Date(Date.now() + 3600000).toISOString(),
                        }),
                      'Schedule updated'
                    )
                  }
                >
                  {policyPaused
                    ? 'Resume governor'
                    : 'Pause governor for 1 hour'}
                </Button>
              </div>
              <p>
                {policyPaused
                  ? `Paused until ${date(s.policy.paused_until)}`
                  : 'Accounting schedule active'}
                . Resume preserves the enabled setting.
              </p>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Schedule, retention & detection settings
                </summary>
                <div className="mt-4">
                  {' '}
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(
                        () =>
                          api.updateAISpendPolicy({
                            aggregation_interval_minutes: Number(cadence),
                            forecast_horizon_days: Number(horizon),
                            retention_days: Number(retention),
                            spike_multiplier: Number(spikeMultiplier),
                          }),
                        'Schedule saved'
                      );
                    }}
                  >
                    <label>
                      Cadence (minutes)
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={cadence}
                        onChange={(e) => setCadence(e.target.value)}
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      Forecast horizon (days)
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={horizon}
                        onChange={(e) => setHorizon(e.target.value)}
                        disabled={disabled}
                      />
                    </label>
                    <Button disabled={disabled}>Save schedule</Button>
                    <label>
                      Raw retention (days)
                      <Input
                        type="number"
                        min="90"
                        value={retention}
                        onChange={(e) => setRetention(e.target.value)}
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      Spike multiplier
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={spikeMultiplier}
                        onChange={(e) => setSpikeMultiplier(e.target.value)}
                        disabled={disabled}
                      />
                    </label>
                  </form>
                </div>
              </details>
            </div>
          )}
          {section(
            'Budget limits',
            'Platform and system scopes advise. The LLM class stops new autonomous paid calls within a bounded margin.',
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {s.budgets.map((b) => (
                  <BudgetEditor
                    key={`${b.id}:${b.updated_at ?? ''}`}
                    budget={b}
                    forecast={s.forecasts?.[b.scope]}
                    verdict={s.budget_verdicts?.[b.scope]?.verdict}
                    disabled={disabled}
                    error={error}
                    save={(b) =>
                      action(() => api.saveAISpendBudget(b), 'Budget saved')
                    }
                  />
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Add an advisory budget scope
                </summary>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (s.budgets.some((b) => b.scope === scope.trim())) {
                      setError(
                        'This budget already exists. Use Edit to change its limit.'
                      );
                      return;
                    }
                    void action(
                      () =>
                        api.saveAISpendBudget({
                          scope: scope.trim(),
                          cap_usd: null,
                        }),
                      'Budget scope created'
                    );
                  }}
                >
                  <Input
                    aria-label="New budget scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="class:llm, platform or system:name"
                    disabled={disabled}
                  />
                  <Button disabled={disabled}>Add scope</Button>
                </form>
              </details>
              <p className="text-xs text-muted-foreground">
                Editing a limit preserves its current 30-day window and recorded
                spend.
              </p>
              <details className="rounded-lg bg-muted/40 p-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Allowance safety details
                </summary>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>
                    Limits stop new autonomous paid LLM calls. Reporting delay
                    and work already admitted can cause spend to exceed the
                    limit; a maximum overshoot has not been qualified.
                  </p>
                  <p>
                    Current admission margin:{' '}
                    {s.allowance?.margin_usd == null
                      ? 'Unavailable'
                      : usd(s.allowance.margin_usd)}{' '}
                    · Reporting delay:{' '}
                    {s.allowance?.reporting_lag_seconds ?? 'Unavailable'}{' '}
                    seconds · Overshoot tolerance:{' '}
                    {label(s.allowance?.tolerance_status)}.
                  </p>
                </div>
              </details>
            </>
          )}
          <details
            open={pricesOpen}
            onToggle={(e) => setPricesOpen(e.currentTarget.open)}
            className="rounded-xl border bg-card"
          >
            <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium">
              Shared model prices{' '}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="px-4 pb-4">
              {' '}
              {section(
                'Versioned price book',
                'Shared across tenants. Only administrators append corrections. Provider * is the estimated class fallback. Recorded costs retain their original price version.',
                <>
                  {loadError(prices)}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>Class / provider</th>
                          <th>Prefix</th>
                          <th>Input / 1M</th>
                          <th>Provider-cached input / 1M</th>
                          <th>Output / 1M</th>
                          <th>Unit USD</th>
                          <th>Effective</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prices.data?.prices.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td>
                              {p.spend_class} / {p.provider}
                            </td>
                            <td>{p.model_pattern}</td>
                            <td>{usd(p.input_usd_per_1m)}</td>
                            <td>
                              {p.cached_input_usd_per_1m == null
                                ? 'Standard input rate'
                                : usd(p.cached_input_usd_per_1m)}
                            </td>
                            <td>{usd(p.output_usd_per_1m)}</td>
                            <td>{usd(p.unit_usd)}</td>
                            <td>{date(p.effective_from)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <form
                    className="grid gap-3 md:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(
                        () =>
                          api.appendAIPrice({
                            spend_class: priceClass,
                            provider,
                            model_pattern: model,
                            input_usd_per_1m: Number(inputRate),
                            cached_input_usd_per_1m:
                              cachedInputRate.trim() === ''
                                ? null
                                : Number(cachedInputRate),
                            output_usd_per_1m: Number(outputRate),
                            unit_usd: Number(unitRate),
                            effective_from: new Date(
                              priceDate + 'T00:00:00Z'
                            ).toISOString(),
                            note: priceNote,
                          }),
                        'Price version appended'
                      );
                    }}
                  >
                    {[
                      ['Class', priceClass, setPriceClass],
                      ['Provider', provider, setProvider],
                      ['Model prefix', model, setModel],
                      ['Input USD / 1M', inputRate, setInputRate],
                      [
                        'Provider-cached input USD / 1M (optional)',
                        cachedInputRate,
                        setCachedInputRate,
                      ],
                      ['Output USD / 1M', outputRate, setOutputRate],
                      ['Unit USD', unitRate, setUnitRate],
                      ['Note', priceNote, setPriceNote],
                    ].map(([label, value, setter]) => (
                      <label key={label as string}>
                        {label as string}
                        <Input
                          value={value as string}
                          type={
                            (label as string).includes('USD')
                              ? 'number'
                              : 'text'
                          }
                          min={
                            (label as string).includes('USD') ? 0 : undefined
                          }
                          step={
                            (label as string).includes('USD')
                              ? 'any'
                              : undefined
                          }
                          onChange={(e) =>
                            (setter as (s: string) => void)(e.target.value)
                          }
                          disabled={disabled || user?.role !== 'admin'}
                        />
                      </label>
                    ))}
                    <label>
                      Effective from
                      <Input
                        required
                        type="date"
                        value={priceDate}
                        onChange={(e) => setPriceDate(e.target.value)}
                        disabled={disabled || user?.role !== 'admin'}
                      />
                    </label>
                    <Button disabled={disabled || user?.role !== 'admin'}>
                      Append price version
                    </Button>
                  </form>
                </>
              )}
            </div>
          </details>
          <details className="rounded-xl border bg-card">
            <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium">
              Run a workflow with human confirmation{' '}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="px-4 pb-4">
              {' '}
              {section(
                'Human override',
                'Preview the LLM allowance before confirming a temporary, attributed override. STT owner controls still apply.',
                <>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="Override workflow"
                      className={inputClass}
                      value={trigger}
                      onChange={(e) => {
                        setTrigger(e.target.value);
                        setPreview(null);
                        setGrant(null);
                      }}
                    >
                      {[
                        'manual_chapter_planning',
                        'manual_story_digest',
                        'manual_story_label',
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={disabled}
                      onClick={() =>
                        void action(
                          async () =>
                            setPreview(
                              await api.previewAISpendOverride(trigger)
                            ),
                          'Allowance preview loaded'
                        )
                      }
                    >
                      Preview allowance
                    </Button>
                  </div>
                  {preview && (
                    <div>
                      <p>
                        {admissionLabel(preview.reason)} · Remaining{' '}
                        {preview.remaining_usd == null
                          ? 'uncapped'
                          : usd(preview.remaining_usd)}
                      </p>
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={() =>
                          void action(
                            async () =>
                              setGrant(
                                await api.confirmAISpendOverride(trigger)
                              ),
                            'Override confirmed'
                          )
                        }
                      >
                        Confirm paid LLM override
                      </Button>
                    </div>
                  )}
                  {grant && (
                    <div>
                      <p>
                        Confirmed until {date(grant.expires_at)}. Execution
                        still checks owner policy and your current authority.
                      </p>
                      {trigger === 'manual_chapter_planning' && (
                        <Input
                          aria-label="Content ID for chapter planning"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Episode content UUID"
                        />
                      )}
                      <Button
                        disabled={disabled}
                        onClick={() =>
                          void action(
                            () =>
                              api.executeConfirmedAISpendWorkflow(
                                trigger,
                                grant.id,
                                subject
                              ),
                            'Workflow completed'
                          )
                        }
                      >
                        Execute confirmed workflow
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        </>
      )}
      {tab === 'Usage' && (
        <>
          <Panel
            title="Cost drivers"
            description="Choose a grouping, then click a row to filter the report."
            action={
              <select
                aria-label="Group activity by"
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
              >
                {[
                  ['trigger_source', 'Workflow'],
                  ['spend_class', 'Spend class'],
                  ['operation', 'Operation'],
                  ['provider', 'Provider'],
                  ['model', 'Model'],
                ].map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">{label(dimension)}</th>
                    <th className="pb-3 text-right font-medium">Operations</th>
                    <th className="pb-3 text-right font-medium">
                      Recorded cost
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...(s.breakdown?.[dimension] ?? [])]
                    .sort((a, b) => b.cost_usd - a.cost_usd)
                    .map((r) => (
                      <tr className="border-b last:border-0" key={r.key}>
                        <td className="py-3">
                          <button
                            className="font-medium text-primary hover:underline"
                            onClick={() => drill(dimension, r.key)}
                          >
                            {label(r.key) || 'Unknown'}
                          </button>
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {r.events.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums">
                          {usd(r.cost_usd)}
                        </td>
                        <td className="pl-3 text-right">
                          <ArrowRight className="inline h-3 w-3 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!s.breakdown?.[dimension]?.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No matching activity. Try clearing filters or changing the
                  date range.
                </p>
              )}
            </div>
          </Panel>
          {section(
            'Recorded activity',
            'Paged detail; headline totals use every matching row.',
            <>
              {loadError(rollups)}
              <select
                className={inputClass}
                aria-label="Spend class filter"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setOffset(0);
                }}
              >
                {[
                  '',
                  'llm',
                  'stt_api',
                  'embedding',
                  'rerank',
                  'image_embed',
                  'stt_local',
                ].map((v) => (
                  <option key={v} value={v}>
                    {v ? label(v) : 'All classes'}
                  </option>
                ))}
              </select>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Class / operation</th>
                      <th>Provider / model</th>
                      <th>Workflow / run</th>
                      <th>Events</th>
                      <th>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollups.data?.rollups.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td>{r.day.slice(0, 10)}</td>
                        <td>
                          {label(r.spend_class)} / {label(r.operation)}
                        </td>
                        <td>
                          {r.provider} / {r.model}
                        </td>
                        <td>
                          {label(r.trigger_source)}
                          <br />
                          {r.system_run_id}
                        </td>
                        <td>{r.events}</td>
                        <td>{usd(r.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </Button>
                <span>
                  {(rollups.data?.total ?? 0) > 0 ? offset + 1 : 0}–
                  {Math.min(offset + 50, rollups.data?.total ?? 0)} of{' '}
                  {rollups.data?.total ?? 0}
                </span>
                <Button
                  variant="outline"
                  disabled={offset + 50 >= (rollups.data?.total ?? 0)}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
          {section(
            'Attributed run spend',
            'Rollups retain run attribution after raw retention. Up to 500 runs, ordered by spend.',
            <>
              {loadError(byRun)}
              {byRun.data?.runs.map((r) => (
                <div
                  key={`${label(r.trigger_source)}:${r.system_run_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"
                >
                  <span>
                    <span className="block font-medium">
                      {label(r.trigger_source)}
                    </span>
                    <span
                      className="mt-1 block max-w-[280px] truncate text-[11px] text-muted-foreground"
                      title={r.system_run_id}
                    >
                      {r.system_run_id || 'Run unavailable'}
                    </span>
                  </span>
                  <span>
                    {usd(r.cost_usd)} · {r.events} operations
                  </span>
                  {r.system_run_id && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void action(async () => {
                          await loadRunSpend(r.system_run_id, 0);
                        }, 'Run spend loaded')
                      }
                    >
                      Inspect run
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
      {tab === 'Savings & compute' && (
        <>
          {section(
            'Cache savings',
            'Measured provider usage and estimated legacy-cache usage are shown separately.',
            <div className="grid gap-4 md:grid-cols-3">
              <p>
                Measured:{' '}
                {totals
                  ? usd(totals.avoided_cost_usd - totals.avoided_estimated_usd)
                  : 'Unavailable'}
              </p>
              <p>
                Estimated:{' '}
                {totals ? usd(totals.avoided_estimated_usd) : 'Unavailable'}
              </p>
              <p>Cache hits: {totals?.cache_hits ?? 'Unavailable'}</p>
            </div>
          )}
          {section(
            'Local compute demand',
            'Local compute has zero provider price. It still consumes capacity.',
            <div className="space-y-2">
              {s.units
                ?.filter((u) => !['llm', 'stt_api'].includes(u.spend_class))
                .map((u) => (
                  <div
                    key={`${u.spend_class}:${u.operation}:${u.key}`}
                    className="flex justify-between border-b"
                  >
                    <span>
                      {label(u.spend_class)} / {label(u.operation)} ·{' '}
                      {u.key.replaceAll('_', ' ')}
                    </span>
                    <span>
                      {u.value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              {!s.units?.length && (
                <p>No compute units captured in this period.</p>
              )}
            </div>
          )}
          {section(
            'Unit economics',
            'Denominators use captured operations and audio duration, rather than claiming uncaptured content coverage.',
            <>
              {['translate', 'chapter_proposal', 'topic_digest'].map(
                (operation) => {
                  const unit = s.item_economics?.find(
                    (u) => u.operation === operation
                  );
                  return (
                    <p key={operation} className="rounded-lg border p-4">
                      {requestedItemLabel[operation]}:{' '}
                      {unit && unit.items > 0
                        ? `${usd(unit.cost_usd / unit.items)} per item · ${unit.items.toLocaleString()} captured`
                        : 'Unavailable — item denominator not captured'}
                      {unit && unit.total_events > unit.captured_events
                        ? ` · ${unit.total_events - unit.captured_events} operations lack an item denominator`
                        : ''}
                    </p>
                  );
                }
              )}
              {s.breakdown?.operation?.map((o) => (
                <p
                  key={o.key}
                  className="flex flex-wrap justify-between gap-2 border-b py-3"
                >
                  {label(o.key)}:{' '}
                  {o.events > 0 ? usd(o.cost_usd / o.events) : 'Unavailable'}{' '}
                  per captured operation · {o.events.toLocaleString()}{' '}
                  operations
                </p>
              ))}
              <p>
                USD per metered operation:{' '}
                {totals && totals.events > 0
                  ? usd(totals.cost_usd / totals.events)
                  : 'Unavailable'}
              </p>
              <p>
                USD per captured audio hour:{' '}
                {totals && paidAudioSeconds > 0
                  ? usd(
                      (s.breakdown?.spend_class?.find(
                        (r) => r.key === 'stt_api'
                      )?.cost_usd ?? 0) /
                        (paidAudioSeconds / 3600)
                    )
                  : 'Unavailable — audio duration not captured'}
              </p>
            </>
          )}
          {section(
            'Compute volume watches',
            'Daily UTC thresholds are advisory. They do not stop compute or charge provider dollars.',
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {s.compute_watch?.map((w) => (
                  <div key={w.spend_class} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">
                        {label(w.spend_class)}
                      </p>
                      <StatusPill value={w.status} />
                    </div>
                    <p className="mt-3 text-lg font-semibold tabular-nums">
                      {w.used.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        / {w.daily_threshold.toLocaleString()} {label(w.unit)}
                      </span>
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${w.status === 'warning' ? 'bg-amber-500' : 'bg-primary'}`}
                        style={{
                          width: `${Math.min(100, (w.used / Math.max(1, w.daily_threshold)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {w.day} · UTC daily usage
                    </p>
                  </div>
                ))}
              </div>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Edit compute watch thresholds
                </summary>
                <div className="mt-4">
                  {' '}
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(
                        () =>
                          api.updateAISpendPolicy({
                            compute_watch_limits: computeLimits,
                          }),
                        'Compute watches saved'
                      );
                    }}
                  >
                    {s.compute_watch?.map((w) => (
                      <label key={w.spend_class} className="block">
                        {label(w.spend_class)}: {w.used.toLocaleString()}{' '}
                        {w.unit.replaceAll('_', ' ')} · {label(w.status)} ·{' '}
                        {w.day}
                        <Input
                          aria-label={`${w.spend_class} daily watch threshold`}
                          type="number"
                          min="1"
                          value={
                            computeLimits[w.spend_class] ?? w.daily_threshold
                          }
                          onChange={(e) =>
                            setComputeLimits({
                              ...computeLimits,
                              [w.spend_class]: Number(e.target.value),
                            })
                          }
                          disabled={disabled}
                        />
                      </label>
                    ))}
                    <Button disabled={disabled || !s.compute_watch?.length}>
                      Save compute watches
                    </Button>
                  </form>
                </div>
              </details>
            </div>
          )}
        </>
      )}
      {tab === 'Reconciliation' &&
        section(
          'Provider invoice reconciliation',
          'Calendar-month invoice versus recorded provider spend. Differences include missing usage, credits and provider billing rules.',
          <>
            <div className="grid max-w-lg gap-3 sm:grid-cols-2">
              <label>
                Provider
                <Input
                  value={invoiceProvider}
                  onChange={(e) => setInvoiceProvider(e.target.value)}
                  placeholder="All providers"
                />
              </label>
              <label>
                Calendar month
                <Input
                  type="month"
                  required
                  value={invoiceMonth}
                  onChange={(e) => setInvoiceMonth(e.target.value)}
                />
              </label>
            </div>
            {loadError(invoices)}
            {loadError(monthly)}
            {monthly.isLoading ? (
              <p>Loading calendar-month ledger…</p>
            ) : (
              monthly.data?.totals && (
                <div aria-label="Calendar-month ledger">
                  <p>
                    {invoiceProvider || 'All providers'} · [{monthStart},{' '}
                    {monthEnd}) UTC
                  </p>
                  <p>Month ledger: {usd(monthly.data.totals.cost_usd)}</p>
                  <p>
                    Measured savings:{' '}
                    {usd(
                      monthly.data.totals.avoided_cost_usd -
                        monthly.data.totals.avoided_estimated_usd
                    )}{' '}
                    · Estimated savings:{' '}
                    {usd(monthly.data.totals.avoided_estimated_usd)}
                  </p>
                  <p>
                    Unpriced: {monthly.data.totals.unpriced_events} ·
                    Unavailable usage:{' '}
                    {monthly.data.totals.usage_unavailable_events}
                  </p>
                </div>
              )
            )}
            <Button
              variant="outline"
              onClick={() => {
                setPricesOpen(true);
                setTab('Budgets');
              }}
            >
              Review shared price book
            </Button>
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Record a provider invoice
              </summary>
              <p className="my-3 text-xs text-muted-foreground">
                Uses the provider and calendar month selected above. Enter the
                invoice total to compare it with recorded spend.
              </p>{' '}
              <form
                className="grid gap-3 md:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    () =>
                      api.saveAISpendInvoice({
                        provider: invoiceProvider,
                        month: invoiceMonth + '-01T00:00:00Z',
                        amount_usd: Number(invoiceAmount),
                        note: invoiceNote,
                      }),
                    'Invoice saved'
                  );
                }}
              >
                <label>
                  Invoice USD
                  <Input
                    required
                    type="number"
                    step="any"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    disabled={disabled}
                  />
                </label>
                <label>
                  Note
                  <Input
                    value={invoiceNote}
                    onChange={(e) => setInvoiceNote(e.target.value)}
                    disabled={disabled}
                  />
                </label>
                <Button disabled={disabled || !invoiceProvider.trim()}>
                  Save invoice
                </Button>
              </form>
            </details>
            <div className="overflow-x-auto">
              {' '}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Provider / month</th>
                    <th>Invoice</th>
                    <th>Ledger</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data?.invoices.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td>
                        {i.provider} / {i.month.slice(0, 7)}
                      </td>
                      <td>{usd(i.amount_usd)}</td>
                      <td>{usd(i.ledger_usd)}</td>
                      <td>
                        <span
                          className={
                            i.delta_usd === 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-amber-700 dark:text-amber-300'
                          }
                        >
                          {usd(Math.abs(i.delta_usd))}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {i.delta_usd === 0
                            ? 'Matches ledger'
                            : i.delta_usd > 0
                              ? 'Invoice higher'
                              : 'Ledger higher'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoices.data?.invoices.length === 0 && (
              <p className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
                No invoices recorded yet. You can still inspect monthly spend
                above.
              </p>
            )}
          </>
        )}
      {tab === 'Episodes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Issues confirm after two affected accounting runs and recover
              after three healthy runs. Recurring issues need human review.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
              />
              Include resolved history
            </label>
          </div>
          {loadError(episodes)}
          {episodes.isLoading && <Skeleton className="h-32" />}
          {episodes.data?.episodes
            .filter((e) => showHistory || e.status !== 'resolved')
            .map((e) => (
              <EpisodeReview
                key={e.id}
                episode={e}
                disabled={disabled}
                onClose={(id, reason, falsePositive) =>
                  action(
                    () => api.closeAISpendEpisode(id, reason, falsePositive),
                    falsePositive
                      ? 'Episode marked false positive'
                      : 'Episode closed'
                  )
                }
                onInspect={(id) =>
                  void action(() => loadRunSpend(id, 0), 'Run spend loaded')
                }
              />
            ))}
          {episodes.data &&
            episodes.data.episodes.filter(
              (e) => showHistory || e.status !== 'resolved'
            ).length === 0 && (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <Check className="mx-auto h-6 w-6 text-emerald-600" />
                <p className="mt-3 text-sm font-medium">
                  No spend issues to review
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  New confirmed issues appear here. Include resolved history to
                  review past outcomes.
                </p>
              </div>
            )}
        </div>
      )}
      {tab === 'Debug' && (
        <>
          {' '}
          <Panel
            title="Spend evidence quality"
            description="Missing prices or usage can make recorded totals incomplete."
            action={<StatusPill value={health} />}
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ['Unpriced operations', totals?.unpriced_events],
                ['Estimated usage', totals?.estimated_events],
                ['Unattributed operations', totals?.unknown_events],
                ['Unavailable usage', totals?.usage_unavailable_events],
              ].map(([title, value]) => (
                <div key={title}>
                  <p className="text-xs text-muted-foreground">{title}</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {value ?? 'Unavailable'}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          {section(
            'Execution coverage',
            'Registered owners, execution roles, and their admission contracts.',
            <div className="space-y-3">
              {s.coverage?.map((c) => (
                <div key={c.workflow} className="border-b pb-2 text-sm">
                  <strong>{c.workflow}</strong>
                  <p>
                    {c.class} · {c.owner} · {c.guard}
                  </p>
                  <p>Deferred work: {c.skip}</p>
                </div>
              ))}
            </div>
          )}
          {section(
            'Emitter delivery',
            'Each process reports cumulative loss and unobservable provider attempts.',
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(s.evidence.hygiene ?? {}).map(
                  ([key, value]) => (
                    <div key={key} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {label(key)}
                      </p>
                      <p className="mt-2 text-base font-semibold tabular-nums">
                        {typeof value === 'number'
                          ? value.toLocaleString()
                          : String(value)}
                      </p>
                    </div>
                  )
                )}
              </div>
              {s.evidence.emitters?.map((e) => (
                <div key={e.process_id} className="border-b py-2 text-sm">
                  <strong>{e.source_service}</strong> · {e.process_id}
                  <p>
                    {e.emitted} emitted / {e.accepted} acknowledged /{' '}
                    {e.dropped} dropped / {e.unobservable} unobservable ·{' '}
                    {date(e.updated_at)}
                  </p>
                </div>
              ))}
              {!s.evidence.emitters?.length && (
                <p>No delivery health received.</p>
              )}
            </>
          )}
          {section(
            'Governor runs',
            'Failed runs remain visible. Select a run to inspect watermarks and hygiene evidence.',
            <>
              <label>
                Run status
                <select
                  aria-label="Run status"
                  className={inputClass}
                  value={runStatus}
                  onChange={(e) => {
                    setRunStatus(e.target.value);
                    setRunOffset(0);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                </select>
              </label>
              {loadError(runs)}
              {runs.data?.runs.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"
                >
                  <span>
                    {date(r.started_at)} · {r.trigger} · {r.status} ·{' '}
                    {r.events_folded} operations
                    {r.error && <p className="text-destructive">{r.error}</p>}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void action(async () => {
                        setRunSpendID('');
                        setRunDetail(await api.getAISpendRun(r.id));
                      }, 'Run detail loaded')
                    }
                  >
                    Inspect
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={runOffset === 0}
                  onClick={() => setRunOffset(Math.max(0, runOffset - 50))}
                >
                  Previous runs
                </Button>
                <span>{runs.data?.total ?? 0} accounting runs</span>
                <Button
                  variant="outline"
                  disabled={runOffset + 50 >= (runs.data?.total ?? 0)}
                  onClick={() => setRunOffset(runOffset + 50)}
                >
                  Next runs
                </Button>
              </div>
            </>
          )}
          {section(
            'Raw event audit',
            'Raw rows are retained for the configured period. Permanent rollups survive sweeping.',
            <>
              {loadError(events)}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Occurred</th>
                      <th>Class / provider</th>
                      <th>Workflow</th>
                      <th>USD</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.data?.events.map((e) => (
                      <tr key={e.event_id} className="border-t">
                        <td>{date(e.occurred_at)}</td>
                        <td>
                          {e.spend_class} / {e.provider}
                        </td>
                        <td>
                          {e.trigger_source}
                          <br />
                          {e.system_run_id}
                        </td>
                        <td>{usd(e.cost_usd)}</td>
                        <td>
                          {[
                            e.cached && 'cached',
                            e.estimated && 'estimated',
                            e.unpriced && 'unpriced',
                            e.over_cap_human && 'human override',
                          ]
                            .filter(Boolean)
                            .join(', ') || 'measured'}
                          <details>
                            <summary>Units</summary>
                            <pre>{JSON.stringify(e.units, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous events
                </Button>
                <span>{events.data?.total ?? 0} matching rows</span>
                <Button
                  variant="outline"
                  disabled={offset + 50 >= (events.data?.total ?? 0)}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next events
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <RunInspector
        detail={runDetail}
        onClose={() => setRunDetail(null)}
        offset={runSpendOffset}
        total={runSpendTotal}
        pending={pending}
        error={error}
        onPage={
          runSpendID
            ? (next) =>
                void action(
                  () => loadRunSpend(runSpendID, next),
                  'Run spend loaded'
                )
            : undefined
        }
      />
    </div>
  );
}
