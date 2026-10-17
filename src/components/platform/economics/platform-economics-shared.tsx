'use client';
import { cloneElement, useId, type ReactElement } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { CircleAlert } from 'lucide-react';
import { money } from './economics-ui';
import type { ReportRow, UsageRow } from '@/lib/api/cms/platform-economics';
export const name = (s: string) =>
  ({
    ai: 'AI & paid models',
    database: 'Database',
    app_compute: 'Application compute',
    storage: 'Stored data',
    delivery: 'Media delivery',
    communications: 'Identity & messages',
    overhead: 'Platform overhead',
    public: 'Public access',
    system: 'Shared operations',
    removed: 'Removed attribution',
    unallocated: 'Unallocated',
    unknown: 'Unattributed',
    admin: 'Administration',
    accounts: 'Signed-in accounts',
    pods: 'Pods listening',
    news: 'News browsing',
    transcription: 'Transcription',
    upload: 'Uploads',
    serving: 'Product serving',
  })[s] ?? s.replaceAll('_', ' ');
export const usd = (s?: string | null) =>
  s == null || s === '' ? 'Unavailable' : money(Number(s));
export const number = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
export const date = (s?: string | null) =>
  s ? new Date(s).toLocaleString() : 'Unavailable';
export const field = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
export function Problem({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'The report could not be loaded. Check collection, migrations and source readiness.'}
      </span>
    </div>
  );
}
export function resourceUsage(resource: string, usage: UsageRow[]): string {
  const unitMap: Record<string, string[]> = {
    ai: ['tokens', 'audio_seconds'],
    database: ['requests'],
    app_compute: ['requests', 'work_ms', 'job_elapsed_ms'],
    storage: ['owned_byte_seconds'],
    delivery: ['response_bytes'],
    communications: ['requests'],
  };
  const sums = new Map<string, number>();
  for (const u of usage) {
    if (
      !(unitMap[resource] ?? []).includes(u.unit) ||
      (resource === 'communications' && u.operation !== 'auth')
    )
      continue;
    sums.set(u.unit, (sums.get(u.unit) ?? 0) + u.value);
  }
  return (
    [...sums]
      .map(([unit, value]) => `${number(value)} ${name(unit)}`)
      .join(' · ') || 'Unavailable'
  );
}
export function ResourceTable({
  rows,
  usage,
}: {
  rows: ReportRow[];
  usage?: UsageRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table role="table" className="block w-full text-left text-sm sm:table">
        <thead className="hidden text-xs text-muted-foreground sm:table-header-group">
          <tr>
            <th className="pb-3 font-medium">Resource / activity</th>
            {usage && <th className="pb-3 pr-4 font-medium">Observed use</th>}
            <th className="pb-3 text-right font-medium">Direct</th>
            <th className="pb-3 text-right font-medium">Shared estimate</th>
            <th className="pb-3 text-right font-medium">Supported total</th>
          </tr>
        </thead>
        <tbody className="block sm:table-row-group">
          {rows.map((r) => (
            <tr
              key={r.key}
              role="row"
              className="mb-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-4 sm:mb-0 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:p-0"
            >
              <td
                role="cell"
                className="col-span-2 block sm:table-cell sm:py-3 sm:pr-4"
              >
                <div className="font-medium">{name(r.key)}</div>
                {r.methods && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      Allocation method
                    </summary>
                    <p className="max-w-md pt-1">
                      {name(r.methods)}. Shared estimates do not establish
                      avoidable cost.
                    </p>
                  </details>
                )}
              </td>
              {usage && (
                <td
                  role="cell"
                  className="col-span-2 block text-xs text-muted-foreground sm:table-cell sm:max-w-48 sm:py-3 sm:pr-4"
                >
                  {resourceUsage(r.key, usage)}
                  {r.key === 'database' && (
                    <span className="mt-1 block">
                      API workload proxy; query count unavailable
                    </span>
                  )}
                  {r.key === 'delivery' && (
                    <span className="mt-1 block">
                      CMS response bytes; excludes media CDN transfer
                    </span>
                  )}
                </td>
              )}
              <td
                role="cell"
                className="block tabular-nums sm:table-cell sm:px-2 sm:py-3 sm:text-right"
              >
                <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                  Direct
                </span>
                {usd(r.direct)}
              </td>
              <td
                role="cell"
                className="block tabular-nums sm:table-cell sm:px-2 sm:py-3 sm:text-right"
              >
                <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                  Shared estimate
                </span>
                {usd(r.shared)}
              </td>
              <td
                role="cell"
                className="col-span-2 block border-t pt-3 tabular-nums sm:table-cell sm:border-0 sm:py-3 sm:pl-2 sm:text-right"
              >
                <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                  Supported total
                </span>
                {usd(r.total)}
                {r.total != null && r.total !== '' && (
                  <span className="block text-[10px] text-muted-foreground">
                    {r.reconciled
                      ? 'Reconciled source'
                      : 'Provisional estimate'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">
          No supported cost evidence for this period. Missing costs are not
          zero.
        </p>
      )}
    </div>
  );
}
export function Trend({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return null;
  const positive = Math.max(0, ...rows.map((r) => Number(r.total ?? 0)));
  const negative = Math.max(0, ...rows.map((r) => -Number(r.total ?? 0)));
  const extent = positive + negative || 1;
  const baseline = negative ? (positive / extent) * 100 : 100;
  return (
    <div>
      <div
        role="img"
        aria-label="Supported cost trend; refunds extend below zero; tabular values available below"
        className="relative flex h-28 gap-1"
      >
        <div
          className="absolute left-0 right-0 border-t border-muted-foreground/40"
          style={{ top: `${baseline}%` }}
        />
        {rows.slice(-90).map((r) => {
          const value = Number(r.total ?? 0);
          const height = (Math.abs(value) / extent) * 100;
          return (
            <div
              key={r.key}
              title={`${r.key}: ${usd(r.total)}`}
              className="relative min-w-1 flex-1"
            >
              <div
                className={
                  value < 0
                    ? 'absolute w-full rounded-b-sm bg-amber-600/70'
                    : 'absolute w-full rounded-t-sm bg-primary/65'
                }
                style={{
                  top: `${value < 0 ? baseline : baseline - height}%`,
                  height: `${height}%`,
                }}
              />
            </div>
          );
        })}
      </div>
      {negative > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Refunds and negative corrections appear below zero.
        </p>
      )}
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">View trend values</summary>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {rows.map((r) => (
            <div key={r.key}>
              <dt>{r.key}</dt>
              <dd>{usd(r.total)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
export function Metric({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {note}
      </p>
    </div>
  );
}
export function Labeled({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const generated = useId();
  const id = children.props.id ?? generated;
  return (
    <div className="block space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

export type Action = (
  work: () => Promise<unknown>,
  message: string
) => Promise<void>;

export function useEconomicsScope() {
  const { user } = useAuth();
  return `${user?.tenant_id ?? 'unknown'}:${user?.id ?? 'unavailable'}:${user?.role ?? 'unavailable'}`;
}
