import { cmsClient, iamClient } from '@/lib/api/client';
export type EconomicsView =
  | 'overview'
  | 'users'
  | 'activity'
  | 'billing'
  | 'attention'
  | 'diagnostics';
export interface EconomicsPeriod {
  from: string;
  to: string;
}
export interface ReportRow {
  key: string;
  direct: string | null;
  shared: string | null;
  total: string | null;
  reconciled: boolean;
  methods?: string;
  before_benefits?: string | null;
}
export interface EconomicsMeta {
  environment?: string;
  period_note?: string;
  revision: string;
  as_of: string | null;
  published_at?: string | null;
  coverage: string;
  currency: string;
  from: string;
  to: string;
}
export interface Overview extends EconomicsMeta {
  total: ReportRow;
  resources: ReportRow[];
  destinations: ReportRow[];
  trend: ReportRow[];
  distribution: {
    count: number;
    mean: string | null;
    median: string | null;
    p90: string | null;
    p95: string | null;
  };
  distribution_note: string;
}
export interface AccountRow {
  driver: string | null;
  account_id: string;
  direct: string | null;
  shared: string | null;
  total: string | null;
  requests: number;
  errors: number;
  reconciled: boolean;
}
export interface Accounts extends EconomicsMeta {
  accounts: AccountRow[];
  total: number;
  next_cursor: string | null;
  offset: number;
}
export interface UsageRow {
  operation: string;
  variant?: string;
  unit: string;
  value: number;
}
export interface AccountDetail extends EconomicsMeta {
  account_id: string;
  total: ReportRow;
  resources: ReportRow[];
  activities: ReportRow[];
  trend: ReportRow[];
  usage: UsageRow[];
  requested_work: {
    provider: string;
    resource: string;
    feature: string;
    content_id: string;
    amount: string | null;
    benefit: string;
    occurred_at: string;
  }[];
  efficiency_metrics: {
    feature: string;
    unit: string;
    amount: string | null;
    observed_units: number;
    peer_median: string | null;
    peer_p90: string | null;
    peer_count: number;
    observation: string;
    basis: string;
    reason: string;
  }[];
  comparisons: {
    observed_media_seconds: number;
    distinct_story_opens: number;
    cost_per_hour: string | null;
    cost_per_story: string | null;
    reason: string;
  };
  note: string;
}
export interface EconomicsPolicy {
  collection_enabled: boolean;
  reports_enabled: boolean;
  imports_enabled: boolean;
  allocation_enabled: boolean;
}
export interface ProviderUsageEvidence {
  source_id: string;
  from: string;
  to: string;
  observed_at: string;
  metrics: { name: string; value: string }[];
}
export interface EconomicsSource {
  id: string;
  provider: string;
  resource: string;
  scope: string;
  currency: string;
  capability: string;
  config?: { org_id?: string; project_id?: string };
  status: string;
  note: string;
}
export interface EconomicsCost {
  id: string;
  source_id: string;
  logical_key: string;
  revision: number;
  provider: string;
  resource: string;
  feature: string;
  period_start: string;
  period_end: string;
  net: string;
  before_benefits: string | null;
  currency: string;
  destination: string;
  subject: string;
  content_id: string;
  method: string;
  metric: string;
  allocable_bps: number;
  reconciled: boolean;
  reason: string;
  created_at: string;
  actor: string;
}
export interface EconomicsIssue {
  evidence?: Record<string, unknown>;
  id: string;
  kind: string;
  scope: string;
  headline: string;
  status: string;
  confirmations: number;
  first_seen_at: string;
  last_seen_at: string;
  close_reason: string;
}
export interface EconomicsCoverage extends EconomicsMeta {
  lifecycle_ready: boolean;
  lifecycle_synced_at: string | null;
  collectors: {
    source: string;
    last_seen_at: string | null;
    known_lost: number;
    open_epochs: number;
  }[];
  gaps: string[];
}
export interface EconomicsRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  rows: number;
  error: string;
}
export interface ContentPreparationRule {
  kind: string;
  version: number;
  effective_from: string;
  allocable_bps: number;
  observation: string;
  evidence: string;
}
export interface EconomicsProfile {
  resource: string;
  operation: string;
  version: number;
  weight: number;
  effective_from: string;
  evidence: string;
}
const base = '/admin/economics';
const query = (
  p: EconomicsPeriod,
  extra: Record<string, string | number | undefined> = {}
) => {
  const q = new URLSearchParams({ ...p });
  for (const [k, v] of Object.entries(extra))
    if (v !== undefined && v !== '') q.set(k, String(v));
  return `?${q}`;
};

async function read<T>(path: string): Promise<T> {
  const value = await cmsClient.get<T>(path);
  if (!value || typeof value !== 'object')
    throw new Error('Platform economics evidence is unavailable');
  const r = value as Record<string, unknown>;
  const route = path.split('?')[0];
  const field = route.endsWith('/overview')
    ? 'resources'
    : route.endsWith('/accounts')
      ? 'accounts'
      : route.includes('/accounts/')
        ? 'usage'
        : route.endsWith('/sources')
          ? 'sources'
          : route.endsWith('/costs')
            ? 'costs'
            : route.endsWith('/issues')
              ? 'issues'
              : route.endsWith('/runs')
                ? 'runs'
                : route.endsWith('/profiles')
                  ? 'profiles'
                  : route.endsWith('/coverage')
                    ? 'gaps'
                    : route.endsWith('/breakdown')
                      ? path.includes('dimension=content')
                        ? 'content'
                        : 'rows'
                      : null;
  if (field && !Array.isArray(r[field]))
    throw new Error(
      'Platform economics evidence is incomplete; check backend readiness'
    );
  if (
    route.endsWith('/overview') &&
    (!r.total ||
      !r.distribution ||
      !Array.isArray(r.destinations) ||
      !Array.isArray(r.trend))
  )
    throw new Error('Platform economics summary is incomplete');
  if (
    route.endsWith('/sources') &&
    r.usage_evidence != null &&
    !Array.isArray(r.usage_evidence)
  )
    throw new Error('Imported provider evidence is incomplete');
  return value;
}

export const economicsAPI = {
  directory: (q: string, ids: string[] = []) =>
    iamClient.get<{
      users: { id: string; username: string; email: string }[];
      has_more: boolean;
    }>(
      `/api/v1/iam/economics-directory?${new URLSearchParams(ids.length ? { ids: ids.join(',') } : { q })}`
    ),
  overview: (p: EconomicsPeriod) =>
    read<Overview>(`${base}/overview${query(p)}`),
  accounts: (
    p: EconomicsPeriod,
    q: string,
    sort: string,
    cursor?: string,
    account_ids?: string
  ) =>
    read<Accounts>(
      `${base}/accounts${query(p, { q, sort, cursor, account_ids })}`
    ),
  account: (id: string, p: EconomicsPeriod) =>
    read<AccountDetail>(
      `${base}/accounts/${encodeURIComponent(id)}${query(p)}`
    ),
  breakdown: (p: EconomicsPeriod, dimension: string) =>
    read<
      EconomicsMeta & {
        rows: ReportRow[];
        content?: {
          key: string;
          period: string | null;
          lifetime_estimate: string | null;
          consumption: string | null;
          kind: string;
        }[];
        note?: string;
      }
    >(`${base}/breakdown${query(p, { dimension })}`),
  sources: () =>
    read<{
      sources: EconomicsSource[];
      usage_evidence?: ProviderUsageEvidence[];
    }>(`${base}/sources`),
  saveSource: (
    s: Pick<
      EconomicsSource,
      'provider' | 'resource' | 'scope' | 'currency' | 'note' | 'config'
    >
  ) => cmsClient.post<EconomicsSource>(`${base}/sources`, s),
  importSource: (id: string) =>
    cmsClient.post(`${base}/sources/${encodeURIComponent(id)}/import`),
  costs: (p: EconomicsPeriod) =>
    read<{ costs: EconomicsCost[] }>(`${base}/costs${query(p)}`),
  saveCost: (
    c: Omit<EconomicsCost, 'id' | 'revision' | 'actor' | 'created_at'>
  ) => cmsClient.post<EconomicsCost>(`${base}/costs`, c),
  policy: () => read<EconomicsPolicy>(`${base}/policy`),
  savePolicy: (p: EconomicsPolicy) =>
    cmsClient.put<EconomicsPolicy>(`${base}/policy`, p),
  run: () => cmsClient.post<{ published: boolean }>(`${base}/run`),
  issues: () => read<{ issues: EconomicsIssue[] }>(`${base}/issues`),
  closeIssue: (id: string, reason: string) =>
    cmsClient.post(`${base}/issues/${encodeURIComponent(id)}/close`, {
      reason,
    }),
  coverage: () => read<EconomicsCoverage>(`${base}/coverage`),
  runs: () => read<{ runs: EconomicsRun[] }>(`${base}/runs`),
  profiles: () =>
    read<{
      profiles: EconomicsProfile[];
      content_rules: ContentPreparationRule[];
    }>(`${base}/profiles`),
  saveContentRule: (p: Omit<ContentPreparationRule, 'version'>) =>
    cmsClient.post(`${base}/content-rules`, p),
  saveProfile: (p: Omit<EconomicsProfile, 'version'>) =>
    cmsClient.post<EconomicsProfile>(`${base}/profiles`, p),
};
