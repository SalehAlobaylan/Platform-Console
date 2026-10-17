'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  RefreshCw,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Panel, StatusPill } from './economics-ui';
import {
  economicsAPI as api,
  type EconomicsPeriod,
  type EconomicsView,
  type EconomicsPolicy,
} from '@/lib/api/cms/platform-economics';
import {
  name,
  useEconomicsScope,
  usd,
  number,
  date,
  field,
  Problem,
  ResourceTable,
  Trend,
  Metric,
} from './platform-economics-shared';
import { Billing } from './platform-economics-billing';
import {
  Profiles,
  ContentPreparationRules,
} from './platform-economics-profiles';

export function PlatformEconomics({
  view,
  period,
}: {
  view: EconomicsView;
  period: EconomicsPeriod;
}) {
  const scope = useEconomicsScope();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('cost');
  const [cursor, setCursor] = useState<string | undefined>();
  const [dimension, setDimension] = useState('feature');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setCursor(undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setCursor(undefined), [period.from, period.to, sort]);
  useEffect(() => {
    setSelected(null);
    setSearch('');
    setQ('');
    setCursor(undefined);
  }, [scope]);
  const overview = useQuery({
    queryKey: ['platform-economics', scope, 'overview', period],
    queryFn: () => api.overview(period),
    enabled: view === 'overview',
    staleTime: 60000,
  });
  const needsDirectory = q.length >= 2 && !/^[0-9a-f-]+$/i.test(q);
  const identitySearch = useQuery({
    queryKey: ['platform-economics', scope, 'identity-search', q],
    queryFn: () => api.directory(q),
    enabled: view === 'users' && needsDirectory,
    gcTime: 0,
    staleTime: 60000,
  });
  const identityIds = identitySearch.data?.users.map((u) => u.id).join(',');
  const accounts = useQuery({
    queryKey: [
      'platform-economics',
      scope,
      'accounts',
      period,
      q,
      sort,
      cursor,
      identityIds,
    ],
    queryFn: () =>
      api.accounts(
        period,
        needsDirectory && identityIds ? '' : q,
        sort,
        cursor,
        needsDirectory ? identityIds : undefined
      ),
    enabled: view === 'users' && (!needsDirectory || !identitySearch.isPending),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 60000,
  });
  const pageIdentityIds =
    accounts.data?.accounts.map((a) => a.account_id) ?? [];
  const identities = useQuery({
    queryKey: ['platform-economics', scope, 'identity-labels', pageIdentityIds],
    queryFn: () => api.directory('', pageIdentityIds),
    enabled: view === 'users' && pageIdentityIds.length > 0,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 60000,
  });
  const identityNames = new Map(
    identities.data?.users.map((u) => [u.id, u.username || u.email]) ?? []
  );
  const detail = useQuery({
    queryKey: ['platform-economics', scope, 'account', selected, period],
    queryFn: () => api.account(selected!, period),
    enabled: !!selected,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 60000,
  });
  const breakdown = useQuery({
    queryKey: ['platform-economics', scope, 'breakdown', period, dimension],
    queryFn: () => api.breakdown(period, dimension),
    enabled: view === 'activity',
    staleTime: 60000,
  });
  const policy = useQuery({
    queryKey: ['platform-economics', scope, 'policy'],
    queryFn: api.policy,
    enabled: view === 'diagnostics' || view === 'overview',
  });
  const issues = useQuery({
    queryKey: ['platform-economics', scope, 'issues'],
    queryFn: api.issues,
    enabled: view === 'attention',
  });
  const coverage = useQuery({
    queryKey: ['platform-economics', scope, 'coverage'],
    queryFn: api.coverage,
    enabled: view === 'diagnostics',
  });
  const runs = useQuery({
    queryKey: ['platform-economics', scope, 'runs'],
    queryFn: api.runs,
    refetchInterval: 60000,
    enabled: view === 'diagnostics',
  });
  async function action<T>(
    work: () => Promise<T>,
    message: string | ((result: T) => string)
  ) {
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      await qc.invalidateQueries({ queryKey: ['platform-economics'] });
      setNotice(typeof message === 'function' ? message(result) : message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const data = overview.data;
  const report =
    view === 'overview'
      ? data
      : view === 'users'
        ? accounts.data
        : view === 'activity'
          ? breakdown.data
          : undefined;
  return (
    <div className="space-y-5">
      {error != null && <Problem error={error} />}{' '}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {report && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {report.environment || 'Unmapped environment'} · Effective UTC period{' '}
          {report.from.slice(0, 10)} to {report.to.slice(0, 10)} (exclusive) ·
          Data captured {date(report.as_of)} · Published{' '}
          {report.published_at ? date(report.published_at) : 'Unavailable'}
          {report.as_of &&
            Date.now() - new Date(report.as_of).getTime() > 20 * 60 * 1000 && (
              <span className="ml-2 font-medium text-amber-700">
                Older data snapshot; review Diagnostics
              </span>
            )}
          {report.from.slice(0, 10) !== period.from && (
            <span className="mt-1 block">
              Older history uses complete calendar months. {report.period_note}
            </span>
          )}
        </p>
      )}
      {view === 'overview' && (
        <Panel
          title="Platform economics"
          description="Known spending across Wahb, with direct account costs and supported shared estimates."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !policy.data?.reports_enabled}
              onClick={() =>
                void action(api.run, (result) =>
                  result.published
                    ? 'Published updated economics reports'
                    : 'Report build checkpoint saved. The previous complete report remains visible; background work will continue.'
                )
              }
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Update report
            </Button>
          }
        >
          {overview.isError ? (
            <Problem error={overview.error} />
          ) : overview.isPending ? (
            <p className="text-sm text-muted-foreground">
              Loading platform costs…
            </p>
          ) : (
            data && (
              <>
                {!policy.data?.reports_enabled && (
                  <p className="mb-4 rounded-md border px-3 py-2 text-sm">
                    Reporting is off. Enable qualified sources and collection in
                    Diagnostics to start building evidence.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                  <Metric
                    title="Known platform subtotal"
                    value={usd(data.total.total)}
                    note="Partial coverage · excludes unavailable costs"
                  />
                  <Metric
                    title="Observed accounts with costs"
                    value={number(data.distribution.count)}
                    note="Costs and usage have independent coverage"
                  />
                  <Metric
                    title="Median supported account cost"
                    value={usd(data.distribution.median)}
                    note="Direct + allocated shared estimate"
                  />
                  <Metric
                    title="Upper account cost (p90)"
                    value={usd(data.distribution.p90)}
                    note="At least 30 observed accounts with supported costs"
                  />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Before credits / free allowances:{' '}
                  {usd(data.total.before_benefits)} · same usage under supported
                  contract pricing; separate from net spending.
                </p>
                <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                  <ResourceTable rows={data.resources} />
                  <div className="rounded-lg bg-muted/40 p-4">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Where the expense sits
                    </h3>
                    <dl className="mt-3 space-y-3">
                      {data.destinations.map((r) => (
                        <div
                          key={r.key}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <dt>{name(r.key)}</dt>
                          <dd className="font-medium tabular-nums">
                            {usd(r.total)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Public access and unattributed spending remain visible.
                      Allocated cost does not establish savings from removing an
                      account.
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <Trend rows={data.trend} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Data captured {date(data.as_of)} · {data.coverage} coverage ·
                  USD
                </p>
              </>
            )
          )}
        </Panel>
      )}
      {view === 'users' && (
        <Panel
          title="User economics"
          description="Find an account, understand its resource use, and investigate the supported cost drivers."
        >
          <div className="mb-5 flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search name, email or account ID"
                placeholder="Search name, email or account ID"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Sort accounts"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={field + ' w-auto'}
            >
              <option value="cost">Highest supported cost</option>
              <option value="requests">Most API requests</option>
              <option value="account">Account ID</option>
            </select>
          </div>
          {identitySearch.data?.has_more && (
            <p className="mb-3 text-xs text-muted-foreground">
              More than 100 identities match. Refine the name or email to
              include the intended accounts.
            </p>
          )}
          {needsDirectory && identitySearch.isError && (
            <p className="mb-3 text-xs text-muted-foreground">
              Identity search is unavailable. Account IDs and observed costs
              remain available.
            </p>
          )}
          {accounts.isError ? (
            <Problem error={accounts.error} />
          ) : accounts.isPending ? (
            <p className="py-10 text-sm text-muted-foreground">
              Loading observed accounts…
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      {[
                        'Account',
                        'Direct',
                        'Shared estimate',
                        'Supported cost',
                        'Main driver',
                        'API requests',
                        'Evidence',
                      ].map((n) => (
                        <th key={n} className="pb-3 pr-4 font-medium">
                          {n}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.data?.accounts.map((a) => (
                      <tr key={a.account_id} className="border-t">
                        <td className="py-4 pr-4">
                          <button
                            className="flex items-center gap-2 text-left font-mono text-xs hover:underline"
                            onClick={() => setSelected(a.account_id)}
                          >
                            <Users className="h-4 w-4 shrink-0" />
                            <span>
                              <span className="block font-sans text-sm font-medium">
                                {identityNames.get(a.account_id) ?? 'Account'}
                              </span>
                              {a.account_id}
                            </span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="py-4 pr-4 tabular-nums">
                          {usd(a.direct)}
                        </td>
                        <td className="py-4 pr-4 tabular-nums">
                          {usd(a.shared)}
                        </td>
                        <td className="py-4 pr-4 font-medium tabular-nums">
                          {usd(a.total)}
                        </td>
                        <td className="py-4 pr-4 tabular-nums">
                          {a.driver ? name(a.driver) : 'Unavailable'}
                        </td>
                        <td className="py-4 pr-4 tabular-nums">
                          {number(a.requests)}
                        </td>
                        <td className="py-4">
                          <span className="text-xs text-muted-foreground">
                            Partial ·{' '}
                            {a.reconciled ? 'source reconciled' : 'estimated'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {accounts.data?.accounts.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
                  <p className="font-medium">
                    No observed accounts in this period
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Account evidence appears after collection is enabled and
                    signed-in activity is received. Public access stays
                    aggregate.
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {number(accounts.data?.total ?? 0)} observed accounts ·
                  missing measurements can make accounts appear cheaper
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!cursor}
                    onClick={() => setCursor(undefined)}
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!accounts.data?.next_cursor}
                    onClick={() =>
                      setCursor(accounts.data?.next_cursor ?? undefined)
                    }
                  >
                    Next
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Panel>
      )}
      {view === 'activity' && (
        <Panel
          title="Feature & infrastructure costs"
          description="Alternative views of the same expenses; these amounts are not additional charges."
          action={
            <select
              aria-label="Group platform costs"
              className={field}
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
            >
              <option value="feature">By feature</option>
              <option value="resource">By resource</option>
              <option value="content">By content preparation</option>
            </select>
          }
        >
          {breakdown.isError ? (
            <Problem error={breakdown.error} />
          ) : breakdown.isPending ? (
            <p className="text-sm">Loading cost drivers…</p>
          ) : dimension === 'content' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-3">Content / story</th>
                    <th className="pb-3 text-right">Period preparation</th>
                    <th className="pb-3 text-right">Lifetime owner estimate</th>
                    <th className="pb-3 text-right">Observed consumption</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.data?.content?.map((r) => (
                    <tr key={r.key} className="border-t">
                      <td className="py-3 pr-3 font-mono text-xs">
                        {r.key}
                        <span className="block font-sans text-muted-foreground">
                          {name(r.kind)}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {usd(r.period)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {usd(r.lifetime_estimate)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {r.consumption ?? 'Unavailable'}
                        <span className="block text-xs text-muted-foreground">
                          {r.kind === 'news'
                            ? 'distinct opens'
                            : 'media-position seconds'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {breakdown.data?.note}
              </p>
            </div>
          ) : (
            <ResourceTable rows={breakdown.data?.rows ?? []} />
          )}
        </Panel>
      )}
      {view === 'billing' && (
        <Billing period={period} onAction={action} busy={busy} />
      )}
      {view === 'attention' && (
        <Panel
          title="Platform economics attention"
          description="Evidence-backed warnings for administrators. Higher user spending alone does not imply waste."
        >
          {issues.isError ? (
            <Problem error={issues.error} />
          ) : issues.isPending ? (
            <p className="text-sm">Checking issues…</p>
          ) : issues.data?.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published economics warnings. Check tracking coverage before
              assuming spending is healthy.
            </p>
          ) : (
            <div className="space-y-3">
              {issues.data?.issues.map((i) => (
                <div key={i.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{i.headline}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {name(i.kind)} · {i.scope} · observed{' '}
                        {date(i.last_seen_at)}
                      </p>
                    </div>
                    <StatusPill value={i.status} />
                  </div>
                  {i.evidence && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer">
                        Why this was flagged
                      </summary>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        {Object.entries(i.evidence).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-muted-foreground">
                              {name(key)}
                            </dt>
                            <dd className="mt-1 break-words">
                              {typeof value === 'number'
                                ? number(value)
                                : Array.isArray(value)
                                  ? value.join(', ') || 'None'
                                  : String(value ?? 'Unavailable')}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                  {i.status !== 'resolved' && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const reason = new FormData(e.currentTarget).get(
                          'reason'
                        );
                        if (typeof reason === 'string')
                          void action(
                            () => api.closeIssue(i.id, reason),
                            'Issue closed with recorded reason'
                          );
                      }}
                    >
                      <Input
                        name="reason"
                        aria-label="Reason for closing economics issue"
                        placeholder="Review / close reason"
                        required
                        minLength={3}
                      />
                      <Button size="sm" variant="outline" disabled={busy}>
                        Close
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
      {view === 'diagnostics' && (
        <>
          <Panel
            title="Economics collection & reporting"
            description="Independent controls. Collection adds bounded counters; reports retain the last coherent publication on failure."
          >
            {policy.isError ? (
              <Problem error={policy.error} />
            ) : (
              policy.data && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      'collection_enabled',
                      'reports_enabled',
                      'imports_enabled',
                      'allocation_enabled',
                    ] as const
                  ).map((k) => (
                    <label
                      key={k}
                      className="flex items-center justify-between rounded-md border px-4 py-3 text-sm"
                    >
                      <span>{name(k)}</span>
                      <input
                        type="checkbox"
                        checked={policy.data[k]}
                        disabled={busy}
                        onChange={(e) =>
                          void action(
                            () =>
                              api.savePolicy({
                                ...policy.data!,
                                [k]: e.target.checked,
                              } as EconomicsPolicy),
                            'Economics policy saved'
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              )
            )}
            <Button
              className="mt-4"
              variant="outline"
              disabled={busy || !policy.data?.reports_enabled}
              onClick={() =>
                void action(api.run, (result) =>
                  result.published
                    ? 'Updated economics reports'
                    : 'Report build checkpoint saved. The previous complete report remains visible; background work will continue.'
                )
              }
            >
              Run reporting now
            </Button>
          </Panel>
          <Panel
            title="Tracking coverage"
            description="Known gaps remain visible, including collector loss and unsupported billing attribution."
          >
            {coverage.isError ? (
              <Problem error={coverage.error} />
            ) : (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  Account lifecycle:{' '}
                  {coverage.data?.lifecycle_ready
                    ? 'synchronized'
                    : 'awaiting IAM proof'}{' '}
                  · {date(coverage.data?.lifecycle_synced_at)}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {coverage.data?.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                <dl className="mt-5 space-y-2">
                  {coverage.data?.collectors.map((c) => (
                    <div
                      key={c.source}
                      className="flex flex-wrap gap-x-5 gap-y-1 rounded-md border p-3 text-xs"
                    >
                      <dt className="font-medium">{c.source}</dt>
                      <dd>Last received {date(c.last_seen_at)}</dd>
                      <dd>
                        {number(c.known_lost)} discarded / uncertain counters
                      </dd>
                      <dd>{number(c.open_epochs)} open process epochs</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Panel>
          <Profiles busy={busy} onAction={action} />
          <ContentPreparationRules busy={busy} onAction={action} />
          <Panel
            title="Publication history"
            description="Failed runs keep the previous report, labeled with its actual publication time."
          >
            {runs.isError ? (
              <Problem error={runs.error} />
            ) : (
              <div className="space-y-2">
                {runs.data?.runs.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap justify-between gap-2 border-b pb-2 text-xs"
                  >
                    <span>{date(r.started_at)}</span>
                    <span>{r.rows} report rows</span>
                    <StatusPill value={r.status} />
                    {r.error && (
                      <p className="w-full text-muted-foreground">{r.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Account economics
              {selected && identityNames.has(selected)
                ? ` · ${identityNames.get(selected)}`
                : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              <span className="block break-all font-mono">{selected}</span>
              <span className="mt-1 block">
                {(detail.data?.from ?? period.from).slice(0, 10)} to{' '}
                {(detail.data?.to ?? period.to).slice(0, 10)} (UTC, end
                exclusive)
              </span>
            </DialogDescription>
          </DialogHeader>
          {detail.isError ? (
            <Problem error={detail.error} />
          ) : detail.isPending ? (
            <p className="py-8 text-sm text-muted-foreground">
              Loading account evidence…
            </p>
          ) : (
            detail.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 [&>div:first-child]:col-span-2 sm:[&>div:first-child]:col-span-1">
                  <Metric
                    title="Supported cost"
                    value={usd(detail.data.total.total)}
                    note="Partial coverage"
                  />
                  <Metric
                    title="Direct"
                    value={usd(detail.data.total.direct)}
                    note="Owner-attributed work"
                  />
                  <Metric
                    title="Shared estimate"
                    value={usd(detail.data.total.shared)}
                    note="Allocated common costs"
                  />
                </div>
                <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  {detail.data.note}
                </p>
                <ResourceTable
                  rows={detail.data.resources}
                  usage={detail.data.usage}
                />
                <div>
                  <h3 className="mb-3 text-sm font-medium">
                    Observed resource use
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {detail.data.usage.map((u) => (
                      <div
                        key={`${u.operation}:${u.unit}:${u.variant}`}
                        className="rounded-md border p-3"
                      >
                        <p className="text-xs text-muted-foreground">
                          {name(u.operation)}
                        </p>
                        <p className="mt-1 text-lg font-medium tabular-nums">
                          {number(u.value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {name(u.unit)}
                        </p>
                        {u.variant === 'preparation_owner_receipt' && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Shared preparation requested; costs belong to its
                            supported beneficiary pool
                          </p>
                        )}
                        {u.variant === 'preparation_owned_receipt' && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Owned content preparation; requester is unavailable.
                            Serving estimates exclude this work.
                          </p>
                        )}
                        {u.variant?.startsWith('elapsed:') && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Owned preparation; elapsed time includes IO and
                            waits
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {!detail.data.usage.length && (
                    <p className="text-sm text-muted-foreground">
                      No supported usage measurements in this period.
                    </p>
                  )}
                </div>
                <Trend rows={detail.data.trend} />
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Activities, efficiency & evidence
                  </summary>
                  <div className="mt-3">
                    <ResourceTable rows={detail.data.activities} />
                    {detail.data.requested_work?.length > 0 && (
                      <div className="mt-4 rounded-md border p-4">
                        <h4 className="text-sm font-medium">
                          Work this account initiated
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Owner-priced provenance, separate from the account
                          total. Shared work benefits public content and is
                          allocated once through its content pool.
                        </p>
                        <dl className="mt-3 space-y-2">
                          {detail.data.requested_work.map((r, i) => (
                            <div
                              key={`${r.occurred_at}:${i}`}
                              className="flex flex-wrap justify-between gap-2 text-xs"
                            >
                              <dt>
                                {name(r.feature)} · {r.provider} ·{' '}
                                {name(r.benefit)}
                              </dt>
                              <dd>
                                {usd(r.amount)} · {date(r.occurred_at)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {detail.data.comparisons.reason}
                      {detail.data.efficiency_metrics?.map((m) => (
                        <span
                          key={m.feature}
                          className="mt-3 block rounded-md border p-3"
                        >
                          <span className="block font-medium text-foreground">
                            {name(m.feature)} ·{' '}
                            {m.amount == null ? 'Unavailable' : usd(m.amount)}{' '}
                            {m.unit}
                          </span>
                          <span className="mt-1 block">
                            {m.basis} · {m.reason}
                          </span>
                          {m.peer_median != null && (
                            <span className="mt-1 block">
                              Peer median {usd(m.peer_median)} · p90{' '}
                              {usd(m.peer_p90)} · {m.peer_count} comparable
                              accounts
                            </span>
                          )}
                        </span>
                      ))}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Data captured {date(detail.data.as_of)} · Published{' '}
                      {detail.data.published_at
                        ? date(detail.data.published_at)
                        : 'Unavailable'}{' '}
                      · revision {detail.data.revision || 'unavailable'}
                    </p>
                  </div>
                </details>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
