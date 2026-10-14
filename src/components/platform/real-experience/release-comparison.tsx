import type { ExperienceReleaseComparison } from '@/types/platform/real-experience';

export function ReleaseComparison({ value }: { value?: ExperienceReleaseComparison | null }) {
  if (!value) return <p className="text-sm text-muted-foreground">Release comparison requires completed decision hours.</p>;
  return (
    <section aria-label="Release comparison" className="space-y-2 border-y py-3">
      <p className="font-medium">{value.current_release || 'Current release unavailable'} / {value.previous_release || 'Previous release unavailable'}</p>
      <p className="text-xs text-muted-foreground">{value.qualified ? 'Comparable evidence' : 'Insufficient comparable evidence'} · {value.reason} This is investigation evidence; it does not gate a rollout.</p>
      {value.metrics.map(metric => (
        <p key={metric.surface + metric.metric} className="text-sm tabular-nums">
          {metric.surface} · {metric.metric.replaceAll('_', ' ')} · {metric.comparable_windows} matched hours:
          {' '}{metric.current_numerator}/{metric.current_denominator} current / {metric.previous_numerator}/{metric.previous_denominator} previous
          {metric.latency_qualified && <> · p75 upper bound ≤{metric.current_p75_ms}ms current / ≤{metric.previous_p75_ms}ms previous</>}
        </p>
      ))}
    </section>
  );
}
