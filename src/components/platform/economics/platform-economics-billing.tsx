'use client';
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, StatusPill } from './economics-ui';
import {
  name,
  useEconomicsScope,
  usd,
  date,
  field,
  Problem,
  Labeled,
  type Action,
} from './platform-economics-shared';
import {
  economicsAPI as api,
  type EconomicsPeriod,
  type EconomicsCost,
} from '@/lib/api/cms/platform-economics';
export function Billing({
  period,
  onAction,
  busy,
}: {
  period: EconomicsPeriod;
  onAction: Action;
  busy: boolean;
}) {
  const scope = useEconomicsScope();
  const sources = useQuery({
    queryKey: ['platform-economics', scope, 'sources'],
    queryFn: api.sources,
  });
  const costs = useQuery({
    queryKey: ['platform-economics', scope, 'costs', period],
    queryFn: () => api.costs(period),
  });
  const [sourceId, setSourceId] = useState('');
  const [editing, setEditing] = useState<EconomicsCost | null>(null);
  const selected = sources.data?.sources.find(
    (s) => s.id === (editing?.source_id ?? sourceId)
  );
  function createSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onAction(
      () =>
        api.saveSource({
          provider: String(f.get('provider')),
          resource: String(f.get('resource')),
          scope: String(f.get('scope')),
          currency: 'USD',
          note: String(f.get('note')),
          config:
            String(f.get('org_id') ?? '') && String(f.get('project_id') ?? '')
              ? {
                  org_id: String(f.get('org_id')),
                  project_id: String(f.get('project_id')),
                }
              : undefined,
        }),
      'Cost source recorded'
    );
  }
  function saveCost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    const net = String(f.get('net'));
    const gross = String(f.get('before_benefits') ?? '');
    const start = String(f.get('start'));
    const end = String(f.get('end'));
    const destination = String(f.get('destination'));
    void onAction(
      () =>
        api.saveCost({
          source_id: selected.id,
          logical_key: String(f.get('logical_key')),
          provider: selected.provider,
          resource: selected.resource,
          feature: 'serving',
          period_start: `${start}T00:00:00Z`,
          period_end: `${end}T00:00:00Z`,
          net,
          before_benefits: gross || null,
          currency: 'USD',
          destination,
          subject: '',
          content_id: '',
          method: 'reviewed_provider_evidence',
          metric: String(f.get('metric')),
          allocable_bps: Math.round(Number(f.get('allocable_percent')) * 100),
          reconciled: f.get('reconciled') === 'on',
          reason: String(f.get('reason')),
        }),
      'Saved immutable cost revision. Reporting publishes the corrected period on its next run.'
    );
  }
  return (
    <>
      <Panel
        title="Infrastructure & provider sources"
        description="Record the actual account, service, environment and bill scope. Shared or unsupported costs remain visible."
      >
        {sources.isError ? (
          <Problem error={sources.error} />
        ) : sources.data?.sources.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sources.data.sources.map((s) => (
              <div key={s.id} className="rounded-md border p-4">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">
                    {s.provider} · {name(s.resource)}
                  </p>
                  <StatusPill value={s.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.scope} · {s.currency} · {s.capability}
                </p>
                {s.note && (
                  <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>
                )}
                {!!sources.data.usage_evidence?.some(
                  (w) => w.source_id === s.id
                ) && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-medium">
                      Imported resource evidence
                    </summary>
                    <p className="mt-2 text-muted-foreground">
                      Provider resource usage only; actual charges require
                      invoice or contract evidence. Latest five imported windows
                      shown.
                    </p>
                    <div className="mt-3 space-y-3">
                      {sources.data.usage_evidence
                        .filter((w) => w.source_id === s.id)
                        .slice(0, 5)
                        .map((w) => (
                          <div
                            key={`${w.from}:${w.to}`}
                            className="rounded-md bg-muted/40 p-3"
                          >
                            <p>
                              {w.from.slice(0, 10)} to {w.to.slice(0, 10)} (UTC,
                              exclusive)
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              Imported {date(w.observed_at)}
                            </p>
                            <dl className="mt-2 space-y-1">
                              {w.metrics.map((m) => (
                                <div
                                  key={m.name}
                                  className="flex flex-wrap justify-between gap-x-3"
                                >
                                  <dt>{name(m.name)}</dt>
                                  <dd className="break-all font-mono tabular-nums">
                                    {m.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
                {s.capability === 'neon_consumption' && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void onAction(
                        () => api.importSource(s.id),
                        'Updated read-only provider consumption'
                      )
                    }
                  >
                    Import consumption
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add your database, hosting or storage cost source to start comparing
            usage with actual spending.
          </p>
        )}
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium">
            Add a cost source
          </summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={createSource}
          >
            <Labeled label="Provider">
              <Input
                name="provider"
                required
                maxLength={64}
                placeholder="Neon, R2, hosting provider…"
              />
            </Labeled>
            <Labeled label="Resource">
              <select name="resource" className={field}>
                {[
                  'database',
                  'app_compute',
                  'storage',
                  'delivery',
                  'communications',
                  'overhead',
                ].map((r) => (
                  <option key={r} value={r}>
                    {name(r)}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Account / project / environment scope">
              <Input
                name="scope"
                required
                maxLength={160}
                placeholder="Exact project, bucket or service scope"
              />
            </Labeled>
            <Labeled label="Source notes">
              <Input
                name="note"
                maxLength={2000}
                placeholder="Contract and source limitations"
              />
            </Labeled>

            <details className="sm:col-span-2">
              <summary className="cursor-pointer text-xs">
                Optional Neon consumption import
              </summary>
              <p className="my-2 text-xs text-muted-foreground">
                For provider Neon only. Read-only usage is not an invoice;
                actual charges still use cost evidence below.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Neon organization ID">
                  <Input name="org_id" maxLength={60} placeholder="org-…" />
                </Labeled>
                <Labeled label="Neon project ID">
                  <Input
                    name="project_id"
                    maxLength={60}
                    placeholder="project-…"
                  />
                </Labeled>
              </div>
            </details>
            <Button
              className="justify-self-start sm:col-span-2"
              disabled={busy}
            >
              Add source
            </Button>
          </form>
        </details>
      </Panel>
      <Panel
        title="Cost entries & revisions"
        description="Net spending is primary. Before-benefit estimates are separate. Correcting a source line replaces its prior revision in reports."
      >
        {costs.isError ? (
          <Problem error={costs.error} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-3">Source line</th>
                  <th className="pb-3">Period</th>
                  <th className="pb-3 text-right">Net</th>
                  <th className="pb-3 text-right">Before benefits</th>
                  <th className="pb-3 pl-4">Revision / evidence</th>
                </tr>
              </thead>
              <tbody>
                {costs.data?.costs.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-3 pr-3">
                      {c.provider}
                      <span className="block text-xs text-muted-foreground">
                        {c.logical_key}
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      {c.period_start.slice(0, 10)} →{' '}
                      {c.period_end.slice(0, 10)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {usd(c.net)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {usd(c.before_benefits)}
                    </td>
                    <td className="py-3 pl-4 text-xs">
                      v{c.revision} ·{' '}
                      {c.reconciled ? 'Source reconciled' : 'Provisional'}
                      <details className="mt-1">
                        <summary className="cursor-pointer">
                          Reason & method
                        </summary>
                        <p className="mt-2 max-w-md text-muted-foreground">
                          {c.reason}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {name(c.destination)} · {c.allocable_bps / 100}%
                          eligible for allocation
                        </p>
                        {!['ai-owner', 'ai-invoice', 'ai-legacy'].includes(
                          c.source_id
                        ) && (
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(c);
                              setSourceId(c.source_id);
                            }}
                          >
                            Correct this source line
                          </Button>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {costs.data?.costs.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                No imported or entered source costs for this period.
              </p>
            )}
          </div>
        )}
        <details className="mt-5" open={!!editing}>
          <summary className="cursor-pointer text-sm font-medium">
            {editing ? 'Correct source evidence' : 'Add a bill or fixed cost'}
          </summary>
          <form
            key={editing?.id ?? 'new'}
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={saveCost}
          >
            <Labeled label="Source">
              <select
                aria-label="Cost source"
                required
                className={field}
                value={editing?.source_id ?? sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setEditing(null);
                }}
              >
                <option value="">Choose a source</option>
                {sources.data?.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.provider} · {s.scope} · {name(s.resource)}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Stable invoice / source line key">
              <Input
                name="logical_key"
                required
                maxLength={160}
                defaultValue={editing?.logical_key}
                placeholder="Reuse the same key when correcting this line"
              />
            </Labeled>
            <Labeled label="Period start (UTC)">
              <Input
                name="start"
                type="date"
                required
                defaultValue={editing?.period_start.slice(0, 10) ?? period.from}
              />
            </Labeled>
            <Labeled label="Period end, exclusive (UTC)">
              <Input
                name="end"
                type="date"
                required
                defaultValue={editing?.period_end.slice(0, 10) ?? period.to}
              />
            </Labeled>
            <Labeled label="Net charge (USD)">
              <Input
                name="net"
                required
                inputMode="decimal"
                pattern="-?[0-9]+(\.[0-9]{1,12})?"
                defaultValue={editing?.net}
                placeholder="0.00"
              />
            </Labeled>
            <Labeled label="Before-benefit estimate (USD, optional)">
              <Input
                name="before_benefits"
                inputMode="decimal"
                pattern="-?[0-9]+(\.[0-9]{1,12})?"
                defaultValue={editing?.before_benefits ?? ''}
                placeholder="Same usage before credits / free allowances"
              />
            </Labeled>
            <Labeled label="Treatment">
              <select
                name="destination"
                className={field}
                defaultValue={editing?.destination ?? 'overhead'}
              >
                <option value="overhead">Shared platform overhead</option>
                <option value="unallocated">
                  Unallocated / insufficient evidence
                </option>
                <option value="infrastructure">
                  Allocate a qualified serving portion
                </option>
              </select>
            </Labeled>
            <Labeled label="Allocation metric">
              <select
                name="metric"
                className={field}
                defaultValue={editing?.metric ?? 'requests'}
              >
                <option value="requests">API operation profiles</option>
                <option value="db_work">Measured DB work</option>
                <option value="work_ms">Measured processing work</option>
                <option value="byte_seconds">Owned storage byte-time</option>
              </select>
            </Labeled>
            <Labeled label="Qualified allocable portion (%)">
              <Input
                name="allocable_percent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={(editing?.allocable_bps ?? 0) / 100}
              />
            </Labeled>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="reconciled"
                type="checkbox"
                defaultChecked={editing?.reconciled}
              />
              Amount checked against provider evidence
            </label>
            <div className="sm:col-span-2">
              <Labeled label="Evidence and correction reason">
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={2000}
                  defaultValue={editing?.reason}
                  className={field}
                  placeholder="Bill reference, covered serving pool, credits and any correction. Leave unsupported portions unallocated."
                />
              </Labeled>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button disabled={busy || !selected}>
                {editing ? 'Append correction' : 'Save cost evidence'}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel correction
                </Button>
              )}
            </div>
          </form>
        </details>
      </Panel>
    </>
  );
}
