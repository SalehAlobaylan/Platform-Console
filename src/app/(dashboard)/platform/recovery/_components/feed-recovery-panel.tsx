'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { createRouteVisibleContext } from '@/lib/operator/route-manifest';
import {
  parseExplicitPodsResetIDs,
  podsResetApprovalPhrase,
} from '@/lib/pods-reset/policy';
import {
  useApproveFeedRecoveryPlan,
  useCancelFeedRecoveryRun,
  useCreateFeedRecoveryPlan,
  useExecuteFeedRecoveryRun,
  useFeedRecoveryActions,
  useFeedRecoveryPlan,
  useFeedRecoveryRuns,
  useRollbackFeedRecoveryRun,
} from '@/hooks/use-feed-recovery';
import {
  useApprovePodsResetPlan,
  useCancelPodsResetPlan,
  useCreatePodsResetPreview,
  useExecutePodsResetRun,
  usePodsResetPlan,
  usePodsResetRuns,
  useRequestPodsResetPause,
  useResumePodsResetRun,
  usePodsResetCandidates,
} from '@/hooks/use-pods-reset';
import type {
  FeedRecoveryLane,
  FeedRecoveryLevel,
} from '@/types/platform/feed-recovery';
import type {
  PodsResetPreviewResponse,
  PodsResetItem,
  PodsResetRun,
  PodsResetTargetPreview,
  PodsResetCandidateQuery,
} from '@/types/platform/pods-reset';

const resumablePhases = [
  'cancel_window',
  'verification_wait',
  'partial',
  'failed',
  'executing',
  'reseeding',
  'purging_news',
  'reseeding_news',
  'purging_media',
  'reseeding_media',
];
const recoveryOperatorContext = (type: string, id: string, label: string) =>
  createRouteVisibleContext('/platform/recovery', {
    subjects: [{ type, id, label }],
  });
const podsResetExecutionReleased = false;
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(1)} ${unit}`;
};

function manifestTargets(run?: PodsResetRun): PodsResetTargetPreview[] {
  const targets = run?.manifest?.targets;
  return Array.isArray(targets) ? (targets as PodsResetTargetPreview[]) : [];
}

export default function FeedRecoveryPanel() {
  const [lane, setLane] = useState<FeedRecoveryLane>('news');
  const [level, setLevel] = useState<FeedRecoveryLevel>('repair');
  const [planID, setPlanID] = useState('');
  const [selectedRunID, setSelectedRunID] = useState<string>();
  const [phrase, setPhrase] = useState('');
  const [executePassword, setExecutePassword] = useState('');
  const [resetIdsText, setResetIdsText] = useState('');
  const [resetSelectionReason, setResetSelectionReason] = useState('');
  const [resetRunID, setResetRunID] = useState('');
  const [resetPreview, setResetPreview] = useState<PodsResetPreviewResponse>();
  const [resetPhraseInput, setResetPhraseInput] = useState('');
  const [candidateType, setCandidateType] = useState<NonNullable<PodsResetCandidateQuery['type']>>('ALL');
  const [candidateStatus, setCandidateStatus] = useState<NonNullable<PodsResetCandidateQuery['status']>>('ALL');
  const [candidateSourceID, setCandidateSourceID] = useState('');
  const [candidateCreatedAfter, setCandidateCreatedAfter] = useState('');
  const [candidateCreatedBefore, setCandidateCreatedBefore] = useState('');
  const [candidateProcessingAfter, setCandidateProcessingAfter] = useState('');
  const [candidateProcessingBefore, setCandidateProcessingBefore] = useState('');
  const [candidateCursor, setCandidateCursor] = useState<string>();
  const [candidateSearchEnabled, setCandidateSearchEnabled] = useState(false);
  const [selectedCandidateIDs, setSelectedCandidateIDs] = useState<string[]>([]);

  const create = useCreateFeedRecoveryPlan();
  const plan = useFeedRecoveryPlan(planID);
  const approve = useApproveFeedRecoveryPlan();
  const execute = useExecuteFeedRecoveryRun();
  const cancel = useCancelFeedRecoveryRun();
  const rollback = useRollbackFeedRecoveryRun();
  const runs = useFeedRecoveryRuns();
  const actions = useFeedRecoveryActions(selectedRunID);
  const current = plan.data;
  const operatorContext = createRouteVisibleContext('/platform/recovery');
  const expectedRecoveryPhrase = `APPROVE FEED RECOVERY ${current?.manifest_hash.slice(0, 12).toUpperCase() || ''}`;

  const createReset = useCreatePodsResetPreview();
  const approveReset = useApprovePodsResetPlan();
  const cancelReset = useCancelPodsResetPlan();
  const executeReset = useExecutePodsResetRun();
  const pauseReset = useRequestPodsResetPause();
  const resumeReset = useResumePodsResetRun();
  const resetRuns = usePodsResetRuns();
  const resetPlan = usePodsResetPlan(resetRunID);
  const activeResetRun = resetPlan.data?.run ?? resetPreview?.run;
  const resetTargets = useMemo(
    () => resetPreview?.items ?? manifestTargets(activeResetRun),
    [activeResetRun, resetPreview]
  );
  const resetProgressItems = useMemo(
    () =>
      (resetPlan.data?.items ?? []).filter(
        (item): item is PodsResetItem => 'state' in item
      ),
    [resetPlan.data]
  );
  const resetCount =
    resetTargets.length ||
    (Array.isArray(activeResetRun?.manifest?.requested_ids)
      ? activeResetRun.manifest.requested_ids.length
      : 0);
  const expectedResetPhrase = activeResetRun
    ? podsResetApprovalPhrase(activeResetRun.manifest_hash, resetCount)
    : '';
  const parsedResetIds = useMemo(
    () => parseExplicitPodsResetIDs(resetIdsText),
    [resetIdsText]
  );
  const candidateQuery = useMemo<PodsResetCandidateQuery>(() => {
    const iso = (value: string) => value ? new Date(value).toISOString() : undefined;
    return {
      type: candidateType,
      status: candidateStatus,
      source_id: candidateSourceID.trim() || undefined,
      created_after: iso(candidateCreatedAfter),
      created_before: iso(candidateCreatedBefore),
      processing_after: iso(candidateProcessingAfter),
      processing_before: iso(candidateProcessingBefore),
      cursor: candidateCursor,
      limit: 50,
    };
  }, [candidateType, candidateStatus, candidateSourceID, candidateCreatedAfter, candidateCreatedBefore, candidateProcessingAfter, candidateProcessingBefore, candidateCursor]);
  const candidates = usePodsResetCandidates(candidateQuery, candidateSearchEnabled);
  const resetCanApprove = resetPreview
    ? resetPreview.can_approve
    : activeResetRun?.state === 'preview' &&
      resetTargets.length > 0 &&
      resetTargets.every((target) => !target.blockers?.length);

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Feed Recovery &amp; Pods Reset
          </h1>
          <p className="text-sm text-muted-foreground">
            Repair and Rotate remain derived-state recovery workflows. The
            legacy combined Purge &amp; Reseed operation is disabled; cleanup
            and repopulation are separate decisions.
          </p>
        </div>
        {operatorContext && (
          <OperatorLaunchLink
            context={operatorContext}
            intent="investigate"
            variant="outline"
          >
            Explain recovery state
          </OperatorLaunchLink>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feed recovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['news', 'media', 'both'] as FeedRecoveryLane[]).map((value) => (
              <Button
                key={value}
                variant={lane === value ? 'default' : 'outline'}
                onClick={() => setLane(value)}
              >
                {value}
              </Button>
            ))}
            {(['repair', 'rotate'] as FeedRecoveryLevel[]).map((value) => (
              <Button
                key={value}
                variant={level === value ? 'secondary' : 'outline'}
                onClick={() => setLevel(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Repair and Rotate do not delete canonical media payload. Broad Purge
            &amp; Reseed is unavailable here and cannot be approved through its
            legacy endpoint.
          </p>
          <Button
            disabled={create.isPending}
            onClick={async () => {
              const value = await create.mutateAsync({
                lane,
                level,
                capacity_mode: 'safe_cutover',
              });
              setPlanID(value.id);
            }}
          >
            Prepare recovery plan
          </Button>
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle>
              Recovery plan <Badge>{current.state}</Badge>{' '}
              <Badge variant="outline">
                {current.capacity_mode.replace('_', ' ')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {recoveryOperatorContext(
              'feed_recovery_plan',
              current.id,
              'Recovery plan'
            ) && (
              <OperatorLaunchLink
                context={
                  recoveryOperatorContext(
                    'feed_recovery_plan',
                    current.id,
                    'Recovery plan'
                  )!
                }
                intent="explain"
                size="sm"
                variant="outline"
              >
                Explain this plan
              </OperatorLaunchLink>
            )}
            <p>
              Sources: {current.source_count} · frozen targets:{' '}
              {current.target_count} · proof{' '}
              {current.source_checksum.slice(0, 12)}…
            </p>
            <p className="break-all">Manifest: {current.manifest_hash}</p>
            <p>
              Confirmation: <code>{expectedRecoveryPhrase}</code>
            </p>
            <Input
              placeholder="Confirmation phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
            <Button
              disabled={approve.isPending || !phrase}
              onClick={() => approve.mutate({ plan: current, phrase })}
            >
              Approve
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Explicit Pods reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            This is a purge-only, irreversible workflow. It retains a minimal
            retired identity and required audit history; it does not promise
            zero database rows or a full rollback. Retired source identities
            cannot be automatically rebuilt. Preview is read-only, and execution
            remains capability-gated off by default. Previously cached or
            downloaded copies are outside this origin-storage deletion proof.
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <div>
              <h3 className="text-sm font-medium">Find candidate Pods items</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Read-only, tenant-scoped discovery across visible and hidden states. Filters help narrow the list; CMS does not record the Pods infrastructure-rule version, so age and stage history are never labeled as proof that an item is legacy.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-xs"><span>Type</span><select className="h-9 w-full rounded-md border bg-background px-2" value={candidateType} onChange={(event) => { setCandidateType(event.target.value as NonNullable<PodsResetCandidateQuery['type']>); setCandidateCursor(undefined); }}><option value="ALL">Video + Podcast</option><option value="VIDEO">Video</option><option value="PODCAST">Podcast</option></select></label>
              <label className="space-y-1 text-xs"><span>Status</span><select className="h-9 w-full rounded-md border bg-background px-2" value={candidateStatus} onChange={(event) => { setCandidateStatus(event.target.value as NonNullable<PodsResetCandidateQuery['status']>); setCandidateCursor(undefined); }}><option value="ALL">All statuses</option><option value="READY">Ready</option><option value="FAILED">Failed</option><option value="ARCHIVED">Archived</option><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option></select></label>
              <label className="space-y-1 text-xs"><span>Content source UUID (optional)</span><Input value={candidateSourceID} onChange={(event) => { setCandidateSourceID(event.target.value); setCandidateCursor(undefined); }} placeholder="Exact source ID" /></label>
              <label className="space-y-1 text-xs"><span>Created after (inclusive)</span><Input type="datetime-local" value={candidateCreatedAfter} onChange={(event) => { setCandidateCreatedAfter(event.target.value); setCandidateCursor(undefined); }} /></label>
              <label className="space-y-1 text-xs"><span>Created before (exclusive)</span><Input type="datetime-local" value={candidateCreatedBefore} onChange={(event) => { setCandidateCreatedBefore(event.target.value); setCandidateCursor(undefined); }} /></label>
              <label className="space-y-1 text-xs"><span>Last current-generation stage updated after</span><Input type="datetime-local" value={candidateProcessingAfter} onChange={(event) => { setCandidateProcessingAfter(event.target.value); setCandidateCursor(undefined); }} /></label>
              <label className="space-y-1 text-xs"><span>Last current-generation stage updated before</span><Input type="datetime-local" value={candidateProcessingBefore} onChange={(event) => { setCandidateProcessingBefore(event.target.value); setCandidateCursor(undefined); }} /></label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={candidates.isFetching} onClick={() => { setCandidateCursor(undefined); setCandidateSearchEnabled(true); }}>
                {candidateSearchEnabled ? 'Refresh candidate list' : 'Search candidate items'}
              </Button>
              <span className="text-xs text-muted-foreground">Selected for explicit preview: {selectedCandidateIDs.length}/30</span>
              <Button variant="outline" disabled={selectedCandidateIDs.length === 0} onClick={() => setResetIdsText(selectedCandidateIDs.join('\n'))}>
                Use selected IDs below
              </Button>
              <Button variant="ghost" disabled={selectedCandidateIDs.length === 0} onClick={() => setSelectedCandidateIDs([])}>
                Clear candidate selection
              </Button>
            </div>
            {candidates.error && <p className="text-xs text-destructive">Candidate lookup failed: {(candidates.error as Error).message}</p>}
            {candidates.data && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Processing provenance: unknown relative to the infrastructure-rule rollout. Review each exact UUID; the standard reset preview rechecks tenant, protections, metadata owners, and storage.</p>
                <ul className="max-h-96 space-y-2 overflow-auto">
                  {candidates.data.items.map((candidate) => {
                    const selected = selectedCandidateIDs.includes(candidate.content_item_id);
                    const canSelect = selected || selectedCandidateIDs.length < 30;
                    return <li key={candidate.content_item_id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-start gap-2">
                        <input aria-label={`Select ${candidate.content_item_id}`} type="checkbox" checked={selected} disabled={!canSelect} onChange={(event) => setSelectedCandidateIDs((current) => event.target.checked ? [...current, candidate.content_item_id] : current.filter((id) => id !== candidate.content_item_id))} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2"><code className="break-all">{candidate.content_item_id}</code><Badge variant="outline">{candidate.type}</Badge><Badge variant="outline">{candidate.status}</Badge><Badge variant="secondary">provenance unknown</Badge></div>
                          <p className="text-muted-foreground">Source {candidate.source}{candidate.content_source_id ? ` · ${candidate.content_source_id}` : ''} · created {new Date(candidate.created_at).toLocaleString()} · generation {candidate.processing_generation} · stable retirement identity {candidate.retirement_identity_available ? 'available' : 'missing (preview will block)'}</p>
                          <p className="text-muted-foreground">Stages: {candidate.stage_evidence.length ? candidate.stage_evidence.map((stage) => `${stage.stage}=${stage.state} (${stage.policy_version || 'policy unknown'})`).join(' · ') : 'no current-generation stage evidence'}</p>
                        </div>
                      </div>
                    </li>;
                  })}
                </ul>
                {candidates.data.has_more && <Button variant="outline" size="sm" disabled={candidates.isFetching} onClick={() => setCandidateCursor(candidates.data?.next_cursor || undefined)}>Load next page</Button>}
              </div>
            )}
          </div>
          <label className="block space-y-2 text-sm">
            <span>
              Exact content item UUIDs (one per line, comma, or space; maximum
              30, with at most 1000 frozen objects and 25 GiB per run)
            </span>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              value={resetIdsText}
              onChange={(event) => setResetIdsText(event.target.value)}
              placeholder="Paste exact Pods VIDEO/PODCAST content IDs"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>
              Why these exact IDs are in scope (required, max 500 characters)
            </span>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              maxLength={500}
              value={resetSelectionReason}
              onChange={(event) => setResetSelectionReason(event.target.value)}
              placeholder="For example: legacy items processed before the Pods infrastructure rules rollout"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Unique valid IDs: {parsedResetIds.ids.length} / 30 · duplicates:{' '}
              {parsedResetIds.duplicates.length} · invalid:{' '}
              {parsedResetIds.invalid.length}
            </span>
            <Button
              disabled={
                createReset.isPending ||
                resetSelectionReason.trim().length === 0 ||
                resetSelectionReason.trim().length > 500 ||
                parsedResetIds.ids.length === 0 ||
                parsedResetIds.ids.length > 30 ||
                parsedResetIds.duplicates.length > 0 ||
                parsedResetIds.invalid.length > 0
              }
              onClick={async () => {
                const preview = await createReset.mutateAsync({
                  contentIds: parsedResetIds.ids,
                  selectionReason: resetSelectionReason.trim(),
                });
                setResetPreview(preview);
                setResetRunID(preview.run.id);
                setResetPhraseInput('');
              }}
            >
              Create read-only preview
            </Button>
          </div>

          {activeResetRun && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">Reset manifest</h3>
                <Badge>{activeResetRun.state}</Badge>
                <Badge variant="outline">{activeResetRun.phase}</Badge>
                <span className="text-xs text-muted-foreground">
                  policy v{activeResetRun.policy_version} · expires{' '}
                  {new Date(activeResetRun.expires_at).toLocaleString()}
                </span>
              </div>
              <p className="break-all text-xs">
                Manifest {activeResetRun.manifest_hash}
              </p>
              <p className="text-xs text-muted-foreground">
                Environment:{' '}
                {JSON.stringify(
                  activeResetRun.manifest.environment_identity ?? 'unknown'
                )}{' '}
                · schema {activeResetRun.schema_fingerprint.slice(0, 12)}…
              </p>
              <p className="text-sm">
                Selection reason:{' '}
                {String(
                  activeResetRun.manifest.selection_reason ?? 'not recorded'
                )}
              </p>
              <p className="text-sm">
                Exact items: {resetCount} · frozen objects:{' '}
                {resetPreview?.counts.object_count ??
                  resetPlan.data?.objects.length ??
                  0}{' '}
                · listed bytes:{' '}
                {formatBytes(
                  resetPreview?.counts.object_bytes ??
                    resetPlan.data?.objects.reduce(
                      (sum, object) => sum + object.size_bytes,
                      0
                    ) ??
                    0
                )}
              </p>

              {resetTargets.length > 0 ? (
                <div className="space-y-3">
                  {resetTargets.map((target) => (
                    <div
                      key={target.content_item_id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <code>{target.content_item_id}</code>
                        <Badge
                          variant={
                            target.blockers?.length
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {target.blockers?.length ? 'blocked' : 'eligible'}
                        </Badge>
                      </div>
                      {target.blockers?.length ? (
                        <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                          {target.blockers.map((blocker) => (
                            <li key={`${blocker.code}:${blocker.message}`}>
                              {blocker.code}: {blocker.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Type {String(target.snapshot.type ?? 'unknown')} ·
                          status {String(target.snapshot.status ?? 'unknown')} ·
                          tiers {target.storage_tiers?.join(', ') || 'unknown'}{' '}
                          ·
                          {target.storage_version_model ||
                            'unknown version model'}{' '}
                          · object keys frozen below.
                        </p>
                      )}
                      {target.metadata_counts && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer">
                            Related metadata inventory (counts, not deletion
                            totals)
                          </summary>
                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-3">
                            {Object.entries(target.metadata_counts)
                              .sort(([left], [right]) =>
                                left.localeCompare(right)
                              )
                              .map(([table, count]) => (
                                <div
                                  key={table}
                                  className="flex justify-between gap-2"
                                >
                                  <dt className="font-mono">{table}</dt>
                                  <dd>{count}</dd>
                                </div>
                              ))}
                          </dl>
                        </details>
                      )}
                      {target.data_decisions?.length > 0 && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {target.data_decisions.map((decision) => (
                            <div
                              key={decision.class}
                              className="rounded bg-muted/40 p-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                  {decision.class}
                                </span>
                                <Badge variant="outline">
                                  {decision.disposition}
                                </Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {decision.reason} Owner: {decision.owner}.{' '}
                                {decision.postcondition}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {target.objects?.length > 0 && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer">
                            {target.objects.length} frozen object identities
                          </summary>
                          <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono">
                            {target.objects.map((object) => (
                              <li
                                key={`${object.storage_tier}/${object.bucket}/${object.object_key}`}
                                className="break-all"
                              >
                                {object.storage_tier} · {object.bucket} ·{' '}
                                {object.object_key} ·{' '}
                                {formatBytes(object.size_bytes)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Detailed targets are unavailable; the manifest cannot be
                  approved until a fresh complete preview is available.
                </p>
              )}

              {resetProgressItems.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-sm font-medium">
                    Per-item execution ledger
                  </h4>
                  <ul className="space-y-2 text-xs">
                    {resetProgressItems.map((item) => (
                      <li
                        key={item.content_item_id}
                        className="rounded border p-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <code>{item.content_item_id}</code>
                          <Badge
                            variant={
                              item.state === 'complete'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {item.state}
                          </Badge>
                          <span className="text-muted-foreground">
                            Origin absence probes: {item.verification_probe_count ?? 0}/2
                          </span>
                        </div>
                        {item.verification_not_before && (
                          <p className="mt-1 text-muted-foreground">
                            Second origin check is not due before{' '}
                            {new Date(item.verification_not_before).toLocaleString()}.
                          </p>
                        )}
                        {item.last_error && (
                          <p className="mt-1 text-destructive">
                            {item.last_error}
                          </p>
                        )}
                        {item.blocked_reasons?.map((reason) => (
                          <p
                            key={`${reason.code}:${reason.message}`}
                            className="mt-1 text-destructive"
                          >
                            {reason.code}: {reason.message}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {(resetPlan.data?.actions?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-sm font-medium">
                        Committed action evidence
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Finalized identities:{' '}
                        {resetPlan.data?.actions.length ?? 0} · hard-deleted
                        rows:{' '}
                        {resetPlan.data?.actions.reduce(
                          (sum, action) =>
                            sum + Number(action.result.hard_deleted_rows ?? 0),
                          0
                        ) ?? 0}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {resetPlan.data?.actions.map((action) => (
                          <li
                            key={action.id}
                            className="break-all rounded border p-2"
                          >
                            {action.content_item_id} · {action.action} ·{' '}
                            {String(action.result.objects_deleted ?? 0)} objects
                            deleted ·{' '}
                            {String(action.result.objects_already_absent ?? 0)}{' '}
                            already absent ·{' '}
                            {formatBytes(
                              Number(action.result.bytes_freed ?? 0)
                            )}{' '}
                            freed
                            {!!action.result.metadata_effects && (
                              <details className="mt-2 rounded border p-2">
                                <summary className="cursor-pointer font-medium">
                                  Metadata disposition evidence
                                </summary>
                                <p className="mt-1 text-muted-foreground">
                                  Retained identity; zero content rows hard-deleted.
                                  Shared transcripts preserved:{' '}
                                  {String(
                                    action.result.shared_transcripts_preserved ?? 0
                                  )}
                                  .
                                </p>
                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
                                  {JSON.stringify(
                                    {
                                      affected_rows:
                                        action.result.metadata_effects,
                                      approved_dispositions:
                                        action.result.metadata_decisions,
                                      preflight_counts:
                                        action.result.metadata_counts_before,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <p className="text-sm">
                  Required irreversible confirmation:{' '}
                  <code className="break-all">{expectedResetPhrase}</code>
                </p>
                <Input
                  placeholder="Type the exact irreversible confirmation"
                  value={resetPhraseInput}
                  onChange={(event) => setResetPhraseInput(event.target.value)}
                />
                {activeResetRun.state === 'preview' && (
                  <Button
                    disabled={
                      !resetCanApprove ||
                      approveReset.isPending ||
                      resetPhraseInput !== expectedResetPhrase
                    }
                    onClick={() =>
                      approveReset.mutate({
                        id: activeResetRun.id,
                        phrase: resetPhraseInput,
                      })
                    }
                  >
                    Approve exact reset manifest
                  </Button>
                )}
                {(['preview', 'approved'].includes(activeResetRun.state) ||
                  Boolean(resetPlan.data?.can_cancel)) && (
                  <Button
                    variant="outline"
                    disabled={cancelReset.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Cancel this plan? No retirement fence or object deletion has begun, and a cancelled plan cannot be resumed.'
                        )
                      ) {
                        cancelReset.mutate(activeResetRun.id);
                      }
                    }}
                  >
                    Cancel before execution
                  </Button>
                )}
                {['approved', 'executing', 'partial'].includes(
                  activeResetRun.state
                ) && (
                  <div className="flex flex-wrap gap-2">
                    {activeResetRun.pause_requested ? (
                      <Button
                        variant="outline"
                        disabled={
                          !podsResetExecutionReleased ||
                          resumeReset.isPending ||
                          activeResetRun.state === 'executing'
                        }
                        onClick={() => resumeReset.mutate(activeResetRun.id)}
                      >
                        {activeResetRun.state === 'executing'
                          ? 'Pause requested; waiting for item boundary'
                          : 'Resume exact reset'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={
                          !podsResetExecutionReleased || pauseReset.isPending
                        }
                        onClick={() => pauseReset.mutate(activeResetRun.id)}
                      >
                        Pause after current item
                      </Button>
                    )}
                    <Button
                      disabled={
                        !podsResetExecutionReleased ||
                        executeReset.isPending ||
                        activeResetRun.pause_requested
                      }
                      onClick={() => executeReset.mutate(activeResetRun.id)}
                    >
                      {podsResetExecutionReleased
                        ? activeResetRun.state === 'partial'
                          ? 'Continue exact reset'
                          : 'Execute approved reset'
                        : 'Execution locked pending qualification'}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  After the first retirement fence, rollback is unavailable.
                  Runs process at most 3 items per request and pause only at an
                  item boundary. Partial runs can only resume the same frozen
                  manifest; any changed selection needs a new preview.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feed recovery ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm">Final execution confirmation</p>
            <p className="text-xs text-muted-foreground">
              Enter the admin password only when continuing an approved recovery
              run.
            </p>
            <Input
              type="password"
              placeholder="Admin password for execution confirmation"
              value={executePassword}
              onChange={(event) => setExecutePassword(event.target.value)}
            />
          </div>
          {runs.data?.data?.length ? (
            <ul className="space-y-2">
              {runs.data.data.map((run) => (
                <li key={run.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{run.phase}</Badge>
                    <Badge variant="outline">{run.lane}</Badge>
                    {run.expected_empty && (
                      <Badge variant="warning">expected empty</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                    {run.error && (
                      <span className="text-xs text-destructive">
                        {run.error}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRunID(run.id)}
                    >
                      Inspect gates
                    </Button>
                    {recoveryOperatorContext(
                      'feed_recovery_run',
                      run.id,
                      'Recovery run'
                    ) && (
                      <OperatorLaunchLink
                        context={
                          recoveryOperatorContext(
                            'feed_recovery_run',
                            run.id,
                            'Recovery run'
                          )!
                        }
                        intent="explain"
                        size="sm"
                        variant="outline"
                      >
                        Explain run
                      </OperatorLaunchLink>
                    )}
                    {resumablePhases.includes(run.phase) && (
                      <Button
                        size="sm"
                        onClick={() =>
                          run.plan_id &&
                          execute.mutate({
                            id: run.id,
                            planID: run.plan_id,
                            password: executePassword,
                          })
                        }
                        disabled={
                          execute.isPending || !executePassword || !run.plan_id
                        }
                      >
                        Continue
                      </Button>
                    )}
                    {run.phase === 'cancel_window' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancel.mutate(run.id)}
                        disabled={cancel.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    {run.outcome === 'succeeded' &&
                      run.rollback_deadline &&
                      new Date(run.rollback_deadline) > new Date() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rollback.mutate(run.id)}
                          disabled={rollback.isPending}
                        >
                          Rollback
                        </Button>
                      )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lease {run.lane_lease || 'not acquired'} · correlation{' '}
                    {run.correlation_id}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No feed recovery runs recorded.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedRunID && (
        <Card>
          <CardHeader>
            <CardTitle>D27 gate and saga evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.data?.length ? (
              actions.data.map((action) => (
                <div key={action.id} className="rounded-md border p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        action.state === 'succeeded'
                          ? 'success'
                          : action.state === 'blocked'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {action.state}
                    </Badge>
                    <span className="font-medium">{action.action_type}</span>
                    <span className="text-muted-foreground">
                      {new Date(action.created_at).toLocaleString()}
                    </span>
                  </div>
                  {action.error && (
                    <p className="mt-1 text-destructive">{action.error}</p>
                  )}
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {JSON.stringify(action.evidence ?? {}, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No action evidence recorded for this run.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pods reset ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {resetRuns.data?.length ? (
            <ul className="space-y-2">
              {resetRuns.data.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
                >
                  <Badge
                    variant={
                      run.state === 'complete'
                        ? 'success'
                        : run.state === 'partial'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {run.state}
                  </Badge>
                  <Badge variant="outline">{run.phase}</Badge>
                  <code>{run.manifest_hash.slice(0, 12)}…</code>
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleString()} ·{' '}
                    {run.created_by}
                  </span>
                  {run.error && (
                    <span className="text-xs text-destructive">
                      {run.error}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setResetPreview(undefined);
                      setResetRunID(run.id);
                      setResetPhraseInput('');
                    }}
                  >
                    Inspect
                  </Button>
                  {['approved', 'executing', 'partial'].includes(run.state) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setResetPreview(undefined);
                        setResetRunID(run.id);
                        executeReset.mutate(run.id);
                      }}
                      disabled={executeReset.isPending}
                    >
                      Resume same manifest
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Pods reset runs recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
