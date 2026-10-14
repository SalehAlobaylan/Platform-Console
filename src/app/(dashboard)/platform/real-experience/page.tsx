'use client';
import { Suspense, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Smartphone,
  Monitor,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { SurfaceEvidence } from '@/components/platform/real-experience/surface-evidence';
import {
  EmptyEvidence,
  QueryNotice,
  StatusLabel,
  statusName,
  ownerName,
  formatDate as date,
  formatPercent as percent,
  humanize as label,
} from '@/components/platform/real-experience/presentation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import * as hooks from '@/hooks/use-real-experience';
import {
  experienceHeadline,
  orderExperienceIncidents,
  experienceDiagnosticPath,
  experienceRowHasVolume,
} from '@/components/platform/real-experience/evidence';
import type {
  ExperienceAction,
  ExperienceIncident,
  ExperiencePolicy,
  ExperienceClient,
  ExperienceRollup,
  ExperienceEvidencePage,
  ExperienceRun,
  ExperienceEventEvidence,
  ExperienceContentFailure,
  IncidentCloseReason,
} from '@/types/platform/real-experience';
import { ReleaseComparison } from '@/components/platform/real-experience/release-comparison';
import { RelatedExperienceEvidence } from '@/components/platform/real-experience/related-evidence';

const inputClass =
  'mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}
const views = ['overview', 'evidence', 'activity', 'settings'] as const;
const clients = [
  { value: 'ios', title: 'iOS', Icon: Smartphone },
  { value: 'android', title: 'Android', Icon: Smartphone },
  { value: 'web', title: 'Web preview', Icon: Monitor },
] as const;
const policyFields: {
  key: keyof ExperiencePolicy;
  title: string;
  max: number;
}[] = [
  { key: 'min_sample_floor', title: 'Rate sample floor', max: 100000 },
  { key: 'latency_sample_floor', title: 'Latency sample floor', max: 100000 },
  { key: 'confirm_windows', title: 'Adjacent bad hours to confirm', max: 24 },
  { key: 'resolve_windows', title: 'Adjacent clean hours to resolve', max: 24 },
  {
    key: 'telemetry_freshness_minutes',
    title: 'Collection freshness (minutes)',
    max: 1440,
  },
  { key: 'raw_retention_days', title: 'Raw retention (days)', max: 30 },
  {
    key: 'minute_rollup_retention_hours',
    title: 'Minute trends (hours)',
    max: 168,
  },
  {
    key: 'hour_rollup_retention_days',
    title: 'Hourly history (days)',
    max: 730,
  },
  { key: 'max_release_cohorts', title: 'Retained release cohorts', max: 8 },
];
function RealExperienceWorkspace() {
  const search = useSearchParams();
  const pathname = usePathname();
  const client: ExperienceClient =
    clients.find((item) => item.value === search.get('client'))?.value || 'web';
  const view = views.find((item) => item === search.get('tab')) || 'overview';
  const navigate = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };
  const status = hooks.useExperienceStatus();
  const metrics = hooks.useExperienceMetrics(client);
  const incidents = hooks.useExperienceIncidents(client);
  const runs = hooks.useExperienceRuns();
  const actions = hooks.useExperienceActions(client);
  const suppressions = hooks.useExperienceSuppressions(client);
  const update = hooks.useUpdateExperiencePolicy();
  const run = hooks.useRunExperienceNow();
  const pause = hooks.usePauseExperienceSchedule();
  const close = hooks.useCloseExperienceIncident();
  const create = hooks.useCreateExperienceSuppression();
  const revoke = hooks.useRevokeExperienceSuppression();
  const { user } = useAuth();
  const canManage =
    user?.role === 'admin' ||
    user?.permissions?.includes('feed:manage') ||
    user?.permissions?.includes('*:*') ||
    user?.permissions?.includes('*');
  const policy = status.data?.policy;
  const enabled = policy?.enabled_surfaces.split(',').filter(Boolean) || [];
  const head = experienceHeadline(
    metrics.data?.surfaces,
    enabled,
    status.isError || metrics.isError
  );
  const sorted = orderExperienceIncidents(incidents.data || []);
  const top = sorted.find((incident) => Boolean(incident.confirmed_at));
  const [tab, setTab] = useState<'cohorts' | 'releases' | 'history'>('cohorts');
  const [range, setRange] = useState('24');
  const [resolution, setResolution] = useState('hour');
  const [cursor, setCursor] = useState('');
  const [rangeEnd] = useState(() => new Date().toISOString());
  const evidence = hooks.useExperienceEvidence<
    ExperienceEvidencePage<ExperienceRollup>
  >(view === 'evidence' ? tab : null, undefined, {
    client_platform: client,
    start: new Date(
      new Date(rangeEnd).getTime() - Number(range) * 3600000
    ).toISOString(),
    end: rangeEnd,
    resolution,
    ...(cursor ? { before_id: cursor } : {}),
  });
  const [selected, setSelected] = useState<{
    kind: 'incident' | 'run';
    id: string;
  } | null>(null);
  const detail = hooks.useExperienceEvidence<{
    incident?: ExperienceIncident;
    run?: ExperienceRun;
    actions: ExperienceAction[];
  }>(selected?.kind || null, selected?.id, { client_platform: client });
  const [debug, setDebug] = useState(false);
  const events = hooks.useExperienceEvidence<ExperienceEventEvidence[]>(
    debug && view === 'evidence' ? 'events' : null,
    undefined,
    { client_platform: client }
  );
  const contentFailures = hooks.useExperienceEvidence<
    ExperienceContentFailure[]
  >(debug && view === 'evidence' ? 'content-failures' : null, undefined, {
    client_platform: client,
  });
  const [editing, setEditing] = useState<Partial<ExperiencePolicy> | null>(
    null
  );
  const [exception, setException] = useState<{
    kind: 'close' | 'suppress';
    incident: ExperienceIncident;
  } | null>(null);
  const [reason, setReason] = useState<IncidentCloseReason>(
    'resolved_externally'
  );
  const [notes, setNotes] = useState('');
  const [ttl, setTTL] = useState(60);
  const [controlError, setControlError] = useState('');
  const saveException = async () => {
    if (!exception) return;
    setControlError('');
    try {
      if (exception.kind === 'close')
        await close.mutateAsync({
          id: exception.incident.id,
          reason_class: reason,
          notes,
        });
      else
        await create.mutateAsync({
          client_platform: exception.incident.client_platform || client,
          metric_key: exception.incident.metric_key,
          surface: exception.incident.surface,
          cohort_dim: exception.incident.cohort_dim,
          cohort_val: exception.incident.cohort_val,
          reason: notes,
          ttl_minutes: ttl,
        });
      setException(null);
    } catch (error) {
      setControlError((error as Error).message);
    }
  };
  const loading = status.isLoading || metrics.isLoading;
  const unavailable = status.isError || metrics.isError;
  const collecting =
    metrics.data?.client_enabled !== false && policy?.ingest_enabled !== false;
  const paused = Boolean(
    policy?.paused_until && new Date(policy.paused_until).getTime() > Date.now()
  );
  const selectedIncident =
    selected?.kind === 'incident'
      ? detail.data?.incident || sorted.find((item) => item.id === selected.id)
      : undefined;
  const beginException = (
    kind: 'close' | 'suppress',
    incident: ExperienceIncident
  ) => {
    setSelected(null);
    setException({ kind, incident });
    setNotes('');
    setControlError('');
  };
  const reload = () =>
    void Promise.all([
      status.refetch(),
      metrics.refetch(),
      incidents.refetch(),
      runs.refetch(),
      actions.refetch(),
      suppressions.refetch(),
      ...(view === 'evidence' ? [evidence.refetch()] : []),
      ...(view === 'evidence' && debug
        ? [events.refetch(), contentFailures.refetch()]
        : []),
    ]);
  const statusTitle = loading
    ? 'Loading experience evidence'
    : unavailable
      ? 'Evidence unavailable'
      : !collecting
        ? 'Collection disabled'
        : statusName(head.tone);
  const StatusIcon =
    head.tone === 'healthy' && collecting && !unavailable
      ? CheckCircle2
      : ['critical', 'degraded', 'telemetry_degraded'].includes(head.tone)
        ? AlertCircle
        : Circle;
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Real Experience
          </h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Reliability of real Pods and News journeys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Reload"
            onClick={reload}
            disabled={status.isFetching || metrics.isFetching}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reload</span>
          </Button>
          <Button
            size="sm"
            aria-label="Evaluate all clients"
            title="Evaluates completed windows for all clients enabled in policy."
            disabled={!canManage || run.isPending || !policy || status.isError}
            onClick={() => run.mutate()}
          >
            <span className="sm:hidden">
              {run.isPending ? 'Evaluating…' : 'Evaluate'}
            </span>
            <span className="hidden sm:inline">
              {run.isPending ? 'Evaluating…' : 'Evaluate all clients'}
            </span>
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Experience platform"
          className="inline-flex rounded-md border bg-muted/40 p-1"
        >
          {clients.map(({ value, title, Icon }) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              aria-pressed={client === value}
              className={
                client === value
                  ? 'bg-background text-foreground shadow-sm hover:bg-background'
                  : 'text-muted-foreground'
              }
              onClick={() => {
                navigate('client', value);
                setCursor('');
                setSelected(null);
                setException(null);
              }}
            >
              <Icon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              {title}
            </Button>
          ))}
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {client === 'web'
            ? 'Web preview · Mirrors Mobile'
            : `Wahb-Mobile · ${client === 'ios' ? 'iOS' : 'Android'} · Primary interface`}
        </p>
      </div>
      <Tabs value={view} onValueChange={(value) => navigate('tab', value)}>
        <TabsList
          aria-label="Experience workspace"
          className="mb-4 flex h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0"
        >
          {views.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="relative rounded-none border-b-2 border-transparent px-3 py-2.5 capitalize shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-4"
            >
              {value[0].toUpperCase() + value.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-0 space-y-5">
          <section
            aria-label="Experience summary"
            className="rounded-lg border bg-card"
          >
            <div className="flex items-start gap-3 p-4 sm:p-5">
              <StatusIcon
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${head.tone === 'healthy' && collecting && !unavailable ? 'text-emerald-700 dark:text-emerald-400' : ['critical', 'degraded'].includes(head.tone) ? 'text-destructive' : 'text-muted-foreground'}`}
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{statusTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {!collecting && !unavailable
                    ? 'Collection is disabled for this platform. Enable it in policy after qualification.'
                    : client === 'web'
                      ? head.text
                      : head.text.replace(/\bweb\b/g, 'native')}
                </p>
                {!loading &&
                  !unavailable &&
                  (!collecting ||
                    ['insufficient_data', 'telemetry_degraded'].includes(
                      head.tone
                    )) && (
                    <button
                      className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => navigate('tab', 'settings')}
                    >
                      Review collection settings
                    </button>
                  )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t bg-muted/20 px-4 py-3 text-xs sm:grid-cols-3 sm:px-5">
              <div>
                <dt className="text-muted-foreground">Collection</dt>
                <dd className="mt-1 font-medium">
                  {loading
                    ? 'Loading…'
                    : unavailable
                      ? 'Unavailable'
                      : !collecting
                        ? 'Disabled'
                        : metrics.data?.telemetry_fresh
                          ? 'Fresh evidence'
                          : 'Stale or absent'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scheduled evaluation</dt>
                <dd className="mt-1 font-medium">
                  {status.isError
                    ? 'Unavailable'
                    : !policy
                      ? 'Loading…'
                      : paused
                        ? 'Paused'
                        : policy.evaluation_enabled
                          ? 'Enabled'
                          : 'Off'}{' '}
                  · Observe
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-muted-foreground">Decision window · UTC</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {metrics.data?.bucket
                    ? `${new Date(metrics.data.bucket).toISOString().slice(0, 16).replace('T', ' ')} – ${new Date(new Date(metrics.data.bucket).getTime() + 3600000).toISOString().slice(11, 16)}`
                    : 'No completed window'}
                </dd>
              </div>
            </dl>
          </section>
          <QueryNotice
            loading={loading}
            error={unavailable}
            data={Boolean(metrics.data)}
            retry={reload}
          />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <div className="min-w-0 space-y-5">
              {top && (
                <section
                  aria-label="Recommended next step"
                  className="border-l-2 border-amber-500 bg-amber-50/50 py-3 pl-4 pr-3 dark:bg-amber-950/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold">
                        Recommended next step
                      </h2>
                      <p className="mt-1 text-sm">{top.recommendation}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ownerName(top.likely_owner)} ·{' '}
                        {Number(top.evidence?.affected_sessions || 0)} affected{' '}
                        {client === 'web' ? 'tabs' : 'app sessions'}
                        {incidents.isError ? ' · Last-known incident' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelected({ kind: 'incident', id: top.id })
                      }
                    >
                      Investigate
                      <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </section>
              )}
              <section
                aria-label="Needs attention"
                className="min-w-0 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
                  <h2 className="font-semibold">Needs attention</h2>
                  <span className="text-xs text-muted-foreground">
                    {incidents.isError
                      ? 'Unavailable'
                      : incidents.isLoading
                        ? 'Loading…'
                        : `${sorted.length} open ${sorted.length === 1 ? 'incident' : 'incidents'}`}
                  </span>
                </div>
                <div className="px-4 sm:px-5">
                  <QueryNotice
                    loading={incidents.isLoading}
                    error={incidents.isError}
                    data={Boolean(incidents.data)}
                    retry={() => void incidents.refetch()}
                  />
                  {!incidents.isLoading &&
                    !incidents.isError &&
                    !sorted.length && (
                      <EmptyEvidence title="No open incidents in the current evidence.">
                        This is the recorded incident queue. Journey health
                        still depends on sufficient current measurements.
                      </EmptyEvidence>
                    )}
                  <div className="divide-y">
                    {sorted.map((inc) => (
                      <button
                        key={inc.id}
                        className="group flex w-full items-start gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          setSelected({ kind: 'incident', id: inc.id })
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                            {inc.summary}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {label(inc.surface)} · {inc.cohort_dim}:{' '}
                            {inc.cohort_val} · {ownerName(inc.likely_owner)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <StatusLabel value={inc.severity} />
                            <span className="text-xs text-muted-foreground">
                              {inc.confirmed_at
                                ? `${inc.clean_streak}/${policy?.resolve_windows || 3} clean recovery hours`
                                : `${inc.violation_streak}/${policy?.confirm_windows || 2} hours to confirm`}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold tabular-nums">
                            {Number(
                              inc.evidence?.affected_sessions || 0
                            ).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            affected {client === 'web' ? 'tabs' : 'sessions'}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden="true"
                          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:grid-cols-1">
              {enabled.map((surface) => (
                <SurfaceEvidence
                  key={`${client}:${surface}`}
                  surface={surface}
                  value={metrics.data?.surfaces[surface]}
                  client={client}
                  policy={policy}
                  unavailable={unavailable}
                />
              ))}
            </div>
          </div>
          {!enabled.length && !loading && !status.isError && (
            <EmptyEvidence title="No monitored journeys">
              Choose Pods, News or both in Settings to establish the monitoring
              scope.
            </EmptyEvidence>
          )}
          <RelatedExperienceEvidence />
        </TabsContent>
        <TabsContent value="evidence" className="mt-0 space-y-5">
          <Panel title="Cohorts, releases and history">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value as typeof tab);
                setCursor('');
              }}
            >
              <TabsList aria-label="Evidence type">
                {(['cohorts', 'releases', 'history'] as const).map((kind) => (
                  <TabsTrigger key={kind} value={kind} className="capitalize">
                    {kind[0].toUpperCase() + kind.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <QueryNotice
              loading={evidence.isLoading}
              error={evidence.isError}
              data={Boolean(evidence.data)}
              retry={() => void evidence.refetch()}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="min-w-[150px] flex-1 sm:flex-none">
                Evidence range
                <select
                  className={inputClass}
                  value={range}
                  onChange={(event) => {
                    setRange(event.target.value);
                    setCursor('');
                  }}
                >
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="9600">400 days</option>
                </select>
              </label>
              <label className="min-w-[150px] flex-1 sm:flex-none">
                Resolution
                <select
                  className={inputClass}
                  value={resolution}
                  onChange={(event) => {
                    setResolution(event.target.value);
                    setCursor('');
                  }}
                >
                  <option value="hour">Decision hours</option>
                  <option value="minute">Minute trends</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Completed windows, one dimension per row. Releases are evidence
              only; compare the same window and metric with sufficient
              denominators. Sparse releases are unqualified. Evidence as of{' '}
              {date(rangeEnd)}.
            </p>
            {tab === 'releases' && (
              <ReleaseComparison value={evidence.data?.release_comparison} />
            )}
            {Boolean(evidence.data?.rows.length) && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        'Window',
                        'Journey',
                        'Cohort',
                        'Outcome ratio',
                        client === 'web'
                          ? 'Affected tabs'
                          : 'Affected app sessions',
                        'Evidence',
                      ].map((h) => (
                        <th
                          key={h}
                          className="border-b bg-muted/30 p-3 text-xs font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.data?.rows.map((row) => (
                      <tr
                        key={`${row.bucket_start}:${row.metric_key}:${row.surface}:${row.cohort_dim}:${row.cohort_val}`}
                      >
                        <td className="border-b p-3 align-top">
                          {date(row.bucket_start)}
                        </td>
                        <td className="border-b p-3 align-top">
                          {row.surface} · {label(row.metric_key)}
                        </td>
                        <td className="border-b p-3 align-top">
                          {row.cohort_dim}: {row.cohort_val}
                        </td>
                        <td className="border-b p-3 align-top">
                          {row.numerator}/{row.denominator} ·{' '}
                          {row.denominator
                            ? percent(row.numerator / row.denominator)
                            : 'Unavailable'}
                        </td>
                        <td className="border-b p-3 align-top">
                          {row.affected_sessions}/{row.active_sessions}
                        </td>
                        <td className="border-b p-3 align-top">
                          {experienceRowHasVolume(
                            row,
                            policy?.min_sample_floor || 50
                          )
                            ? 'Sufficient rate volume'
                            : 'Insufficient data'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!evidence.isLoading &&
              !evidence.isError &&
              !evidence.data?.rows.length && (
                <EmptyEvidence title="No evidence in this range">
                  Choose a wider range or another client. Missing outcomes do
                  not establish health.
                </EmptyEvidence>
              )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!cursor}
                onClick={() => setCursor('')}
              >
                Newest evidence
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !evidence.data?.next_before_id ||
                  evidence.data.rows.length < 50
                }
                onClick={() => setCursor(String(evidence.data?.next_before_id))}
              >
                Older evidence
              </Button>
            </div>
          </Panel>
          <details onToggle={(event) => setDebug(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm">
              Sanitized debug evidence
            </summary>
            <QueryNotice
              loading={events.isLoading}
              error={events.isError || contentFailures.isError}
              data={Boolean(events.data)}
            />
            <p className="my-2 text-xs">
              Bounded 24-hour raw evidence; expires under the raw-retention
              policy.
            </p>
            {contentFailures.data?.map((item) => (
              <p key={item.content_id}>
                {item.content_id}: {item.failures} failures /{' '}
                {item.affected_sessions} affected{' '}
                {client === 'web' ? 'tabs' : 'app sessions'}
              </p>
            ))}
            <pre className="max-h-80 overflow-auto text-xs">
              {JSON.stringify(events.data, null, 2)}
            </pre>
          </details>
        </TabsContent>
        <TabsContent value="activity" className="mt-0 space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Evaluation history — all enabled clients">
              <QueryNotice
                loading={runs.isLoading}
                error={runs.isError}
                data={Boolean(runs.data)}
              />
              {!runs.isLoading && !runs.isError && !runs.data?.length && (
                <EmptyEvidence title="No evaluations recorded">
                  Run an evaluation when collection has qualified evidence. This
                  history covers all enabled clients.
                </EmptyEvidence>
              )}
              {runs.data?.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  className="block w-full border-b py-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelected({ kind: 'run', id: item.id })}
                >
                  {date(item.started_at)} · {item.status} ·{' '}
                  {item.buckets_processed} decision windows
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {item.summary || item.error}
                  </span>
                </button>
              ))}
            </Panel>
            <Panel title="Action history">
              <QueryNotice
                loading={actions.isLoading}
                error={actions.isError}
                data={Boolean(actions.data)}
              />
              {!actions.isLoading &&
                !actions.isError &&
                !actions.data?.length && (
                  <EmptyEvidence title="No actions recorded">
                    Evaluations and reviewed administrative decisions will
                    appear here.
                  </EmptyEvidence>
                )}
              {actions.data?.slice(0, 15).map((action) => (
                <p key={action.id} className="border-b pb-2">
                  {action.label}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {date(action.created_at)} · {label(action.action_class)} ·{' '}
                    {action.guardrail}
                  </span>
                </p>
              ))}
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="settings" className="mt-0 space-y-5">
          <Panel title="Observe policy">
            <p>
              CMS owns the decisions. These controls never alter feed or
              playback behavior.
            </p>
            <QueryNotice
              loading={status.isLoading}
              error={status.isError}
              data={Boolean(status.data)}
              retry={() => void status.refetch()}
            />
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Collection policy</dt>
                <dd className="mt-1 font-medium">
                  {policy
                    ? policy.ingest_enabled
                      ? 'Enabled'
                      : 'Disabled'
                    : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Clients allowed to collect
                </dt>
                <dd className="mt-1 font-medium">
                  {policy
                    ? (policy.enabled_clients ?? 'web')
                        .split(',')
                        .filter(Boolean)
                        .map((value) =>
                          value === 'web'
                            ? 'Web preview'
                            : value === 'ios'
                              ? 'iOS'
                              : 'Android'
                        )
                        .join(', ') || 'None'
                    : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Confirmation / recovery
                </dt>
                <dd className="mt-1 font-medium">
                  {policy
                    ? `${policy.confirm_windows} bad / ${policy.resolve_windows} clean hours`
                    : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Rate / latency sample floor
                </dt>
                <dd className="mt-1 font-medium">
                  {policy
                    ? `${policy.min_sample_floor} / ${policy.latency_sample_floor} outcomes`
                    : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Last hourly checkpoint
                </dt>
                <dd className="mt-1 font-medium">
                  {date(policy?.last_evaluated_bucket)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Last minute checkpoint
                </dt>
                <dd className="mt-1 font-medium">
                  {date(policy?.last_minute_bucket)}
                </dd>
              </div>
            </dl>
            {paused && (
              <p className="text-sm">
                Schedule paused until {date(policy?.paused_until)}.
              </p>
            )}
            {!canManage && (
              <p>
                Read only — feed:manage permission is required for controls.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canManage || !policy || status.isError}
                onClick={() => {
                  setEditing({ ...policy });
                  setControlError('');
                }}
              >
                Edit policy and thresholds
              </Button>
              <Button
                variant="outline"
                disabled={
                  !canManage || pause.isPending || !policy || status.isError
                }
                onClick={() => pause.mutate(paused ? 0 : 60)}
              >
                {paused ? 'Resume schedule' : 'Pause schedule for 60 minutes'}
              </Button>
            </div>
            <h3 className="border-t pt-4 font-medium">
              Active suppressions ·{' '}
              {client === 'web'
                ? 'Web preview'
                : client === 'ios'
                  ? 'iOS'
                  : 'Android'}
            </h3>
            {!suppressions.isLoading &&
              !suppressions.isError &&
              !suppressions.data?.length && (
                <p className="text-muted-foreground">
                  No active suppressions for this client.
                </p>
              )}
            <QueryNotice
              loading={suppressions.isLoading}
              error={suppressions.isError}
              data={Boolean(suppressions.data)}
            />
            {suppressions.data?.map((sup) => (
              <div key={sup.id} className="border-t pt-2">
                <p>
                  {label(sup.metric_key)} · {sup.surface} · {sup.cohort_dim}:{' '}
                  {sup.cohort_val}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sup.reason} · by {sup.created_by} · expires{' '}
                  {date(sup.expires_at)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    !canManage || revoke.isPending || suppressions.isError
                  }
                  onClick={() => revoke.mutate(sup.id)}
                >
                  Revoke suppression
                </Button>
              </div>
            ))}
          </Panel>
        </TabsContent>
      </Tabs>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          hasAccessibleHeader
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="pr-6 text-left">
            <SheetTitle>
              {selectedIncident?.summary ||
                (selected?.kind === 'run'
                  ? 'Evaluation details'
                  : 'Incident details')}
            </SheetTitle>
            <SheetDescription>
              {client === 'web'
                ? 'Web preview'
                : client === 'ios'
                  ? 'Wahb-Mobile · iOS'
                  : 'Wahb-Mobile · Android'}
              {selected?.kind === 'run'
                ? ' · Evaluation covers all enabled clients'
                : ' · Exact incident scope'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <QueryNotice
              loading={detail.isLoading}
              error={detail.isError}
              data={Boolean(detail.data)}
              retry={() => void detail.refetch()}
            />
            {selectedIncident && (
              <>
                <div className="flex flex-wrap gap-4">
                  <StatusLabel value={selectedIncident.severity} />
                  <StatusLabel value={selectedIncident.status} />
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm [&>div]:min-w-0 [&_dd]:break-words">
                  <div>
                    <dt className="text-muted-foreground">Journey</dt>
                    <dd className="mt-1 font-medium">
                      {label(selectedIncident.surface)} ·{' '}
                      {label(selectedIncident.metric_key)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cohort</dt>
                    <dd className="mt-1 font-medium">
                      {selectedIncident.cohort_dim}:{' '}
                      {selectedIncident.cohort_val}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">User impact</dt>
                    <dd className="mt-1 font-medium">
                      {Number(
                        selectedIncident.evidence?.affected_sessions || 0
                      )}{' '}
                      affected /{' '}
                      {Number(selectedIncident.evidence?.active_sessions || 0)}{' '}
                      active {client === 'web' ? 'tabs' : 'app sessions'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Likely owner</dt>
                    <dd className="mt-1 font-medium">
                      {ownerName(selectedIncident.likely_owner)}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-muted-foreground">First observed</dt>
                    <dd className="mt-1">
                      {date(selectedIncident.first_seen_at)}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-muted-foreground">Last breach</dt>
                    <dd className="mt-1">
                      {date(selectedIncident.last_seen_at)}
                    </dd>
                  </div>
                </dl>
                <section className="space-y-2 border-y py-4 text-sm">
                  <h3 className="font-semibold">Recommended next step</h3>
                  <p>{selectedIncident.recommendation}</p>
                  {experienceDiagnosticPath(
                    selectedIncident.investigation_path
                  ) && (
                    <Link
                      className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                      href={
                        selectedIncident.investigation_path ===
                        '/platform/real-experience'
                          ? `/platform/real-experience?client=${client}&tab=evidence`
                          : experienceDiagnosticPath(
                              selectedIncident.investigation_path
                            )!
                      }
                      onClick={() => setSelected(null)}
                    >
                      {selectedIncident.investigation_path ===
                      '/platform/real-experience'
                        ? 'Open experience evidence'
                        : 'Open owning diagnostic surface'}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  )}
                </section>
                <section className="space-y-2 text-sm">
                  <h3 className="font-semibold">
                    {selectedIncident.confirmed_at
                      ? 'Measured recovery'
                      : 'Confirmation progress'}
                  </h3>
                  <p>
                    {selectedIncident.confirmed_at
                      ? `${selectedIncident.clean_streak}/${policy?.resolve_windows || 3} adjacent clean hours`
                      : `${selectedIncident.violation_streak}/${policy?.confirm_windows || 2} adjacent bad hours`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last evaluated{' '}
                    {date(selectedIncident.last_evaluated_bucket)}. Human
                    closure is separate from measured recovery.
                  </p>
                </section>
                <details className="border-t pt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Administrative decisions
                  </summary>
                  <p className="my-3 text-xs text-muted-foreground">
                    Close with a reason, or temporarily suppress only this
                    metric and cohort. These decisions do not repair the
                    experience.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['close', 'suppress'] as const).map((kind) => (
                      <Button
                        key={kind}
                        size="sm"
                        variant="outline"
                        disabled={
                          !canManage || incidents.isError || detail.isError
                        }
                        onClick={() => beginException(kind, selectedIncident)}
                      >
                        {kind === 'close'
                          ? 'Close with reason'
                          : 'Suppress exact scope'}
                      </Button>
                    ))}
                  </div>
                </details>
              </>
            )}
            {detail.data?.run && (
              <section className="space-y-2 text-sm">
                <StatusLabel value={detail.data.run.status} />
                <p>{detail.data.run.summary || detail.data.run.error}</p>
                <p className="text-muted-foreground">
                  {date(detail.data.run.started_at)} ·{' '}
                  {detail.data.run.buckets_processed} decision windows
                </p>
              </section>
            )}
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Recorded actions</h3>
              {detail.data?.actions?.map((action) => (
                <div key={action.id} className="text-sm">
                  <p>{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {date(action.created_at)} · {action.guardrail}
                  </p>
                </div>
              ))}
              {detail.data && !detail.data.actions?.length && (
                <p className="text-sm text-muted-foreground">
                  No recorded actions for this evidence.
                </p>
              )}
            </section>
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Stored proof
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(
                  detail.data?.incident?.evidence ||
                    selectedIncident?.evidence ||
                    detail.data?.run,
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(exception)}
        onOpenChange={(open) => !open && setException(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {exception?.kind === 'close'
                ? 'Close incident with reason'
                : 'Suppress exact metric and cohort'}
            </DialogTitle>
            <DialogDescription>
              {exception?.incident.metric_key} · {exception?.incident.surface} ·{' '}
              {exception?.incident.cohort_dim}: {exception?.incident.cohort_val}
              .{' '}
              {exception?.kind === 'close'
                ? 'Closure is a human decision, not recovery proof.'
                : 'Only this client, metric and cohort will be suppressed until expiry.'}
            </DialogDescription>
          </DialogHeader>
          {exception?.kind === 'close' ? (
            <label>
              Reason
              <select
                className={`${inputClass} block w-full`}
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as IncidentCloseReason)
                }
              >
                {(
                  [
                    'resolved_externally',
                    'expected_behavior',
                    'false_positive',
                    'accepted_risk',
                  ] as const
                ).map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Expiry (minutes)
              <input
                className={`${inputClass} block w-full`}
                type="number"
                min={1}
                max={10080}
                value={ttl}
                onChange={(e) => setTTL(Number(e.target.value))}
              />
            </label>
          )}
          <label>
            Notes
            <textarea
              rows={4}
              className={`${inputClass} block w-full`}
              maxLength={exception?.kind === 'close' ? 2000 : 1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {controlError && (
            <p role="alert" className="text-destructive">
              {controlError}
            </p>
          )}
          <Button
            disabled={
              !notes.trim() || close.isPending || create.isPending || !canManage
            }
            onClick={() => void saveException()}
          >
            Save reviewed exception
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Observe policy</DialogTitle>
            <DialogDescription>
              Thresholds require baseline qualification. No critical bypass or
              automatic remediation is enabled.
            </DialogDescription>
          </DialogHeader>
          <form
            className="max-h-[65vh] space-y-4 overflow-auto"
            onSubmit={async (event) => {
              event.preventDefault();
              setControlError('');
              try {
                const {
                  ingest_enabled,
                  evaluation_enabled,
                  enabled_surfaces,
                  enabled_clients,
                  min_sample_floor,
                  latency_sample_floor,
                  confirm_windows,
                  resolve_windows,
                  telemetry_freshness_minutes,
                  raw_retention_days,
                  minute_rollup_retention_hours,
                  hour_rollup_retention_days,
                  max_release_cohorts,
                  thresholds,
                } = editing!;
                await update.mutateAsync({
                  ingest_enabled,
                  evaluation_enabled,
                  enabled_surfaces,
                  enabled_clients,
                  min_sample_floor,
                  latency_sample_floor,
                  confirm_windows,
                  resolve_windows,
                  telemetry_freshness_minutes,
                  raw_retention_days,
                  minute_rollup_retention_hours,
                  hour_rollup_retention_days,
                  max_release_cohorts,
                  thresholds,
                });
                setEditing(null);
              } catch (error) {
                setControlError((error as Error).message);
              }
            }}
          >
            {(['ingest_enabled', 'evaluation_enabled'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing?.[key])}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, [key]: e.target.checked }))
                  }
                />
                {key === 'ingest_enabled'
                  ? 'Collect journey outcomes'
                  : 'Run scheduled evaluations'}
              </label>
            ))}
            <label className="block text-sm">
              Monitored journeys
              <select
                className={inputClass}
                value={editing?.enabled_surfaces}
                onChange={(e) =>
                  setEditing((v) => ({
                    ...v,
                    enabled_surfaces: e.target.value,
                  }))
                }
              >
                <option value="pods,news">Pods and News</option>
                <option value="pods">Pods</option>
                <option value="news">News</option>
              </select>
            </label>
            <fieldset className="space-y-3 border-y py-4 text-sm">
              <legend className="font-medium">
                Clients allowed to collect (Mobile is primary)
              </legend>
              {(['ios', 'android', 'web'] as const).map((platform) => (
                <label key={platform} className="mr-4 inline-flex gap-2">
                  <input
                    type="checkbox"
                    checked={(editing?.enabled_clients ?? 'web')
                      .split(',')
                      .includes(platform)}
                    onChange={(event) =>
                      setEditing((value) => {
                        const clients = new Set(
                          (value?.enabled_clients ?? 'web').split(',')
                        );
                        if (event.target.checked) clients.add(platform);
                        else clients.delete(platform);
                        return {
                          ...value,
                          enabled_clients: [...clients].join(','),
                        };
                      })
                    }
                  />
                  {platform === 'web'
                    ? 'Web preview'
                    : platform === 'ios'
                      ? 'iOS'
                      : 'Android'}
                </label>
              ))}
            </fieldset>
            <h3 className="pt-2 text-sm font-semibold">
              Evidence and retention
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {policyFields.map((field) => (
                <label key={field.key}>
                  {field.title}
                  <input
                    className={`${inputClass} block w-full`}
                    required
                    type="number"
                    min={1}
                    max={field.max}
                    value={Number(editing?.[field.key] || 1)}
                    onChange={(e) =>
                      setEditing((v) => ({
                        ...v,
                        [field.key]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <details>
              <summary>Named SLO thresholds</summary>
              {Array.from(
                new Map(
                  Object.values(metrics.data?.surfaces || {})
                    .flatMap((surface) => surface.slis)
                    .map((sli) => [sli.metric, sli])
                ).values()
              ).map((sli) => (
                <div key={sli.metric} className="mt-3 grid grid-cols-2 gap-3">
                  <label>
                    {sli.label} target ratio
                    <input
                      className={`${inputClass} block w-full`}
                      type="number"
                      min={0}
                      max={1}
                      step={0.0001}
                      value={
                        editing?.thresholds?.[sli.metric]?.target ?? sli.target
                      }
                      onChange={(e) =>
                        setEditing((v) => ({
                          ...v,
                          thresholds: {
                            ...v?.thresholds,
                            [sli.metric]: {
                              ...v?.thresholds?.[sli.metric],
                              target: Number(e.target.value),
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  {Boolean(sli.p75_budget_ms) && (
                    <label>
                      p75 budget (ms)
                      <input
                        className={`${inputClass} block w-full`}
                        type="number"
                        min={1}
                        max={600000}
                        value={
                          editing?.thresholds?.[sli.metric]?.latency_p75_ms ??
                          sli.p75_budget_ms
                        }
                        onChange={(e) =>
                          setEditing((v) => ({
                            ...v,
                            thresholds: {
                              ...v?.thresholds,
                              [sli.metric]: {
                                ...v?.thresholds?.[sli.metric],
                                latency_p75_ms: Number(e.target.value),
                              },
                            },
                          }))
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </details>
            {controlError && (
              <p role="alert" className="text-destructive">
                {controlError}
              </p>
            )}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={update.isPending}
                onClick={() => setEditing(null)}
              >
                Discard
              </Button>
              <Button
                type="submit"
                disabled={update.isPending || status.isError || !canManage}
              >
                {update.isPending ? 'Saving…' : 'Save policy'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RealExperiencePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Loading experience workspace…
        </p>
      }
    >
      <RealExperienceWorkspace />
    </Suspense>
  );
}
