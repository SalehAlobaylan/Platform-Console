import { Headphones, Newspaper, ChevronDown } from 'lucide-react';
import type {
  ExperienceClient,
  ExperiencePolicy,
  SurfaceVerdict,
} from '@/types/platform/real-experience';
import {
  EmptyEvidence,
  StatusLabel,
  formatPercent,
  humanize,
} from './presentation';

export function SurfaceEvidence({
  surface,
  value,
  client,
  policy,
  unavailable,
}: {
  surface: string;
  value?: SurfaceVerdict;
  client: ExperienceClient;
  policy?: ExperiencePolicy;
  unavailable: boolean;
}) {
  const primary =
    value?.slis.filter(
      (sli) =>
        sli.required ||
        sli.status === 'breach' ||
        sli.status === 'latency_breach'
    ) || [];
  const additional = value?.slis.filter((sli) => !primary.includes(sli)) || [];
  const row = (sli: SurfaceVerdict['slis'][number]) => (
    <details key={sli.metric} className="group py-2.5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{sli.label}</p>
          <StatusLabel
            value={unavailable ? 'telemetry_degraded' : sli.status}
          />
          {sli.status !== 'not_exercised' && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {sli.numerator.toLocaleString()}/
              {sli.denominator.toLocaleString()} {sli.population}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right">
          <div>
            <p
              className={`text-lg font-semibold tabular-nums ${sli.status === 'insufficient' || sli.status === 'not_exercised' ? 'text-muted-foreground' : ''}`}
            >
              {sli.denominator &&
              !['insufficient', 'not_exercised'].includes(sli.status)
                ? formatPercent(sli.value)
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Target {formatPercent(sli.target)}
            </p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </div>
      </summary>
      <div className="mt-3 space-y-2 border-l-2 pl-3 text-xs text-muted-foreground">
        <p>
          {sli.required ? 'Core journey' : 'Optional journey'} ·{' '}
          {sli.status === 'not_exercised'
            ? 'No eligible intents exercised this journey.'
            : `${sli.numerator}/${sli.denominator} ${sli.population}`}
        </p>
        <p>
          {sli.affected_sessions} affected of {sli.active_sessions} active{' '}
          {client === 'web' ? 'tabs' : 'app sessions'} in this exact window.
        </p>
        <p>
          Rate sample floor: {policy?.min_sample_floor ?? 'unavailable'}{' '}
          {sli.metric === 'rebuffer_ratio'
            ? 'listening outcomes; duration alone does not qualify.'
            : sli.metric === 'error_free_sessions'
              ? client === 'web'
                ? 'active tabs.'
                : 'active app sessions.'
              : 'outcomes.'}
        </p>
        {Boolean(sli.p75_budget_ms) && (
          <p>
            p75 upper bound {sli.p75_ms ? `≤${sli.p75_ms}ms` : 'unavailable'} ·
            Target {sli.p75_budget_ms}ms · {sli.latency_samples} latency samples
            / {policy?.latency_sample_floor ?? 'unavailable'} required.
          </p>
        )}
        {sli.evidence_reason && <p>{humanize(sli.evidence_reason)}</p>}
      </div>
    </details>
  );
  const Icon = surface === 'pods' ? Headphones : Newspaper;
  return (
    <section
      aria-label={`${surface === 'pods' ? 'Pods' : 'News'} journeys`}
      className="min-w-0 rounded-lg border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          {surface === 'pods' ? 'Pods' : 'News'}
        </h2>
        <StatusLabel
          value={
            unavailable
              ? 'telemetry_degraded'
              : value?.verdict || 'insufficient_data'
          }
        />
      </div>
      <div className="divide-y px-4 sm:px-5">
        {!value?.slis.length && (
          <EmptyEvidence title="No journey measurements yet">
            Completed outcomes will appear here. Health requires enough samples
            for every core journey.
          </EmptyEvidence>
        )}
        {primary.map(row)}
        {additional.length > 0 && (
          <details className="py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Other journeys · {additional.length}
            </summary>
            <div className="mt-2 divide-y">{additional.map(row)}</div>
          </details>
        )}
      </div>
    </section>
  );
}
