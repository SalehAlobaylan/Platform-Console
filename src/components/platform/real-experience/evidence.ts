import type {
  ExperienceIncident,
  ExperienceRollup,
  RuxVerdict,
  SurfaceVerdict,
} from '@/types/platform/real-experience';
export function experienceHeadline(
  surfaces: Record<string, SurfaceVerdict> | undefined,
  enabled: string[],
  unavailable: boolean
): { text: string; tone: RuxVerdict } {
  if (unavailable)
    return {
      text: 'Evidence unavailable. Last-known measurements are labelled below.',
      tone: 'telemetry_degraded',
    };
  if (!enabled.length || !surfaces)
    return {
      text: 'Waiting for sufficient web evidence.',
      tone: 'insufficient_data',
    };
  const verdicts = enabled.map(
    (surface) => surfaces[surface]?.verdict || 'insufficient_data'
  );
  if (verdicts.includes('critical'))
    return {
      text: 'A core web journey is critically failing.',
      tone: 'critical',
    };
  if (verdicts.includes('telemetry_degraded'))
    return {
      text: 'Telemetry evidence is incomplete or stale. Health withheld.',
      tone: 'telemetry_degraded',
    };
  if (verdicts.includes('degraded'))
    return {
      text: 'Confirmed web experience degradation needs investigation.',
      tone: 'degraded',
    };
  if (verdicts.includes('watching'))
    return {
      text: 'An early web regression is awaiting adjacent-window confirmation.',
      tone: 'watching',
    };
  if (!verdicts.every((v) => v === 'healthy'))
    return {
      text: 'Required web journeys lack sufficient evidence.',
      tone: 'insufficient_data',
    };
  return {
    text: 'Every enabled web journey has sufficient healthy evidence.',
    tone: 'healthy',
  };
}
export function orderExperienceIncidents(
  rows: ExperienceIncident[]
): ExperienceIncident[] {
  const rank = { critical: 0, degraded: 1, watching: 2 };
  return [...rows].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      Number(b.evidence?.affected_sessions || 0) -
        Number(a.evidence?.affected_sessions || 0) ||
      a.first_seen_at.localeCompare(b.first_seen_at) ||
      a.id.localeCompare(b.id)
  );
}
const diagnosticPaths = new Set([
  '/platform/feed-integrity',
  '/platform/system-health',
  '/platform/media',
  '/platform/news',
  '/platform/real-experience',
]);
export function experienceDiagnosticPath(path?: string): string | null {
  return path && diagnosticPaths.has(path) ? path : null;
}

export function experienceRowHasVolume(row: ExperienceRollup, floor: number): boolean {
  return row.histogram_version === 2 &&
    (row.metric_key === 'rebuffer_ratio' ? row.outcome_count : row.denominator) >= floor;
}
