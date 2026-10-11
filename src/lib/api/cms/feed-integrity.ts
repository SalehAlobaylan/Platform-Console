import { cmsClient } from '@/lib/api/client';
import type {
  FeedIntegrityEpisode,
  FeedIntegrityFeedResult,
  FeedIntegrityFinding,
  FeedIntegrityPolicy,
  FeedIntegrityRun,
  FeedIntegrityStatus,
  FeedIntegritySuppression,
  FeedIntegrityTier,
  FeedIntegrityAction,
  FeedIntegrityAutopilotStatus,
} from '@/types/platform/feed-integrity';

type Envelope<T> = { data: T };
const unwrap = async <T>(request: Promise<Envelope<T>>) => (await request).data;
const BASE = '/admin/feed-integrity';

type LegacyFeedIntegrityFeedResult = Partial<FeedIntegrityFeedResult> & {
  Feed?: string;
  Variant?: string;
  ConsumerVerdict?: string;
  ReadinessVerdict?: string;
  ConsumerScore?: number;
  ReadinessScore?: number;
  Violations?: number;
  Checked?: number;
};

const stringValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value : fallback;

const scoreValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const numberValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Older CMS runs were persisted before integrityResult had JSON tags, so their
 * JSONB values contain Go field names. Normalize at the API boundary to keep
 * historical runs readable while new CMS runs use the canonical snake_case
 * contract.
 */
export function normalizeFeedIntegrityResults(
  input: unknown
): Record<string, FeedIntegrityFeedResult> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return undefined;

  const normalized: Record<string, FeedIntegrityFeedResult> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const result = raw as LegacyFeedIntegrityFeedResult;
    normalized[key] = {
      feed: stringValue(
        result.feed ?? result.Feed,
        key.split(':', 1)[0] || 'unknown'
      ),
      variant: stringValue(result.variant ?? result.Variant, 'default'),
      consumer_verdict: stringValue(
        result.consumer_verdict ?? result.ConsumerVerdict,
        'unknown'
      ),
      readiness_verdict: stringValue(
        result.readiness_verdict ?? result.ReadinessVerdict,
        'unknown'
      ),
      consumer_score: scoreValue(
        'consumer_score' in result
          ? result.consumer_score
          : result.ConsumerScore
      ),
      readiness_score: scoreValue(
        'readiness_score' in result
          ? result.readiness_score
          : result.ReadinessScore
      ),
      violations: numberValue(result.violations ?? result.Violations),
      checked: numberValue(result.checked ?? result.Checked),
    };
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

export function normalizeFeedIntegrityRun(
  run: FeedIntegrityRun
): FeedIntegrityRun {
  return {
    ...run,
    feed_results: normalizeFeedIntegrityResults(run.feed_results),
  };
}

export function normalizeFeedIntegrityStatus(
  status: FeedIntegrityStatus
): FeedIntegrityStatus {
  if (
    !status ||
    !status.policy ||
    !Array.isArray(status.open_episodes) ||
    !Array.isArray(status.active_suppressions)
  )
    throw new Error('Feed Integrity status is unavailable');
  if (status.current_observations !== undefined) {
    if (
      !Array.isArray(status.current_observations) ||
      status.current_observations.some(
        (o) =>
          !o ||
          o.version !== 1 ||
          typeof o.check_key !== 'string' ||
          typeof o.outcome !== 'string' ||
          typeof o.observed_at !== 'string' ||
          !Number.isInteger(o.sample_count) ||
          o.sample_count < 0 ||
          !Number.isInteger(o.affected_count) ||
          o.affected_count < 0 ||
          !Number.isInteger(o.candidate_count) ||
          o.candidate_count < 0 ||
          typeof o.feed !== 'string' ||
          typeof o.variant !== 'string' ||
          !['consumer', 'readiness'].includes(o.axis)
      )
    )
      throw new Error('Invalid current integrity observations');
    if (status.current_observations.length) {
      const results = status.current_feed_results;
      const verdicts = [
        'healthy',
        'degraded_minor',
        'degraded_major',
        'broken',
        'not_ready',
        'inconclusive',
      ];
      for (const feed of ['pods', 'news']) {
        const r = results?.[feed];
        if (
          !r ||
          !verdicts.includes(r.consumer_verdict) ||
          !verdicts.includes(r.readiness_verdict) ||
          [r.consumer_score, r.readiness_score].some(
            (v) =>
              v !== null &&
              (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)
          )
        )
          throw new Error('Invalid current integrity verdicts');
      }
    }
  }
  return {
    ...status,
    current_feed_results: status.current_observations?.length
      ? normalizeFeedIntegrityResults(status.current_feed_results)
      : undefined,
    latest_run: status.latest_run
      ? normalizeFeedIntegrityRun(status.latest_run)
      : status.latest_run,
  };
}
export const getFeedIntegrityStatus = () =>
  unwrap(cmsClient.get<Envelope<FeedIntegrityStatus>>(`${BASE}/status`)).then(
    normalizeFeedIntegrityStatus
  );
export const updateFeedIntegrityPolicy = (
  patch: Partial<FeedIntegrityPolicy>
) =>
  unwrap(cmsClient.put<Envelope<FeedIntegrityPolicy>>(`${BASE}/policy`, patch));
export const runFeedIntegrity = (tier: FeedIntegrityTier) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityRun>>(`${BASE}/run`, { tier })
  ).then(normalizeFeedIntegrityRun);
export const pauseFeedIntegritySchedule = (minutes: number) =>
  unwrap(
    cmsClient.post<Envelope<{ paused_until: string | null }>>(
      `${BASE}/schedule/pause`,
      { minutes }
    )
  );
export const listFeedIntegrityRuns = () =>
  unwrap(
    cmsClient.get<Envelope<{ items: FeedIntegrityRun[] }>>(`${BASE}/runs`)
  ).then(({ items }) => ({
    items: items.map(normalizeFeedIntegrityRun),
  }));
export const listFeedIntegrityFindings = () =>
  unwrap(
    cmsClient.get<Envelope<{ items: FeedIntegrityFinding[] }>>(
      `${BASE}/findings`
    )
  );
export const listFeedIntegrityEpisodes = () =>
  unwrap(
    cmsClient.get<Envelope<{ items: FeedIntegrityEpisode[] }>>(
      `${BASE}/episodes`
    )
  );
export const closeFeedIntegrityEpisode = (
  id: string,
  reason_class: string,
  notes: string
) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityEpisode>>(
      `${BASE}/episodes/${id}/close`,
      { reason_class, notes }
    )
  );
export const revokeFeedIntegritySuppression = (id: string) =>
  unwrap(
    cmsClient.delete<Envelope<{ revoked_at: string }>>(
      `${BASE}/suppressions/${id}`
    )
  );
export const getFeedIntegrityAutopilotStatus = () =>
  unwrap(
    cmsClient.get<Envelope<FeedIntegrityAutopilotStatus>>(
      `${BASE}/autopilot/status`
    )
  ).then((status) => ({
    ...status,
    latest_run: status.latest_run
      ? normalizeFeedIntegrityRun(status.latest_run)
      : status.latest_run,
  }));
export const updateFeedIntegrityAutopilotPolicy = (
  patch: Partial<FeedIntegrityPolicy>
) =>
  unwrap(
    cmsClient.put<Envelope<FeedIntegrityPolicy>>(
      `${BASE}/autopilot/policy`,
      patch
    )
  );
export const runFeedIntegrityAutopilot = () =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityRun>>(`${BASE}/autopilot/run`, {})
  ).then(normalizeFeedIntegrityRun);
export const pauseFeedIntegrityAutopilot = (minutes: number) =>
  unwrap(
    cmsClient.post<Envelope<{ autopilot_paused_until: string | null }>>(
      `${BASE}/autopilot/pause`,
      { minutes }
    )
  );
export const listFeedIntegrityAutopilotActions = () =>
  unwrap(
    cmsClient.get<Envelope<{ items: FeedIntegrityAction[] }>>(
      `${BASE}/autopilot/actions?limit=100`
    )
  );
export const approveFeedIntegrityAutopilotAction = ({
  id,
  reason,
}: {
  id: string;
  reason: string;
}) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityAction>>(
      `${BASE}/autopilot/actions/${id}/approve`,
      { reason }
    )
  );
export const rejectFeedIntegrityAutopilotAction = (
  id: string,
  reason: string
) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityAction>>(
      `${BASE}/autopilot/actions/${id}/reject`,
      { reason }
    )
  );

export const getFeedIntegrityRun = (id: string) =>
  unwrap(
    cmsClient.get<
      Envelope<{ run: FeedIntegrityRun; findings: FeedIntegrityFinding[] }>
    >(`${BASE}/runs/${id}`)
  ).then(({ run, findings }) => ({
    run: normalizeFeedIntegrityRun(run),
    findings,
  }));
export const createFeedIntegritySuppression = ({
  key,
  ...body
}: {
  key: string;
  feed: string;
  variant: string;
  scope?: string;
  reason: string;
  ttl_minutes: number;
}) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegritySuppression>>(
      `${BASE}/checks/${key}/suppress`,
      body
    )
  );
export const reviewFeedIntegrityUnknownAction = ({
  id,
  ...body
}: {
  id: string;
  reason: string;
  disposition: 'keep_blocked' | 'allow_fresh_approval';
}) =>
  unwrap(
    cmsClient.post<Envelope<FeedIntegrityAction>>(
      `${BASE}/autopilot/actions/${id}/review-unknown`,
      body
    )
  );
