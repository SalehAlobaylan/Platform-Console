import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const names: Record<string, string> = {
  healthy: 'Healthy',
  critical: 'Critical',
  degraded: 'Degraded',
  watching: 'Watching',
  insufficient_data: 'More evidence needed',
  telemetry_degraded: 'Evidence incomplete',
  insufficient: 'Needs samples',
  not_exercised: 'Not exercised',
  ok: 'Passing',
  breach: 'Outside target',
  latency_breach: 'Too slow',
  confirming: 'Confirming',
  recovering: 'Recovering',
  open: 'Open',
  resolved: 'Resolved',
  closed: 'Closed',
  completed: 'Completed',
  partial: 'Incomplete',
  failed: 'Failed',
  running: 'Running',
};
export const humanize = (value: string) => value.replaceAll('_', ' ');
export const statusName = (value: string) => names[value] || humanize(value);
export const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'No evidence';
export const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
export const ownerName = (value: string) =>
  ({
    wahb_platform: 'Web preview',
    wahb_mobile: 'Wahb-Mobile',
    feed_integrity: 'Feed Integrity',
    storage: 'Storage + Quality',
    news: 'News',
    circulation: 'Media Circulation',
    cms: 'CMS',
    content_management_system: 'CMS',
    media_service: 'Media',
    enrichment_service: 'Enrichment',
    aggregation_service: 'Aggregation',
  })[value] || humanize(value);

export function StatusLabel({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const good = ['healthy', 'ok', 'completed', 'resolved'].includes(value);
  const bad = ['critical', 'failed'].includes(value);
  const warning = [
    'degraded',
    'watching',
    'breach',
    'latency_breach',
    'recovering',
    'confirming',
    'partial',
  ].includes(value);
  const Icon = good
    ? CheckCircle2
    : bad || warning
      ? AlertCircle
      : value === 'running'
        ? Loader2
        : Circle;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium',
        good
          ? 'text-emerald-700 dark:text-emerald-400'
          : bad
            ? 'text-red-700 dark:text-red-400'
            : warning
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground',
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'h-3.5 w-3.5',
          value === 'running' && 'motion-safe:animate-spin'
        )}
      />
      {statusName(value)}
    </span>
  );
}

export function QueryNotice({
  loading,
  error,
  data,
  retry,
}: {
  loading: boolean;
  error: boolean;
  data: boolean;
  retry?: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 border-l-2 border-destructive py-2 pl-3 text-sm"
      >
        <span>
          Evidence unavailable{data ? ' — showing last-known evidence.' : '.'}
        </span>
        {retry && (
          <button
            className="font-medium underline underline-offset-4"
            onClick={retry}
          >
            Retry
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
      >
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 motion-safe:animate-spin"
        />
        Loading evidence…
      </p>
    );
  return null;
}

export function EmptyEvidence({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-7 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-lg text-muted-foreground">{children}</p>
    </div>
  );
}
