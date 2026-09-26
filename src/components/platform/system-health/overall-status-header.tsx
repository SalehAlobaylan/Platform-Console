'use client';

import { Activity, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { healthHeadline } from '@/lib/system-health';
import { cn } from '@/lib/utils';
import type { SystemHealthSnapshot } from '@/types/platform/system-health';

export function OverallStatusHeader({
  snapshot,
  isFetching,
  isError,
  stale,
}: {
  snapshot?: SystemHealthSnapshot;
  isFetching: boolean;
  isError: boolean;
  stale: boolean;
}) {
  const headline = healthHeadline(snapshot, stale, isError);
  const Icon = stale
    ? Clock3
    : headline.status === 'healthy'
      ? CheckCircle2
      : headline.status === 'unknown'
        ? Activity
        : AlertTriangle;
  const captured = snapshot ? new Date(snapshot.timestamp) : null;
  const metrics = [
    {
      label: 'Services healthy',
      value: snapshot
        ? `${snapshot.services.filter((s) => s.status === 'healthy').length} / ${snapshot.services.length}`
        : '—',
      detail: 'Latest reachability checks',
    },
    {
      label: 'Critical checks',
      value: snapshot
        ? snapshot.issues.filter((i) => i.severity === 'critical').length
        : '—',
      detail: 'Investigate first',
    },
    {
      label: 'Warnings',
      value: snapshot
        ? snapshot.issues.filter((i) => i.severity === 'warning').length
        : '—',
      detail: 'Includes snoozed warnings',
    },
    {
      label: 'Unknown services',
      value: snapshot
        ? snapshot.services.filter((s) => s.status === 'unknown').length
        : '—',
      detail: 'Health not established',
    },
  ];

  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'shrink-0 rounded-lg border p-2.5',
              headline.status === 'healthy'
                ? 'border-success/20 bg-success/10 text-success'
                : headline.status === 'unknown'
                  ? 'bg-muted text-muted-foreground'
                  : headline.status === 'unhealthy'
                    ? 'border-destructive/20 bg-destructive/10 text-destructive'
                    : 'border-warning/20 bg-warning/10 text-warning'
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              className="text-lg font-semibold tracking-tight"
              aria-live="polite"
            >
              {headline.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stale
                ? 'Showing the last known snapshot. Refresh before acting.'
                : 'Service readiness and reachability. Feed delivery is monitored separately.'}
            </p>
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <Badge variant={stale ? 'warning' : 'secondary'}>
            {stale
              ? 'Stale snapshot'
              : isFetching
                ? 'Refreshing checks'
                : snapshot
                  ? 'Auto-refresh · 15s'
                  : isError
                    ? 'Unavailable'
                    : 'Loading'}
          </Badge>
          {captured && Number.isFinite(captured.getTime()) ? (
            <p>
              Captured{' '}
              <time
                dateTime={snapshot!.timestamp}
                title={captured.toLocaleString()}
              >
                {captured.toLocaleTimeString()}
              </time>
            </p>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 border-t bg-muted/20 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 border-e p-3 last:border-e-0 sm:p-4"
          >
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
              {metric.value}
            </dd>
            <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">
              {metric.detail}
            </p>
          </div>
        ))}
      </dl>
    </Card>
  );
}
