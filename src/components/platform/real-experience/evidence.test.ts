import {
  experienceHeadline,
  orderExperienceIncidents,
  experienceDiagnosticPath,
  experienceRowHasVolume,
} from './evidence';
import type { ExperienceIncident, ExperienceRollup, SurfaceVerdict } from '@/types/platform/real-experience';

const surface = (verdict: SurfaceVerdict['verdict']): SurfaceVerdict => ({ verdict, slis: [] });
test.each(['insufficient_data', 'telemetry_degraded'] as const)('mixed healthy/%s cannot be green', verdict => {
  expect(experienceHeadline({ pods: surface('healthy'), news: surface(verdict) }, ['pods', 'news'], false).tone).toBe(verdict);
});
test('unavailable refresh overrides cached healthy evidence', () => {
  expect(experienceHeadline({ pods: surface('healthy') }, ['pods'], true).tone).toBe('telemetry_degraded');
});
test('an enabled surface missing from the response withholds health', () => {
  expect(experienceHeadline({ pods: surface('healthy') }, ['pods', 'news'], false).tone).toBe('insufficient_data');
});
test('confirmed highest-impact incident sorts before low-impact and watching incidents', () => {
  const base = { severity: 'degraded', first_seen_at: '2026-10-13T00:00:00Z' } as ExperienceIncident;
  const rows = [{ ...base, id: 'low', evidence: { affected_sessions: 5 } },
    { ...base, id: 'high', evidence: { affected_sessions: 500 } },
    { ...base, id: 'watch', severity: 'watching', evidence: { affected_sessions: 900 } } as ExperienceIncident];
  expect(orderExperienceIncidents(rows).map(row => row.id)).toEqual(['high', 'low', 'watch']);
});
test('diagnostic links accept only existing internal owners', () => {
  expect(experienceDiagnosticPath('/platform/feed-integrity')).toBe('/platform/feed-integrity');
  expect(experienceDiagnosticPath('https://example.invalid')).toBeNull();
  expect(experienceDiagnosticPath('/platform/real-experience?redirect=external')).toBeNull();
});
test('listening milliseconds cannot satisfy an outcome sample floor', () => {
  const row = { metric_key: 'rebuffer_ratio', denominator: 60000, outcome_count: 1, histogram_version: 2 } as ExperienceRollup;
  expect(experienceRowHasVolume(row, 50)).toBe(false);
  expect(experienceRowHasVolume({ ...row, outcome_count: 50 }, 50)).toBe(true);
});
