'use client';

import { useEffect, useState } from 'react';
import Link from '@/lib/console-link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileClock,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  useCampaignAction,
  useCreateCampaign,
  useEmbeddingCampaign,
  useEmbeddingCampaigns,
  useEmbeddingExceptionAction,
  useEmbeddingRun,
  useEmbeddingRuns,
  useEmbeddingStatus,
  usePreviewCampaign,
  useRefreshEmbeddingLifecycle,
  useRunEmbeddingAudit,
  useStartCampaign,
  useUpdateEmbeddingPolicy,
} from '@/hooks/use-embedding-lifecycle';
import type {
  CampaignCaps,
  CampaignPreview,
  EmbeddingCampaign,
  EmbeddingCampaignException,
  EmbeddingPolicy,
  SurfaceSummary,
} from '@/lib/api/cms/embedding-lifecycle';

function verdictTone(v?: string) {
  if (v === 'coherent') return 'success' as const;
  if (
    [
      'drifting',
      'mixed_space',
      'blocked',
      'check_error',
      'writer_regression',
    ].includes(v ?? '')
  )
    return 'destructive' as const;
  if (v === 'unstamped_debt' || v === 'migrating') return 'warning' as const;
  return 'secondary' as const;
}
function headlineTone(h?: string) {
  if (h === 'all_clear') return 'success' as const;
  if (h === 'attention') return 'destructive' as const;
  if (h === 'watching') return 'warning' as const;
  return 'secondary' as const;
}
function ErrorNotice({ error, label }: { error: unknown; label: string }) {
  if (!error) return null;
  const message =
    typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Please try again.';
  return (
    <p
      role="alert"
      className="rounded border border-destructive/30 p-3 text-sm text-destructive"
    >
      {label}: {message}
    </p>
  );
}
function RawEvidence({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}
function ownerHref(surface: string) {
  if (surface.includes('story')) return '/platform/news';
  if (surface.includes('topic') || surface.includes('proposal'))
    return '/platform/topics';
  if (surface.includes('discovery')) return '/platform/media/sources';
  return surface.includes('image') ? '/platform/media' : '/platform/enrichment';
}

const number = (value: number) => value.toLocaleString();
const readable = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const panel = 'rounded-lg border bg-card';
function surfaceState(s: SurfaceSummary) {
  if (
    ['check_error', 'writer_regression', 'blocked', 'mixed_space'].includes(
      s.verdict
    )
  )
    return readable(s.verdict);
  if (s.stale > 0) return 'Needs refresh';
  if (!s.with_vec) return 'No vectors';
  if (s.unstamped > 0)
    return s.current > 0 ? 'Partial coverage' : 'Unknown provenance';
  return s.verdict === 'coherent' ? 'Up to date' : readable(s.verdict);
}
function CoverageBar({ s }: { s: SurfaceSummary }) {
  const total = Math.max(s.with_vec, s.current + s.stale + s.unstamped);
  return (
    <div className="min-w-[230px] space-y-2">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${number(s.current)} current, ${number(s.stale)} older, ${number(s.unstamped)} unknown provenance`}
      >
        {total > 0 && (
          <>
            <span
              className="bg-teal-400"
              style={{ width: `${(s.current / total) * 100}%` }}
            />
            <span
              className="bg-amber-400"
              style={{ width: `${(s.stale / total) * 100}%` }}
            />
            <span
              className="bg-slate-500"
              style={{ width: `${(s.unstamped / total) * 100}%` }}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
        <span>{number(s.current)} current</span>
        <span>{number(s.stale)} older</span>
        <span>{number(s.unstamped)} unknown</span>
      </div>
    </div>
  );
}

const capFields = [
  { key: 'items_per_batch', label: 'Items per batch', max: 500 },
  { key: 'batches_per_run', label: 'Batches per run', max: 5 },
  { key: 'daily_item_cap', label: 'Daily item cap', max: 50000 },
  { key: 'retry_ceiling', label: 'Retry ceiling', max: 10 },
] as const;
function PreviewDetails({ preview }: { preview: CampaignPreview }) {
  return (
    <section
      className="space-y-4 rounded-lg border bg-muted/20 p-4"
      aria-label="Migration preview"
    >
      <div>
        <h3 className="text-sm font-semibold">Migration preview</h3>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {preview.target_model || 'Model unresolved'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {number(preview.total_targets)}
          </p>
          <p className="text-xs text-muted-foreground">Vectors to refresh</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {preview.estimated_inference_calls == null
              ? '—'
              : number(preview.estimated_inference_calls)}
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated inference calls:{' '}
            {preview.estimated_inference_calls ?? 'unavailable'}
          </p>
        </div>
      </div>
      <div className="divide-y">
        {(preview.surfaces ?? []).map((surface) => (
          <div
            key={surface.key}
            className="flex justify-between gap-4 py-2 text-sm"
          >
            <span>{readable(surface.key)}</span>
            <span className="tabular-nums text-muted-foreground">
              {number(surface.targets)} targets
            </span>
          </div>
        ))}
      </div>
      {(preview.blockers ?? []).map((blocker) => (
        <p
          key={blocker}
          role="alert"
          className="rounded border border-destructive/30 p-3 text-sm text-destructive"
        >
          {readable(blocker)}
        </p>
      ))}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Counts are checked again before execution. Estimates exclude optional
        reranking and retries; monetary cost is unavailable. Similarity
        availability may fall until owner rebuilds and held work finish.
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">
          Target identity
        </summary>
        <dl className="mt-3 space-y-2 break-all text-muted-foreground">
          <div>
            <dt>Space ID</dt>
            <dd>{preview.expected_space_id || 'Unresolved'}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{preview.target_revision || 'Unresolved'}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
function CampaignComposer({
  policy,
  disabled,
}: {
  policy: EmbeddingPolicy;
  disabled: boolean;
}) {
  const preview = usePreviewCampaign();
  const create = useCreateCampaign();
  const [space, setSpace] = useState('text');
  const [caps, setCaps] = useState<CampaignCaps>({
    items_per_batch: policy.items_per_batch,
    batches_per_run: policy.batches_per_run,
    daily_item_cap: policy.daily_item_cap,
    retry_ceiling: policy.retry_ceiling,
  });
  const capsValid = capFields.every(
    ({ key, max }) =>
      Number.isInteger(caps[key]) && caps[key] >= 1 && caps[key] <= max
  );
  const ready =
    preview.data?.resolved &&
    preview.data.dim_ok &&
    !(preview.data.blockers ?? []).length;
  return (
    <details open className="rounded-lg border p-5">
      <summary className="cursor-pointer font-medium">
        Review a new migration campaign
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a model space to preview affected surfaces. A draft does not
          start processing.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {capFields.map(({ key, label, max }) => (
            <label key={key} className="space-y-1 text-xs">
              <span className="flex justify-between gap-2">
                {label}
                <span className="text-muted-foreground">1–{number(max)}</span>
              </span>
              <Input
                aria-label={label}
                type="number"
                min={1}
                max={max}
                step={1}
                value={caps[key]}
                disabled={disabled || create.isPending}
                onChange={(e) =>
                  setCaps({ ...caps, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {['text', 'image'].map((sp) => (
            <Button
              key={sp}
              size="sm"
              variant={preview.data && space === sp ? 'secondary' : 'outline'}
              disabled={disabled || preview.isPending || create.isPending}
              onClick={() => {
                setSpace(sp);
                preview.reset();
                preview.mutate(sp);
              }}
            >
              {preview.isPending && space === sp
                ? 'Loading preview…'
                : `Preview ${sp}`}
            </Button>
          ))}
        </div>
        {!capsValid && (
          <p role="alert" className="text-sm text-destructive">
            Use whole numbers within the processing limits shown for each field.
          </p>
        )}
        <ErrorNotice error={preview.error} label="Preview unavailable" />
        {preview.data && (
          <>
            <PreviewDetails preview={preview.data} />
            <Button
              size="sm"
              disabled={
                disabled ||
                !ready ||
                !capsValid ||
                create.isPending ||
                preview.isPending
              }
              onClick={() =>
                create.mutate(
                  { space, caps },
                  { onSuccess: () => preview.reset() }
                )
              }
            >
              Create reviewed {space} draft
            </Button>
          </>
        )}
      </div>
    </details>
  );
}

function ExceptionRow({
  item,
  disabled,
}: {
  item: EmbeddingCampaignException;
  disabled: boolean;
}) {
  const action = useEmbeddingExceptionAction();
  const [reason, setReason] = useState('');
  const actionable = item.status === 'open' || item.status === 'retrying';
  return (
    <div className="space-y-2 rounded border p-2 text-xs">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="break-all">
          {item.surface_key} · {item.target_id}
        </span>
        <Badge variant={actionable ? 'destructive' : 'secondary'}>
          {item.status} · {item.attempts} tries
        </Badge>
      </div>
      <p>{item.failure_class || 'Target failed'}</p>
      {item.status === 'waived' && (
        <p>
          Waived: {item.waiver_reason} · expires{' '}
          {item.waiver_expires
            ? new Date(item.waiver_expires).toLocaleString()
            : 'unavailable'}
          . The underlying vector remains debt.
        </p>
      )}
      {actionable && !disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate({ id: item.id, action: 'retry' })}
          >
            Retry
          </Button>
          <Input
            className="min-w-40 flex-1"
            aria-label={`Waiver reason for ${item.target_id}`}
            placeholder="Waiver reason (7-day expiry)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={!reason.trim() || action.isPending}
            onClick={() =>
              action.mutate({
                id: item.id,
                action: 'waive',
                reason: reason.trim(),
                expiryHours: 168,
              })
            }
          >
            Waive
          </Button>
        </div>
      )}
      <details>
        <summary className="cursor-pointer">Target evidence</summary>
        <RawEvidence value={item.latest_evidence} />
      </details>
    </div>
  );
}
function CampaignCard({
  initial,
  disabled,
}: {
  initial: EmbeddingCampaign;
  disabled: boolean;
}) {
  const active = !['completed', 'completed_with_waivers', 'aborted'].includes(
    initial.state
  );
  const detail = useEmbeddingCampaign(initial.id, active);
  // List polling is the freshest state; detail supplies history and exceptions.
  const c = initial;
  const act = useCampaignAction();
  const start = useStartCampaign();
  const preview = usePreviewCampaign();
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showAllExceptions, setShowAllExceptions] = useState(false);
  const exceptions = [...(detail.data?.exceptions ?? [])].sort(
    (a, b) =>
      Number(b.status === 'open' || b.status === 'retrying') -
      Number(a.status === 'open' || a.status === 'retrying')
  );
  const startReady =
    preview.data?.resolved &&
    preview.data.dim_ok &&
    !(preview.data.blockers ?? []).length &&
    preview.data.expected_space_id === c.target_space_id &&
    confirmation === c.target_space_id &&
    reason.trim();
  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          #{c.id} · {c.space}
        </span>
        <Badge
          variant={
            c.state === 'completed'
              ? 'success'
              : c.state === 'blocked'
                ? 'destructive'
                : 'secondary'
          }
        >
          {readable(c.state)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {c.target_model || 'Unresolved model'}
      </p>
      <dl className="grid grid-cols-3 gap-4 border-y py-3">
        {[
          ['Completed', c.completed_count],
          ['Failed', c.failed_count],
          ['Skipped', c.skipped_count],
        ].map(([label, count]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {number(Number(count))}
            </dd>
          </div>
        ))}
      </dl>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">
          Target identity and processing limits
        </summary>
        <div className="mt-3 space-y-2 break-all text-muted-foreground">
          <p>Target: {c.target_space_id}</p>
          <p>Revision: {c.target_revision || 'Unavailable'}</p>
          <p>
            {c.items_per_batch} items/batch · {c.batches_per_run ?? '—'}{' '}
            batches/run · cap {c.daily_item_cap}/day · retry ceiling{' '}
            {c.retry_ceiling ?? '—'}
          </p>
        </div>
      </details>
      {c.blocked_reason && (
        <p className="text-xs text-destructive">{c.blocked_reason}</p>
      )}
      {c.state === 'draft' && (
        <div className="space-y-3 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || preview.isPending}
            onClick={() => preview.mutate(c.space)}
          >
            Review start for campaign #{c.id}
          </Button>
          <ErrorNotice
            error={preview.error}
            label="Start preview unavailable"
          />
          {preview.data && (
            <>
              <PreviewDetails preview={preview.data} />
              {preview.data.expected_space_id !== c.target_space_id && (
                <p className="text-xs text-destructive">
                  The service target changed. Abort this draft and review a new
                  campaign.
                </p>
              )}
              <label className="block space-y-1 text-xs">
                Type the full target space ID to confirm
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={disabled || start.isPending}
                />
              </label>
              <label className="block space-y-1 text-xs">
                Reason to start
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={disabled || start.isPending}
                />
              </label>
              <Button
                size="sm"
                disabled={
                  disabled ||
                  !startReady ||
                  start.isPending ||
                  preview.isPending
                }
                onClick={() =>
                  start.mutate({
                    id: c.id,
                    reason: reason.trim(),
                    targetSpaceID: confirmation,
                  })
                }
              >
                <Play className="mr-1 h-3 w-3" />
                Start reviewed campaign #{c.id}
              </Button>
            </>
          )}
        </div>
      )}
      {active && (
        <div className="flex flex-wrap gap-2">
          {(c.state === 'running' || c.state === 'verifying') && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || act.isPending}
              onClick={() => act.mutate({ id: c.id, action: 'pause' })}
            >
              Pause
            </Button>
          )}
          {(c.state === 'paused' || c.state === 'blocked') && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || act.isPending}
              onClick={() => act.mutate({ id: c.id, action: 'resume' })}
            >
              {c.state === 'blocked' ? 'Retry preflight' : 'Resume'}
            </Button>
          )}
          <details>
            <summary className="cursor-pointer py-2 text-xs text-destructive">
              Abort campaign
            </summary>
            <p className="my-2 text-xs">
              Stops new work; completed vectors are preserved. Reversal requires
              a new campaign.
            </p>
            <Button
              size="sm"
              variant="destructive"
              disabled={disabled || act.isPending}
              onClick={() => act.mutate({ id: c.id, action: 'abort' })}
            >
              Confirm abort #{c.id}
            </Button>
          </details>
        </div>
      )}
      <ErrorNotice error={detail.error} label="Campaign history unavailable" />
      {detail.isLoading && (
        <p className="text-xs text-muted-foreground">
          Loading campaign history…
        </p>
      )}
      {exceptions.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium">
            Exceptions ({exceptions.length})
          </p>
          {(showAllExceptions ? exceptions : exceptions.slice(0, 5)).map(
            (item) => (
              <ExceptionRow
                key={item.id}
                item={item}
                disabled={disabled || !active}
              />
            )
          )}
          {exceptions.length > 5 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAllExceptions(!showAllExceptions)}
            >
              {showAllExceptions
                ? 'Show fewer exceptions'
                : `Show all ${exceptions.length} exceptions`}
            </Button>
          )}
        </div>
      )}
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-xs font-medium">
          Action history ({detail.data?.actions.length ?? 0}
          {detail.data?.actions.length === 200 ? ' latest; API limit' : ''})
        </summary>
        <div className="mt-2 space-y-2">
          {(detail.data?.actions ?? []).map((item) => (
            <details key={item.id} className="rounded-lg border p-4 text-sm">
              <summary className="cursor-pointer break-all">
                {item.surface_key} · {item.target_id} · {item.status}
                {item.guardrail ? ` · ${item.guardrail}` : ''}
              </summary>
              <p className="mt-2">
                {item.tool} · retry {item.retry_number} · {item.latency_ms}ms ·{' '}
                {new Date(item.created_at).toLocaleString()}
              </p>
              {item.reason && <p>{item.reason}</p>}
              <RawEvidence value={item.evidence} />
            </details>
          ))}
          {detail.data?.actions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No actions recorded.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

export default function EmbeddingLifecyclePage() {
  const status = useEmbeddingStatus();
  const runs = useEmbeddingRuns();
  const campaigns = useEmbeddingCampaigns();
  const refresh = useRefreshEmbeddingLifecycle();
  const audit = useRunEmbeddingAudit();
  const savePolicy = useUpdateEmbeddingPolicy();
  const [selectedRun, setSelectedRun] = useState<number>();
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    const restore = () => {
      const section = window.location.hash.slice(1);
      setTab(
        section === 'audit-evidence'
          ? 'audit'
          : ['campaigns', 'audit', 'settings'].includes(section)
            ? section
            : 'overview'
      );
    };
    restore();
    window.addEventListener('hashchange', restore);
    return () => window.removeEventListener('hashchange', restore);
  }, []);
  const selectTab = (section: string) => {
    setTab(section);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}#${section}`
    );
  };
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [showPassingChecks, setShowPassingChecks] = useState(false);
  const [inspector, setInspector] = useState<string | null>(null);
  const data = status.data;
  const latest = data?.latest_run?.id ? data.latest_run : null;
  const evidence = useEmbeddingRun(selectedRun ?? latest?.id);
  const unavailable = !!status.error || !data;
  const surfaces = latest?.per_surface ?? {};
  const entries = Object.entries(surfaces);
  const surfaceLabel = (key: string) =>
    data?.surfaces.find((s) => s.Key === key)?.Label || readable(key);
  const textSurface = entries.find(([key]) => key === 'content_text')?.[1];
  const debt = textSurface ? textSurface.stale + textSurface.unstamped : null;
  const activeCampaigns = (campaigns.data?.campaigns ?? []).filter(
    (c) => !['completed', 'completed_with_waivers', 'aborted'].includes(c.state)
  );
  const inspected = inspector ? surfaces[inspector] : undefined;
  const needsAttention = (s: SurfaceSummary) =>
    s.verdict !== 'coherent' ||
    s.stale > 0 ||
    s.unstamped > 0 ||
    s.mixed_space > 0;
  const auditTime = latest
    ? new Date(latest.started_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  if (status.isLoading)
    return (
      <div className="space-y-6 p-6" role="status">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <p className="text-sm text-muted-foreground">
          Loading embedding lifecycle…
        </p>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Embedding lifecycle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep discovery in one trusted vector space.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {auditTime && (
            <span className="mr-2 text-xs text-muted-foreground">
              Audited {auditTime}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={status.isFetching}
            onClick={() => refresh()}
            aria-label="Refresh all"
          >
            <RefreshCw
              className={`h-4 w-4 ${status.isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            size="sm"
            disabled={unavailable || audit.isPending}
            onClick={() => audit.mutate()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {audit.isPending ? 'Auditing…' : 'Run audit'}
          </Button>
        </div>
      </header>
      <ErrorNotice
        error={status.error}
        label={
          data
            ? 'Status refresh failed; showing previously recorded evidence'
            : 'Lifecycle status unavailable'
        }
      />
      <ErrorNotice error={audit.error} label="Audit failed" />
      {!data && !status.error && (
        <p role="alert">Lifecycle status unavailable. Refresh to retry.</p>
      )}
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList
          aria-label="Embedding lifecycle sections"
          className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none border-b bg-transparent p-0 sm:gap-7"
        >
          {['overview', 'campaigns', 'audit', 'settings'].map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {key === 'audit' ? 'Audit history' : readable(key)}
              {key === 'campaigns' && activeCampaigns.length > 0 && (
                <span className="ml-2 rounded bg-muted px-1.5 text-xs">
                  {activeCampaigns.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-5 space-y-4">
          {data && (
            <>
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
                <div className="min-w-0 space-y-4">
                  <section
                    className={`flex gap-4 rounded-lg border p-5 ${latest && (latest.violations_major > 0 || latest.check_errors > 0 || (debt ?? 0) > 0) ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}
                    aria-label="Recommended next step"
                  >
                    {latest?.headline === 'all_clear' ? (
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-teal-400" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
                    )}
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-lg font-semibold">
                          {!latest
                            ? 'Start with an embedding audit'
                            : latest.check_errors > 0
                              ? 'Some checks need attention'
                              : (debt ?? 0) > 0
                                ? 'Text embeddings need a refresh'
                                : data.recommended_action?.label ||
                                  'Review embedding health'}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {!latest
                            ? 'Inventory your vectors to see coverage, provenance, and migration needs.'
                            : latest.check_errors > 0
                              ? 'Review incomplete checks before relying on this audit’s coverage.'
                              : (debt ?? 0) > 0 && textSurface
                                ? `${number(textSurface.stale)} older vectors and ${number(textSurface.unstamped)} without provenance need review before a migration.`
                                : data.recommended_action?.description ||
                                  'Inspect the latest audit before deciding whether to migrate.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {latest ? (
                          <>
                            <Button
                              size="sm"
                              disabled={unavailable || !!campaigns.error}
                              onClick={() => selectTab('campaigns')}
                            >
                              Review {(debt ?? 0) > 0 ? 'text ' : ''}migration
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => selectTab('audit')}
                            >
                              Inspect findings
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            disabled={unavailable || audit.isPending}
                            onClick={() => audit.mutate()}
                          >
                            Run first audit
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {data.recommended_action?.href?.startsWith(
                        '/platform/'
                      ) && (
                        <Link
                          className="inline-block text-xs text-primary hover:underline"
                          href={data.recommended_action.href}
                        >
                          {data.recommended_action.label}
                          <ArrowRight className="ml-1 inline h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </section>
                  <div className="grid grid-cols-3 divide-x rounded-lg bg-muted/30 py-4">
                    {[
                      {
                        value: debt === null ? '—' : number(debt),
                        label: 'Text vectors to review',
                      },
                      {
                        value:
                          textSurface?.semantic_availability_percent == null
                            ? '—'
                            : `${Math.round(textSurface.semantic_availability_percent)}%`,
                        label: 'Text availability',
                      },
                      {
                        value:
                          data.held_work?.classification == null
                            ? '—'
                            : number(data.held_work.classification),
                        label: 'Held classifications',
                      },
                    ].map((metric) => (
                      <div key={metric.label} className="px-3 sm:px-5">
                        <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                          {metric.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <section className={`${panel} overflow-hidden`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                      <div>
                        <h2 className="font-semibold">Vector coverage</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Producer freshness by surface. Availability measures
                          comparable retrieval candidates.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={attentionOnly ? 'secondary' : 'ghost'}
                        aria-pressed={attentionOnly}
                        onClick={() => setAttentionOnly(!attentionOnly)}
                      >
                        Needs attention{attentionOnly && ' ✓'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4 px-5 pb-4 text-xs text-muted-foreground">
                      {[
                        ['Current', 'bg-teal-400'],
                        ['Older model', 'bg-amber-400'],
                        ['Unknown provenance', 'bg-slate-500'],
                      ].map(([label, color]) => (
                        <span key={label} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${color}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="overflow-x-auto px-5">
                      <table className="block w-full text-left text-sm sm:table">
                        <thead className="hidden border-y bg-muted/30 text-xs text-muted-foreground sm:table-header-group">
                          <tr>
                            <th className="py-3 pr-4 font-medium">Surface</th>
                            <th className="px-3 font-medium">Coverage</th>
                            <th className="px-3 font-medium">Availability</th>
                            <th className="pl-3 font-medium">Status</th>
                            <th>
                              <span className="sr-only">Details</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group">
                          {entries
                            .filter(
                              ([, s]) => !attentionOnly || needsAttention(s)
                            )
                            .map(([key, s]) => (
                              <tr
                                key={key}
                                className="relative block border-b pb-4 last:border-0 hover:bg-muted/20 sm:table-row sm:pb-0"
                              >
                                <th className="block min-w-[145px] py-4 pr-10 font-medium sm:table-cell sm:pr-3">
                                  <button
                                    className="text-left hover:text-primary focus-visible:outline-primary"
                                    onClick={() => setInspector(key)}
                                  >
                                    {surfaceLabel(key)}
                                    <span className="mt-1 block text-xs font-normal capitalize text-muted-foreground">
                                      {s.space}
                                    </span>
                                  </button>
                                </th>
                                <td className="block pb-3 sm:table-cell sm:px-3 sm:py-4">
                                  <CoverageBar s={s} />
                                </td>
                                <td className="inline-block pr-3 tabular-nums sm:table-cell sm:px-3">
                                  <span className="mr-1 text-xs text-muted-foreground sm:hidden">
                                    Availability
                                  </span>
                                  {s.semantic_availability_percent == null ? (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  ) : (
                                    `${Math.round(s.semantic_availability_percent)}%`
                                  )}
                                </td>
                                <td className="inline-block whitespace-nowrap sm:table-cell sm:pl-3">
                                  <Badge
                                    className="rounded-md border-0 font-medium"
                                    variant={verdictTone(s.verdict)}
                                  >
                                    {surfaceState(s)}
                                  </Badge>
                                </td>
                                <td className="absolute right-0 top-3 sm:static sm:pl-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Inspect ${surfaceLabel(key)}`}
                                    onClick={() => setInspector(key)}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!entries.length && (
                      <p className="p-5 text-sm text-muted-foreground">
                        Run an audit to populate surface coverage.
                      </p>
                    )}
                    {entries.length > 0 &&
                      attentionOnly &&
                      !entries.some(([, s]) => needsAttention(s)) && (
                        <p className="p-5 text-sm text-muted-foreground">
                          All audited surfaces are up to date.
                        </p>
                      )}
                  </section>
                </div>
                <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <section className={`${panel} p-5`}>
                    <h2 className="font-semibold">Active models</h2>
                    <div className="mt-1 divide-y">
                      {(['text', 'image'] as const).map((space) => {
                        const model = data.spaces[space];
                        const ready = !!model.SpaceID && !model.Err;
                        return (
                          <div key={space} className="py-4">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <h3 className="font-medium capitalize">
                                {space}
                              </h3>
                              <span
                                className={`flex items-center gap-1.5 text-xs ${ready ? 'text-teal-400' : 'text-amber-400'}`}
                              >
                                {ready && (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                {ready ? 'Ready' : 'Unavailable'}
                              </span>
                            </div>
                            <p className="mt-2 break-words text-sm text-muted-foreground">
                              {model.Model?.split('/').pop() ||
                                'Unresolved model'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {model.Dimensions || '—'} dimensions
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                      onClick={() => setInspector('models')}
                    >
                      View model details
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </section>
                  <section className={`${panel} p-5`}>
                    <h2 className="font-semibold">Migration activity</h2>
                    <ErrorNotice
                      error={campaigns.error}
                      label="Campaigns unavailable"
                    />
                    {campaigns.isLoading ? (
                      <p className="py-6 text-sm text-muted-foreground">
                        Loading campaigns…
                      </p>
                    ) : (
                      !campaigns.error && (
                        <div className="py-5 text-center">
                          <FileClock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            {activeCampaigns.length
                              ? `${activeCampaigns.length} open campaign${activeCampaigns.length === 1 ? '' : 's'}`
                              : 'No campaign running'}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {activeCampaigns.length
                              ? activeCampaigns
                                  .map((c) => `#${c.id} · ${readable(c.state)}`)
                                  .join(' / ')
                              : 'Review the target and limits before approving a migration.'}
                          </p>
                          <Button
                            className="mt-4 w-full"
                            size="sm"
                            variant="outline"
                            onClick={() => selectTab('campaigns')}
                          >
                            {activeCampaigns.length
                              ? 'Manage campaigns'
                              : 'Review a migration'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )
                    )}
                  </section>
                </aside>
              </div>
              <section
                className={`${panel} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}
                aria-label="Recent audit"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <h2 className="text-sm font-semibold">Recent audit</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latest
                        ? `${readable(latest.status)} · ${auditTime}`
                        : 'No audit has run yet.'}
                    </p>
                  </div>
                </div>
                {latest && (
                  <div className="flex gap-6 text-sm tabular-nums">
                    <div>
                      {number(latest.check_errors)}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Check errors
                      </span>
                    </div>
                    <div>
                      {number(
                        latest.violations_major + latest.violations_minor
                      )}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Violations
                      </span>
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectTab('audit')}
                >
                  View audit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </section>
            </>
          )}
        </TabsContent>
        <TabsContent value="campaigns" className="mt-5">
          <Card id="campaigns">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Migration campaigns</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review the target and processing limits, create a draft, then
                approve its start.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ErrorNotice
                error={campaigns.error}
                label="Campaigns unavailable"
              />
              {data?.policy && (
                <CampaignComposer
                  policy={data.policy}
                  disabled={unavailable || !!campaigns.error}
                />
              )}
              {campaigns.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading campaigns…
                </p>
              ) : (
                !campaigns.error &&
                campaigns.data?.campaigns.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No campaigns. Review a draft when an audit identifies debt.
                  </p>
                )
              )}
              {(campaigns.data?.campaigns ?? []).map((c) => (
                <CampaignCard
                  key={c.id}
                  initial={c}
                  disabled={unavailable || !!campaigns.error}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit" className="mt-5">
          <Card id="audit-evidence">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Audit history and evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ErrorNotice
                error={runs.error}
                label="Audit history unavailable"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1">When</th>
                      <th>Trigger</th>
                      <th>Headline</th>
                      <th>Major</th>
                      <th>Errors</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(runs.data?.runs ?? []).map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1">
                          {new Date(r.started_at).toLocaleString()}
                        </td>
                        <td>{readable(r.trigger)}</td>
                        <td>
                          <Badge variant={headlineTone(r.headline)}>
                            {readable(r.headline)}
                          </Badge>
                        </td>
                        <td>{r.violations_major}</td>
                        <td>{r.check_errors}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-pressed={(selectedRun ?? latest?.id) === r.id}
                            onClick={() => {
                              setSelectedRun(r.id);
                              setShowPassingChecks(false);
                            }}
                          >
                            Inspect #{r.id}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!runs.error && runs.data?.runs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No audits recorded.
                </p>
              )}
              <ErrorNotice
                error={evidence.error}
                label="Audit evidence unavailable"
              />
              {evidence.isLoading && (
                <p className="text-xs text-muted-foreground">
                  Loading audit evidence…
                </p>
              )}
              {evidence.data && (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Findings for audit #{evidence.data.run.id}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={showPassingChecks}
                      onClick={() => setShowPassingChecks(!showPassingChecks)}
                    >
                      {showPassingChecks
                        ? 'Hide passing checks'
                        : 'Show passing checks'}
                    </Button>
                  </div>
                  {!showPassingChecks &&
                    evidence.data.findings.length > 0 &&
                    evidence.data.findings.every(
                      (f) => f.status === 'pass'
                    ) && (
                      <p className="py-3 text-sm text-muted-foreground">
                        All recorded checks passed.
                      </p>
                    )}
                  {evidence.data.findings
                    .filter((f) => showPassingChecks || f.status !== 'pass')
                    .map((finding) => (
                      <details
                        key={finding.id}
                        className="rounded-lg border p-4 text-sm"
                      >
                        <summary className="cursor-pointer">
                          {surfaceLabel(finding.surface_key)} ·{' '}
                          {readable(finding.check_key)} ·{' '}
                          {readable(finding.status)}
                          {finding.severity ? ` · ${finding.severity}` : ''}
                        </summary>
                        {finding.target_id && (
                          <p className="mt-2 break-all">
                            Target: {finding.target_id}
                          </p>
                        )}
                        <Link
                          href={ownerHref(finding.surface_key)}
                          className="mt-2 inline-block text-primary underline"
                        >
                          Open surface owner
                        </Link>
                        <RawEvidence value={finding.evidence} />
                      </details>
                    ))}
                  {evidence.data.findings.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No findings recorded.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-5 max-w-3xl">
          {data?.policy && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Control observation cadence. Migration approval remains
                  manual.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Scheduled audits</p>
                    <p className="text-xs text-muted-foreground">
                      Observation only. Every{' '}
                      {data.policy.audit_interval_minutes} minutes.
                    </p>
                  </div>
                  <Switch
                    aria-label="Scheduled audits"
                    checked={data.policy.audit_enabled}
                    disabled={unavailable || savePolicy.isPending}
                    onCheckedChange={(v) =>
                      savePolicy.mutate({ audit_enabled: v })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Last audit:{' '}
                  {data.policy.last_audit_at
                    ? new Date(data.policy.last_audit_at).toLocaleString()
                    : 'never'}
                  . Campaign limits are reviewed when creating each draft.
                </p>
                <div className="border-t pt-4">
                  <h3 className="font-medium">Held semantic work</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Waiting for comparable embedding spaces before continuing.
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      ['Classification', data.held_work?.classification],
                      ['Topic remap', data.held_work?.topic_remap],
                      ['Relations', data.held_work?.relations],
                    ].map(([label, count]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-1 tabular-nums">
                          {count == null
                            ? 'Unavailable'
                            : number(Number(count))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Sheet
        open={inspector !== null}
        onOpenChange={(open) => {
          if (!open) setInspector(null);
        }}
      >
        <SheetContent
          hasAccessibleHeader
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetTitle>
            {inspector === 'models'
              ? 'Active model details'
              : surfaceLabel(inspector || '')}
          </SheetTitle>
          <SheetDescription className="mt-2">
            {inspector === 'models'
              ? 'Resolved model identities used to validate new vectors.'
              : 'Coverage from the latest audit, with owner and provenance evidence.'}
          </SheetDescription>
          {inspector === 'models' && data && (
            <div className="mt-6 space-y-6">
              {(['text', 'image'] as const).map((space) => {
                const model = data.spaces[space];
                return (
                  <section
                    key={space}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <h3 className="font-semibold capitalize">{space} model</h3>
                    <dl className="space-y-3 text-sm">
                      {[
                        ['Model', model.Model],
                        ['Dimensions', model.Dimensions],
                        ['Revision', model.Revision],
                        ['Space ID', model.SpaceID],
                        [
                          'Observed',
                          model.ObservedAt
                            ? new Date(model.ObservedAt).toLocaleString()
                            : null,
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-1 break-all">
                            {value || 'Unavailable'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {model.Err && (
                      <p className="text-sm text-destructive">{model.Err}</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {inspected && inspector && (
            <div className="mt-6 space-y-6">
              <Badge variant={verdictTone(inspected.verdict)}>
                {surfaceState(inspected)}
              </Badge>
              <CoverageBar s={inspected} />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Missing vectors', inspected.missing],
                  ['Mixed spaces', inspected.mixed_space],
                  ['Eligible candidates', inspected.eligible_candidates],
                  ['Excluded candidates', inspected.excluded_candidates],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 tabular-nums">
                      {value == null ? 'Unavailable' : number(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {inspected.note ||
                  'Current means produced by the expected model. Availability measures candidates that can be compared within a shared embedding space; these percentages may differ.'}
              </p>
              <Link
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                href={ownerHref(inspector)}
              >
                Open surface owner
                <ArrowRight className="h-4 w-4" />
              </Link>
              <details className="border-t pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Technical evidence
                </summary>
                <RawEvidence
                  value={{
                    summary: inspected,
                    registry: data?.surfaces.find((s) => s.Key === inspector),
                  }}
                />
              </details>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
