'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { createRouteVisibleContext } from '@/lib/operator/route-manifest';
import { podsResetApprovalPhrase } from '@/lib/pods-reset/policy';
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
  useCreatePodsResetProtectionPreview,
  useExecutePodsResetRun,
  usePodsResetPlan,
  usePodsResetRuns,
  useRequestPodsResetPause,
  useResumePodsResetRun,
  usePodsResetCandidates,
} from '@/hooks/use-pods-reset';
import type { FeedRecoveryLane, FeedRecoveryLevel } from '@/types/platform/feed-recovery';
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
const formatCount = (value?: number) => (value === undefined ? '—' : value.toLocaleString('en-US'));
const formatBytes = (bytes?: number) => {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return value.toFixed(1) + ' ' + units[index];
};
const dateLabel = (value: string) => new Date(value).toLocaleDateString();
const resetItemLabels: Record<string, string> = {
  planned: 'Waiting', fenced: 'Prepared', verification_pending: 'Verifying file deletion',
  objects_deleted: 'Clearing content payload', complete: 'Deleted', blocked: 'Blocked',
};
const contextFor = (type: string, id: string, label: string) =>
  createRouteVisibleContext('/platform/recovery', { subjects: [{ type, id, label }] });
function manifestTargets(run?: PodsResetRun): PodsResetTargetPreview[] {
  return Array.isArray(run?.manifest?.targets) ? (run.manifest.targets as PodsResetTargetPreview[]) : [];
}
function manifestCount(run?: PodsResetRun): number | undefined {
  return Array.isArray(run?.manifest?.requested_ids) ? run.manifest.requested_ids.length : undefined;
}

export default function FeedRecoveryPanel() {
  const [view, setView] = useState('delete');
  const [lane, setLane] = useState<FeedRecoveryLane>('news');
  const [level, setLevel] = useState<FeedRecoveryLevel>('repair');
  const [planID, setPlanID] = useState('');
  const [selectedRunID, setSelectedRunID] = useState<string>();
  const [phrase, setPhrase] = useState('');
  const [executionTarget, setExecutionTarget] = useState<{ kind: 'feed' | 'pods'; id: string; planID?: string }>();
  const [executeCount, setExecuteCount] = useState('');
  const [itemCountText, setItemCountText] = useState('');
  const [selectionTitles, setSelectionTitles] = useState<Record<string, string>>({});
  const [resetSelectionReason, setResetSelectionReason] = useState('');
  const [resetRunID, setResetRunID] = useState('');
  const [resetPreview, setResetPreview] = useState<PodsResetPreviewResponse>();
  const [resetPhraseInput, setResetPhraseInput] = useState('');
  const [resetOverrideCodes, setResetOverrideCodes] = useState<string[]>([]);
  const [resetOverrideReason, setResetOverrideReason] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [candidateType, setCandidateType] = useState('ALL');
  const [candidateStatus, setCandidateStatus] = useState('ALL');
  const [candidateSourceID, setCandidateSourceID] = useState('');
  const [candidateCreatedAfter, setCandidateCreatedAfter] = useState('');
  const [candidateCreatedBefore, setCandidateCreatedBefore] = useState('');
  const [candidateProcessingAfter, setCandidateProcessingAfter] = useState('');
  const [candidateProcessingBefore, setCandidateProcessingBefore] = useState('');
  const [filterError, setFilterError] = useState('');
  const [filters, setFilters] = useState<PodsResetCandidateQuery>({ type: 'ALL', status: 'ALL', limit: 50 });

  const create = useCreateFeedRecoveryPlan();
  const plan = useFeedRecoveryPlan(planID);
  const approve = useApproveFeedRecoveryPlan();
  const execute = useExecuteFeedRecoveryRun();
  const cancel = useCancelFeedRecoveryRun();
  const rollback = useRollbackFeedRecoveryRun();
  const runs = useFeedRecoveryRuns();
  const actions = useFeedRecoveryActions(selectedRunID);
  const current = plan.data;
  const expectedRecoveryPhrase = 'APPROVE FEED RECOVERY ' + (current?.manifest_hash.slice(0, 12).toUpperCase() ?? '');
  const operatorContext = createRouteVisibleContext('/platform/recovery');

  const createReset = useCreatePodsResetPreview();
  const createProtectionPreview = useCreatePodsResetProtectionPreview();
  const resetPreviewPending = createReset.isPending || createProtectionPreview.isPending;
  const approveReset = useApprovePodsResetPlan();
  const cancelReset = useCancelPodsResetPlan();
  const executeReset = useExecutePodsResetRun();
  const pauseReset = useRequestPodsResetPause();
  const resumeReset = useResumePodsResetRun();
  const resetRuns = usePodsResetRuns();
  const resetPlan = usePodsResetPlan(resetRunID);
  const activeResetRun = resetPlan.data?.run ?? resetPreview?.run;
  const resetTargets = resetPreview?.items ?? manifestTargets(activeResetRun);
  const resetProgressItems = (resetPlan.data?.items ?? []).filter((item): item is PodsResetItem => 'state' in item);
  const resetCount = manifestCount(activeResetRun) ?? resetTargets.length;
  const resetWorking = executeReset.isPending && executeReset.variables?.id === activeResetRun?.id;
  const resetPrepared = resetProgressItems.filter((item) => ['fenced', 'verification_pending', 'objects_deleted', 'complete'].includes(item.state)).length;
  const resetCompleted = resetProgressItems.filter((item) => item.state === 'complete').length;
  const resetFilesAbsent = resetPlan.data?.objects?.filter((object) => object.state === 'deleted').length ?? 0;
  const resetItemStates = new Map(resetProgressItems.map((item) => [item.content_item_id, item.state]));
  const expectedResetPhrase = activeResetRun ? podsResetApprovalPhrase(activeResetRun.manifest_hash, resetCount) : '';
  const candidates = usePodsResetCandidates(filters, view === 'delete');
  const candidateRows = candidates.data?.items ?? [];
  const matchingCount = candidates.isError ? undefined : candidates.data?.total_count;
  const requestedCount = /^\d+$/.test(itemCountText.trim()) ? Number(itemCountText) : NaN;
  const quantityValid = Number.isSafeInteger(requestedCount) && requestedCount >= 1;
  const enoughCandidates =
    quantityValid &&
    (matchingCount !== undefined
      ? requestedCount <= matchingCount
      : requestedCount <= candidateRows.length || candidates.data?.has_more === true);
  const selectedRows = enoughCandidates && !candidates.isError ? candidateRows.slice(0, requestedCount) : [];
  const selectedCount = enoughCandidates && !candidates.isError ? requestedCount : 0;
  const selectionValid = enoughCandidates && !candidates.isFetching && !candidates.isError;
  const blockedCount = resetTargets.filter((target) => target.blockers?.length).length;
  const overriddenItemCount = resetTargets.filter((target) => target.overridden_blockers?.length).length;
  const overriddenProtectionCount = resetTargets.reduce((count, target) => count + (target.overridden_blockers?.length ?? 0), 0);
  const savedOverrideCodes = JSON.stringify(activeResetRun?.manifest.protection_override_codes ?? []);
  const savedOverrideReason = String(activeResetRun?.manifest.protection_override_reason ?? '');
  const protectionOptions = resetPlan.data?.protection_override_options ?? resetPreview?.protection_override_options ?? [];
  const protectionCounts = new Map<string, number>();
  for (const target of resetTargets) {
    for (const code of new Set([...(target.blockers ?? []), ...(target.overridden_blockers ?? [])].map((blocker) => blocker.code))) {
      protectionCounts.set(code, (protectionCounts.get(code) ?? 0) + 1);
    }
  }
  const availableProtectionOptions = protectionOptions.filter((option) => protectionCounts.has(option.code));
  const resetRequestedIDs = Array.isArray(activeResetRun?.manifest.requested_ids)
    ? activeResetRun.manifest.requested_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const blockerSummary = new Map<string, { message: string; count: number }>();
  for (const target of resetTargets) {
    const counted = new Set<string>();
    for (const blocker of target.blockers ?? []) {
      if (counted.has(blocker.code)) continue;
      counted.add(blocker.code);
      const summary = blockerSummary.get(blocker.code) ?? { message: blocker.message, count: 0 };
      summary.count++;
      blockerSummary.set(blocker.code, summary);
    }
  }
  const resetCanApprove =
    activeResetRun?.state === 'preview' &&
    resetCount > 0 &&
    resetTargets.length === resetCount &&
    blockedCount === 0 &&
    resetPreview?.can_approve !== false;
  const resetApprovalUnavailable = resetPlan.isError
    ? 'The saved plan could not be verified. Reload it before approving.'
    : blockedCount
      ? `${blockedCount} of ${resetCount} contents are blocked. Resolve the issues and create a new preview. A confirmation phrase cannot approve blocked contents.`
      : !resetCanApprove || !expectedResetPhrase
        ? 'A complete, eligible deletion plan is unavailable. Create a new preview before approving.'
        : '';
  const resetPhraseMatches = resetPhraseInput.trim() === expectedResetPhrase;
  const resetObjects = resetPreview?.counts.object_count ?? resetPlan.data?.objects?.length;
  const resetBytes =
    resetPreview?.counts.object_bytes ?? resetPlan.data?.objects?.reduce((sum, object) => sum + object.size_bytes, 0);
  const resetInventoryUnavailable =
    blockerSummary.has('storage_inventory_incomplete') || blockerSummary.has('storage_inventory_invalid');
  useEffect(() => {
    if (view === 'delete' && activeResetRun?.id) {
      previewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [activeResetRun?.id, view]);
  useEffect(() => {
    const codes: unknown = JSON.parse(savedOverrideCodes);
    setResetOverrideCodes(Array.isArray(codes) ? codes.filter((code): code is string => typeof code === 'string') : []);
    setResetOverrideReason(savedOverrideReason);
  }, [activeResetRun?.id, savedOverrideCodes, savedOverrideReason]);

  const clearResetPreview = () => {
    setResetPreview(undefined);
    setResetRunID('');
    setResetPhraseInput('');
    setSelectionTitles({});
    setResetOverrideCodes([]);
    setResetOverrideReason('');
  };
  const updateCount = (text: string) => {
    setItemCountText(text);
    clearResetPreview();
  };
  const applyFilters = () => {
    if (resetPreviewPending) return;
    try {
      const iso = (value: string) => (value ? new Date(value).toISOString() : undefined);
      const next: PodsResetCandidateQuery = {
        type: candidateType as PodsResetCandidateQuery['type'],
        status: candidateStatus as PodsResetCandidateQuery['status'],
        source_id: candidateSourceID.trim() || undefined,
        created_after: iso(candidateCreatedAfter),
        created_before: iso(candidateCreatedBefore),
        processing_after: iso(candidateProcessingAfter),
        processing_before: iso(candidateProcessingBefore),
        limit: 50,
      };
      for (const [after, before] of [
        [next.created_after, next.created_before],
        [next.processing_after, next.processing_before],
      ]) {
        if (after && before && after >= before) throw new Error('Choose an end date after the start date.');
      }
      setFilterError('');
      clearResetPreview();
      if (JSON.stringify(next) === JSON.stringify(filters)) void candidates.refetch();
      else setFilters(next);
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : 'Check the selected dates.');
    }
  };
  const inspectReset = (id: string) => {
    setResetPreview(undefined);
    setResetRunID(id);
    setResetPhraseInput('');
    setView('delete');
  };

  const executionFeedPlan = useFeedRecoveryPlan(executionTarget?.kind === 'feed' ? executionTarget.planID : undefined);
  const executionPodsPlan = usePodsResetPlan(executionTarget?.kind === 'pods' ? executionTarget.id : undefined);
  const executionManifest =
    executionTarget?.kind === 'feed'
      ? executionFeedPlan.data?.manifest_hash
      : executionPodsPlan.data?.run.manifest_hash;
  const executionCount =
    executionTarget?.kind === 'feed'
      ? executionFeedPlan.data?.target_count
      : manifestCount(executionPodsPlan.data?.run);
  const executionPlanReady =
    executionTarget?.kind === 'feed'
      ? !executionFeedPlan.isFetching &&
        !executionFeedPlan.isError &&
        ['repair', 'rotate'].includes(executionFeedPlan.data?.level ?? '') &&
        executionCount === 0
      : Boolean(executionManifest) && (executionCount ?? 0) > 0;
  const executionPending = execute.isPending || executeReset.isPending;
  const openExecutionConfirmation = (target: NonNullable<typeof executionTarget>) => {
    setExecuteCount('');
    setExecutionTarget(target);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Content recovery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how many Pods items to remove, or repair a feed without deleting content.
          </p>
        </div>
        {operatorContext && (
          <div className="hidden sm:block">
            <OperatorLaunchLink context={operatorContext} intent="investigate" variant="outline">
              Explain recovery state
            </OperatorLaunchLink>
          </div>
        )}
      </header>
      <Tabs value={view} onValueChange={setView}>
        <TabsList aria-label="Recovery tools" className="mb-4 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="delete" className="px-2 text-xs sm:px-3 sm:text-sm">
            Pods cleanup
          </TabsTrigger>
          <TabsTrigger value="repair" className="px-2 text-xs sm:px-3 sm:text-sm">
            Repair feeds
          </TabsTrigger>
          <TabsTrigger value="history" className="px-2 text-xs sm:px-3 sm:text-sm">
            Run history
          </TabsTrigger>
        </TabsList>
        <TabsContent value="delete" className="space-y-4">
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
            <p className="font-medium">Delete Pods content</p>
            <p className="mt-1 text-muted-foreground">
              Enter the number of matching items to remove and review the deletion plan. Deletion is permanent once
              execution starts.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>1. Choose a quantity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl aria-label="Content counts" className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <dt className="min-h-8 text-xs text-muted-foreground sm:min-h-0">Matching contents</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {candidates.isPending ? 'Loading…' : formatCount(matchingCount)}
                  </dd>
                </div>
                <div>
                  <dt className="min-h-8 text-xs text-muted-foreground sm:min-h-0">Affected items</dt>
                  <dd aria-live="polite" className="mt-1 text-2xl font-semibold tabular-nums">
                    {selectedCount}
                  </dd>
                </div>
              </dl>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFilters();
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">
                    <span>Content type</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={candidateType}
                      onChange={(event) => setCandidateType(event.target.value)}
                    >
                      <option value="ALL">All media</option>
                      <option value="VIDEO">Videos</option>
                      <option value="PODCAST">Podcasts</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Status</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={candidateStatus}
                      onChange={(event) => setCandidateStatus(event.target.value)}
                    >
                      <option value="ALL">All statuses</option>
                      <option value="READY">Ready</option>
                      <option value="FAILED">Failed</option>
                      <option value="ARCHIVED">Archived</option>
                      <option value="PENDING">Pending</option>
                      <option value="PROCESSING">Processing</option>
                    </select>
                  </label>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Advanced filters</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span>Created from</span>
                      <Input
                        type="datetime-local"
                        value={candidateCreatedAfter}
                        onChange={(event) => setCandidateCreatedAfter(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span>Created before</span>
                      <Input
                        type="datetime-local"
                        value={candidateCreatedBefore}
                        onChange={(event) => setCandidateCreatedBefore(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Source ID</span>
                      <Input
                        placeholder="Exact source UUID"
                        value={candidateSourceID}
                        onChange={(event) => setCandidateSourceID(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Stage updated from</span>
                      <Input
                        type="datetime-local"
                        value={candidateProcessingAfter}
                        onChange={(event) => setCandidateProcessingAfter(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Stage updated before</span>
                      <Input
                        type="datetime-local"
                        value={candidateProcessingBefore}
                        onChange={(event) => setCandidateProcessingBefore(event.target.value)}
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dates and stage history help find content; they do not prove which infrastructure rules processed
                    it.
                  </p>
                </details>
                <Button type="submit" variant="outline" disabled={candidates.isFetching || resetPreviewPending}>
                  {candidates.isFetching ? 'Loading contents…' : 'Apply filters / Refresh'}
                </Button>
                {filterError && (
                  <p role="alert" className="text-sm text-destructive">
                    {filterError}
                  </p>
                )}
              </form>
              {candidates.isError && (
                <div role="alert" className="text-sm text-destructive">
                  Could not load contents or their count. {candidates.error.message}{' '}
                  <Button variant="outline" size="sm" onClick={() => void candidates.refetch()}>
                    Try again
                  </Button>
                </div>
              )}
              {!candidates.isError && candidates.data && matchingCount === undefined && (
                <p className="text-sm text-muted-foreground">
                  Total count is unavailable from this CMS version. The exact available quantity is checked while
                  preparing the preview.
                </p>
              )}
              <div className="space-y-3 border-t pt-4">
                <label className="block space-y-1 text-sm">
                  <span>Number of items to delete</span>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    placeholder="Enter a positive whole number"
                    value={itemCountText}
                    disabled={resetPreviewPending}
                    aria-describedby="quantity-help quantity-error"
                    aria-invalid={
                      Boolean(itemCountText && !quantityValid) ||
                      (quantityValid && !candidates.isFetching && !enoughCandidates)
                    }
                    onChange={(event) => updateCount(event.target.value)}
                  />
                </label>
                <p id="quantity-help" className="text-sm text-muted-foreground">
                  The system chooses this many matching items in a fixed inventory order. The preview lists exactly what
                  would be affected before approval.
                </p>
                <div id="quantity-error" aria-live="polite">
                  {itemCountText && !quantityValid && (
                    <p className="text-sm text-destructive">Enter a positive whole number.</p>
                  )}
                  {quantityValid && !candidates.isFetching && !candidates.isError && !enoughCandidates && (
                    <p className="text-sm text-destructive">
                      Only {matchingCount ?? candidateRows.length} matching items are available. Enter a smaller number
                      or change the filters.
                    </p>
                  )}
                </div>
                {!candidates.isPending && !candidates.isError && !candidateRows.length && (
                  <p className="text-sm text-muted-foreground">No contents match these filters.</p>
                )}
                <label className="block space-y-1 text-sm">
                  <span>
                    Reason for deletion <span aria-hidden="true">(required)</span>
                  </span>
                  <Input
                    maxLength={500}
                    required
                    placeholder="For example: failed imports that should be removed"
                    value={resetSelectionReason}
                    disabled={resetPreviewPending}
                    onChange={(event) => setResetSelectionReason(event.target.value)}
                  />
                </label>
                <Button
                  disabled={!selectionValid || !resetSelectionReason.trim() || resetPreviewPending}
                  onClick={() => {
                    createReset.mutate(
                      {
                        itemCount: requestedCount,
                        filters,
                        selectionReason: resetSelectionReason.trim(),
                      },
                      {
                        onSuccess: (preview) => {
                          setSelectionTitles(preview.selectionTitles);
                          setResetPreview(preview);
                          setResetRunID(preview.run.id);
                          setResetPhraseInput('');
                        },
                      }
                    );
                  }}
                >
                  {createReset.isPending ? 'Preparing preview…' : 'Preview ' + selectedCount + ' affected items'}
                </Button>
                {createReset.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {createReset.error.message}
                  </p>
                )}
              </div>
              {selectedCount > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    {selectedRows.length < selectedCount
                      ? 'View first ' + selectedRows.length + ' of ' + formatCount(selectedCount) + ' items'
                      : 'Review ' + selectedRows.length + ' matching items'}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {selectedRows.length < selectedCount && (
                      <p className="text-muted-foreground">
                        Showing the first {selectedRows.length} of {formatCount(selectedCount)} affected items. The
                        saved preview includes the complete selection.
                      </p>
                    )}
                    <div className="max-h-72 overflow-auto rounded-md border" aria-busy={candidates.isFetching}>
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-muted">
                          <tr>
                            <th className="p-3 font-medium">Content</th>
                            <th className="hidden p-3 font-medium sm:table-cell">Status</th>
                            <th className="hidden p-3 font-medium md:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRows.map((item) => (
                            <tr key={item.content_item_id} className="border-t align-top">
                              <td className="p-3">
                                <p dir="auto" className="max-w-xl break-words font-medium">
                                  {item.title?.trim() ||
                                    (item.type === 'VIDEO' ? 'Untitled video ' : 'Untitled podcast ') +
                                      item.content_item_id.slice(0, 8)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.type === 'VIDEO' ? 'Video' : 'Podcast'} · {item.source.replaceAll('_', ' ')}
                                  <span className="sm:hidden"> · {item.status.toLowerCase()}</span>
                                </p>
                                <details className="mt-2 text-xs text-muted-foreground">
                                  <summary className="cursor-pointer">Item details</summary>
                                  <p className="mt-2 break-all font-mono">{item.content_item_id}</p>
                                  <p>
                                    Source ID: {item.content_source_id || 'Not recorded'} · generation{' '}
                                    {item.processing_generation}
                                  </p>
                                  <p>
                                    Created {dateLabel(item.created_at)} ·{' '}
                                    {item.retirement_identity_available
                                      ? 'Retirement identity available'
                                      : 'Retirement identity unavailable'}
                                  </p>
                                  <p className="mt-1">
                                    Stages:{' '}
                                    {item.stage_evidence?.length
                                      ? item.stage_evidence
                                          .map(
                                            (stage) =>
                                              stage.stage + '=' + stage.state + ' (' + stage.policy_version + ')'
                                          )
                                          .join(' · ')
                                      : 'no current-generation stage evidence'}
                                  </p>
                                </details>
                              </td>
                              <td className="hidden p-3 sm:table-cell">
                                <Badge variant={item.status === 'FAILED' ? 'destructive' : 'outline'}>
                                  {item.status.toLowerCase()}
                                </Badge>
                              </td>
                              <td className="hidden whitespace-nowrap p-3 text-muted-foreground md:table-cell">
                                {dateLabel(item.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          {resetPlan.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not refresh the deletion plan. {resetPlan.error.message}
            </p>
          )}
          {activeResetRun && (
            <Card ref={previewRef} className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  2. Review deletion <Badge>{activeResetRun.state}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Contents in this plan</dt>
                    <dd className="mt-1 text-2xl font-semibold">{resetCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Listed files</dt>
                    <dd className="mt-1 text-2xl font-semibold">
                      {resetInventoryUnavailable && resetObjects === 0 ? 'Unavailable' : formatCount(resetObjects)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Listed storage</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {resetInventoryUnavailable && resetBytes === 0 ? 'Unavailable' : formatBytes(resetBytes)}
                    </dd>
                  </div>
                </dl>
                {['approved', 'executing', 'partial', 'complete'].includes(activeResetRun.state) && (
                  <div role="status" className="space-y-3 rounded-md border p-3 text-sm">
                    <p className="font-semibold">
                      {activeResetRun.state === 'complete' ? 'Deletion complete' : resetWorking ? (resetPrepared < resetCount ? 'Preparing contents before file deletion' : 'Deleting content and files') : 'Deletion progress'}
                    </p>
                    <dl className="grid grid-cols-3 gap-3 tabular-nums">
                      <div><dt className="text-muted-foreground">Contents prepared</dt><dd>{resetPrepared} / {resetCount}</dd></div>
                      <div><dt className="text-muted-foreground">Files verified absent</dt><dd>{resetFilesAbsent} / {formatCount(resetObjects)}</dd></div>
                      <div><dt className="text-muted-foreground">Contents deleted</dt><dd>{resetCompleted} / {resetCount}</dd></div>
                    </dl>
                    {resetPrepared < resetCount && <p>{resetCount - resetPrepared} contents still need preparation before file deletion begins.</p>}
                    {activeResetRun.state === 'complete' ? (
                      <p>The selected payloads are removed. Only retired identities and required audit history remain.</p>
                    ) : resetWorking ? (
                      <p>Keep this page open. Deletion continues automatically until it completes, pauses, or encounters an error.</p>
                    ) : (
                      <p>Confirm continuation once to process the remaining contents automatically.</p>
                    )}
                    {activeResetRun.error && <p role="alert" className="text-destructive">{activeResetRun.error}</p>}
                  </div>
                )}
                <p className="text-sm">Reason: {String(activeResetRun.manifest.selection_reason ?? 'Not recorded')}</p>
                {overriddenItemCount > 0 && (
                  <div role="status" className="space-y-1 rounded-md border p-3 text-sm">
                    <p className="font-semibold">Fresh-start overrides applied</p>
                    <p>{formatCount(overriddenProtectionCount)} blockers overridden across {formatCount(overriddenItemCount)} contents.</p>
                    <p>Reason: {savedOverrideReason}</p>
                    <p className="text-muted-foreground">
                      {blockedCount > 0
                        ? 'Your choices were saved. Approval is waiting on the remaining checks below.'
                        : 'Review the overridden blockers below. Approval covers these choices.'}
                    </p>
                  </div>
                )}
                {activeResetRun.state === 'preview' && resetApprovalUnavailable ? (
                  <div id="pods-reset-approval-blocker" role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
                    <p className="font-semibold">{overriddenItemCount > 0 ? 'Remaining checks prevent approval' : 'Approval unavailable'}</p>
                    <p>{resetApprovalUnavailable}</p>
                    {blockedCount > 0 && (
                      <ul className="space-y-1">
                        {Array.from(blockerSummary.entries())
                          .sort(([, left], [, right]) => right.count - left.count)
                          .map(([code, summary]) => (
                            <li key={code}>
                              <strong>{formatCount(summary.count)} items:</strong> {summary.message}
                            </li>
                          ))}
                      </ul>
                    )}
                    {resetInventoryUnavailable && (
                      <p>Restore file verification in Aggregation, then create a new preview. Full file deletion must be verified before approval.</p>
                    )}
                    {Array.from(blockerSummary.keys()).some((code) => code.startsWith('active_') || code === 'content_not_terminal') && (
                      <p>Discard the listed unfinished records with the choices below, or reconcile them through their owning service. Live provider effects and leases must be stopped and reconciled before file deletion.</p>
                    )}
                  </div>
                ) : activeResetRun.state === 'preview' ? (
                  <p className="text-sm text-muted-foreground">
                    Review the selected contents before approving this plan. Approval does not start deletion.
                  </p>
                ) : null}
                {activeResetRun.state === 'preview' && availableProtectionOptions.length > 0 && (
                  <fieldset className="space-y-3 rounded-md border p-3 text-sm" disabled={resetPreviewPending}>
                    <legend className="px-1 font-semibold">Fresh-start overrides</legend>
                    <p className="text-muted-foreground">
                      Choose which blockers reset should discard for these exact {resetCount} contents. This creates a new
                      preview for review. Complete file verification and stopped provider effects are required. Files referenced by content outside this plan remain protected.
                    </p>
                    {availableProtectionOptions.map((option) => (
                      <label key={option.code} className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={resetOverrideCodes.includes(option.code)}
                          onChange={(event) => setResetOverrideCodes((codes) => event.target.checked
                            ? [...codes, option.code]
                            : codes.filter((code) => code !== option.code))}
                        />
                        <span>
                          <span className="block font-medium">{option.label} · {formatCount(protectionCounts.get(option.code))} items</span>
                          <span className="text-muted-foreground">{option.consequence}</span>
                        </span>
                      </label>
                    ))}
                    <label className="block space-y-1">
                      <span>Reason for fresh-start overrides</span>
                      <Input
                        aria-label="Reason for fresh-start overrides"
                        value={resetOverrideReason}
                        onChange={(event) => setResetOverrideReason(event.target.value)}
                        maxLength={500}
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={resetPreviewPending || resetRequestedIDs.length !== resetCount ||
                        (resetOverrideCodes.length === 0 && savedOverrideCodes === '[]') ||
                        (resetOverrideCodes.length > 0 && !resetOverrideReason.trim())}
                      onClick={() => createProtectionPreview.mutate({
                        contentIds: resetRequestedIDs,
                        selectionReason: String(activeResetRun.manifest.selection_reason ?? ''),
                        codes: resetOverrideCodes,
                        reason: resetOverrideReason.trim(),
                      }, { onSuccess: (preview) => {
                        setResetPreview(preview);
                        setResetRunID(preview.run.id);
                        setResetPhraseInput('');
                      } })}
                    >
                      {createProtectionPreview.isPending ? 'Preparing new preview…' : 'Preview with override choices'}
                    </Button>
                    {createProtectionPreview.isError && <p role="alert" className="text-destructive">{createProtectionPreview.error.message}</p>}
                    {overriddenItemCount > 0 && blockedCount > 0 && (
                      <p className="text-muted-foreground">Use this button after choosing blockers to discard, or resolving the remaining checks. It refreshes the same {resetCount} contents with your choices.</p>
                    )}
                  </fieldset>
                )}
                {!resetTargets.length && (
                  <p role="alert" className="text-sm text-destructive">
                    The complete target list is unavailable. Create a new preview before approving.
                  </p>
                )}
                <ul className="max-h-72 divide-y overflow-auto rounded-md border">
                  {resetTargets.map((target) => (
                    <li key={target.content_item_id} className="space-y-2 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p dir="auto" className="font-medium">
                            {selectionTitles[target.content_item_id] || 'Content ' + target.content_item_id.slice(0, 8)}
                          </p>
                          <code className="break-all text-xs text-muted-foreground">{target.content_item_id}</code>
                        </div>
                        <Badge variant={target.blockers?.length ? 'destructive' : 'secondary'}>
                          {resetItemStates.has(target.content_item_id) && activeResetRun.state !== 'preview'
                            ? resetItemLabels[resetItemStates.get(target.content_item_id)!] ?? 'In progress'
                            : target.blockers?.length ? 'Blocked' : target.overridden_blockers?.length ? 'Eligible with override' : 'Eligible'}
                        </Badge>
                      </div>
                      {target.blockers?.map((blocker) => (
                        <p key={blocker.code} className="text-destructive">
                          {blocker.message}
                        </p>
                      ))}
                      {target.overridden_blockers?.map((blocker) => (
                        <p key={blocker.code}>Blocker overridden: {blocker.message}</p>
                      ))}
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Deletion details and storage evidence</summary>
                        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(
                            {
                              type: target.snapshot?.type,
                              status: target.snapshot?.status,
                              metadata_counts: target.metadata_counts,
                              decisions: target.data_decisions,
                              storage_tiers: target.storage_tiers,
                              version_model: target.storage_version_model,
                              objects: target.objects,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
                {activeResetRun.state === 'preview' && (
                  <div className="space-y-3 border-t pt-4">
                    {!resetApprovalUnavailable && (
                      <label className="block space-y-2 text-sm">
                        <span>
                          Type this phrase to approve: <code className="break-all">{expectedResetPhrase}</code>
                        </span>
                        <Input
                          aria-label="Deletion approval phrase"
                          value={resetPhraseInput}
                          onChange={(event) => setResetPhraseInput(event.target.value)}
                          placeholder="Type the displayed approval phrase"
                        />
                        {resetPhraseInput && (
                          <span role="status" className="block text-muted-foreground">
                            {resetPhraseMatches
                              ? 'Confirmation phrase matches.'
                              : 'The confirmation phrase does not match yet.'}
                          </span>
                        )}
                      </label>
                    )}
                    <Button
                      aria-describedby={resetApprovalUnavailable ? 'pods-reset-approval-blocker' : undefined}
                      disabled={Boolean(resetApprovalUnavailable) || approveReset.isPending || !resetPhraseMatches}
                      onClick={() => approveReset.mutate({ id: activeResetRun.id, phrase: resetPhraseInput.trim() })}
                    >
                      {resetApprovalUnavailable ? 'Approval unavailable' : `Approve plan for ${resetCount} contents`}
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(['preview', 'approved'].includes(activeResetRun.state) || resetPlan.data?.can_cancel) && (
                    <Button
                      variant="outline"
                      disabled={cancelReset.isPending}
                      onClick={() => {
                        if (
                          window.confirm('Cancel this plan before deletion begins? A cancelled plan cannot be resumed.')
                        )
                          cancelReset.mutate(activeResetRun.id);
                      }}
                    >
                      Cancel plan
                    </Button>
                  )}
                  {['approved', 'executing', 'partial'].includes(activeResetRun.state) && (
                    <>
                      {activeResetRun.pause_requested ? (
                        <Button
                          variant="outline"
                          disabled={resumeReset.isPending || activeResetRun.state === 'executing'}
                          onClick={() => resumeReset.mutate(activeResetRun.id)}
                        >
                          Resume paused run
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={pauseReset.isPending}
                          onClick={() => pauseReset.mutate(activeResetRun.id)}
                        >
                          Pause after current item
                        </Button>
                      )}
                      <Button
                        disabled={executeReset.isPending || activeResetRun.pause_requested}
                        onClick={() => openExecutionConfirmation({ kind: 'pods', id: activeResetRun.id })}
                      >
                        {resetWorking ? 'Deletion continues automatically…' : (activeResetRun.state === 'partial' ? 'Continue deleting ' : 'Confirm deletion of ') + resetCount + ' contents'}
                      </Button>
                    </>
                  )}
                </div>
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">Technical evidence and limitations</summary>
                  <p className="mt-2 break-all">
                    Manifest {activeResetRun.manifest_hash} · schema {activeResetRun.schema_fingerprint} · policy{' '}
                    {activeResetRun.policy_version}
                    {activeResetRun.state === 'preview' && <> · preview expires {new Date(activeResetRun.expires_at).toLocaleString()}</>}
                  </p>
                  <p className="mt-2">
                    Deletion retains a minimal retired identity and required audit history. Removed source identities
                    cannot be automatically rebuilt. Cached or downloaded copies are outside this storage check. Each
                    preparation and deletion batch processes up to 3 items; one count confirmation continues the requests automatically for
                    the same approved manifest. Closing this page stops continuation after the current request.
                  </p>
                  {resetProgressItems.map((item) => (
                    <div key={item.content_item_id} className="mt-2 rounded border p-2 text-xs">
                      <p>
                        {item.content_item_id} · {item.state} · origin absence checks{' '}
                        {item.verification_probe_count ?? 0}/2
                      </p>
                      {item.verification_not_before && (
                        <p>Next check after {new Date(item.verification_not_before).toLocaleString()}</p>
                      )}
                      {item.last_error && <p className="text-destructive">{item.last_error}</p>}
                      {item.blocked_reasons?.map((blocker) => (
                        <p key={blocker.code}>{blocker.message}</p>
                      ))}
                    </div>
                  ))}
                  {resetPlan.data?.actions?.map((action) => (
                    <details key={action.id} className="mt-2 rounded border p-2 text-xs">
                      <summary className="cursor-pointer">
                        {action.content_item_id} · committed deletion evidence
                      </summary>
                      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(action.result, null, 2)}
                      </pre>
                    </details>
                  ))}
                </details>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="repair" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Repair feeds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Repair refreshes derived feed data. Rotate prepares a replacement feed generation. Both preserve content
                and sources: <strong>0 contents deleted</strong>.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Feed</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={lane}
                    onChange={(event) => setLane(event.target.value as FeedRecoveryLane)}
                  >
                    <option value="news">News</option>
                    <option value="media">Pods</option>
                    <option value="both" disabled={level === 'rotate'}>
                      Both feeds
                    </option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>Action</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={level}
                    onChange={(event) => {
                      const value = event.target.value as FeedRecoveryLevel;
                      setLevel(value);
                      if (value === 'rotate' && lane === 'both') setLane('news');
                    }}
                  >
                    <option value="repair">Repair</option>
                    <option value="rotate">Rotate</option>
                  </select>
                </label>
              </div>
              <Button
                disabled={create.isPending}
                onClick={() =>
                  create.mutate(
                    { lane, level, capacity_mode: 'safe_cutover' },
                    {
                      onSuccess: (value) => {
                        setPlanID(value.id);
                        setPhrase('');
                      },
                    }
                  )
                }
              >
                {create.isPending ? 'Preparing plan…' : 'Prepare recovery plan'}
              </Button>
              {create.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {create.error.message}
                </p>
              )}
            </CardContent>
          </Card>
          {current && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Review recovery plan <Badge>{current.state}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  {current.source_count} sources · {current.target_count} contents to delete
                </p>
                <label className="block space-y-2">
                  <span>
                    Type this phrase to approve: <code className="break-all">{expectedRecoveryPhrase}</code>
                  </span>
                  <Input
                    aria-label="Recovery approval phrase"
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    placeholder="Type the displayed approval phrase"
                  />
                </label>
                <Button
                  disabled={
                    approve.isPending || phrase !== expectedRecoveryPhrase || current.state !== 'awaiting_approval'
                  }
                  onClick={() => approve.mutate({ plan: current, phrase }, { onSuccess: () => setView('history') })}
                >
                  Approve recovery plan
                </Button>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Plan evidence</summary>
                  <p className="mt-2 break-all">
                    Manifest {current.manifest_hash} · source proof {current.source_checksum}
                  </p>
                </details>
              </CardContent>
            </Card>
          )}
          {plan.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not load the recovery plan. {plan.error.message}
            </p>
          )}
          <Button variant="outline" onClick={() => setView('history')}>
            View recovery runs
          </Button>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pods deletion runs</CardTitle>
            </CardHeader>
            <CardContent>
              {resetRuns.isError ? (
                <p role="alert" className="text-destructive">
                  Could not load deletion history.
                </p>
              ) : resetRuns.isPending ? (
                <p>Loading deletion history…</p>
              ) : resetRuns.data?.length ? (
                <ul className="divide-y">
                  {resetRuns.data.map((run) => (
                    <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <div className="font-medium">
                          {formatCount(manifestCount(run))} contents · <Badge>{run.state}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(run.created_at)} · {run.created_by}
                        </p>
                        {run.error && <p className="text-destructive">{run.error}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => inspectReset(run.id)}>
                          Inspect deletion plan
                        </Button>
                        {['approved', 'executing', 'partial'].includes(run.state) && (
                          <Button
                            size="sm"
                            disabled={executeReset.isPending || run.pause_requested}
                            onClick={() => openExecutionConfirmation({ kind: 'pods', id: run.id })}
                          >
                            Resume same manifest
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Pods deletion runs yet. Select contents to prepare your first preview.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feed recovery runs</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.isError ? (
                <p role="alert" className="text-destructive">
                  Could not load feed recovery history.
                </p>
              ) : runs.isPending ? (
                <p>Loading recovery history…</p>
              ) : runs.data?.length ? (
                <ul className="divide-y">
                  {runs.data.map((run) => (
                    <li key={run.id} className="space-y-2 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {run.lane === 'media' ? 'Pods' : run.lane}{' '}
                            <Badge variant="outline">{run.phase.replaceAll('_', ' ')}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{dateLabel(run.created_at)}</p>
                          {run.error && <p className="text-destructive">{run.error}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedRunID(run.id)}>
                            Inspect evidence
                          </Button>
                          {contextFor('feed_recovery_run', run.id, 'Recovery run') && (
                            <OperatorLaunchLink
                              context={contextFor('feed_recovery_run', run.id, 'Recovery run')!}
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
                              disabled={execute.isPending || !run.plan_id}
                              onClick={() => {
                                if (run.plan_id)
                                  openExecutionConfirmation({ kind: 'feed', id: run.id, planID: run.plan_id });
                              }}
                            >
                              Continue
                            </Button>
                          )}
                          {run.phase === 'cancel_window' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(run.id)}
                            >
                              Cancel run
                            </Button>
                          )}
                          {run.outcome === 'succeeded' &&
                            run.rollback_deadline &&
                            new Date(run.rollback_deadline) > new Date() && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={rollback.isPending}
                                onClick={() => rollback.mutate(run.id)}
                              >
                                Rollback
                              </Button>
                            )}
                        </div>
                      </div>
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Timing and run evidence</summary>
                        <p className="mt-2 break-all">
                          Correlation {run.correlation_id} · lease {run.lane_lease || 'Not acquired'}
                        </p>
                        {run.verification_due_at && (
                          <p>Verification after {new Date(run.verification_due_at).toLocaleString()}</p>
                        )}
                        {run.rollback_deadline && (
                          <p>Rollback deadline {new Date(run.rollback_deadline).toLocaleString()}</p>
                        )}
                        {run.expected_empty && <p>Expected empty</p>}
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No feed recovery runs yet. Prepare a plan under Repair feeds.
                </p>
              )}
            </CardContent>
          </Card>
          {selectedRunID && (
            <Card>
              <CardHeader>
                <CardTitle>Recovery evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {actions.isError ? (
                  <p role="alert" className="text-destructive">
                    Could not load run evidence.
                  </p>
                ) : actions.data?.length ? (
                  actions.data.map((action) => (
                    <details key={action.id} className="rounded border p-3 text-sm">
                      <summary className="cursor-pointer">
                        {action.action_type} · {action.state}
                      </summary>
                      {action.error && <p className="text-destructive">{action.error}</p>}
                      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(action.evidence ?? {}, null, 2)}
                      </pre>
                    </details>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {actions.isPending ? 'Loading evidence…' : 'No action evidence recorded.'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(executionTarget)}
        onOpenChange={(open) => {
          if (!open) setExecutionTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final execution confirmation</DialogTitle>
            <DialogDescription>
              {executionCount === undefined
                ? 'Loading the approved manifest…'
                : executionTarget?.kind === 'feed'
                  ? 'Items to delete: ' + executionCount + '. Repair and Rotate preserve canonical content.'
                  : 'Delete the payload for ' +
                    executionCount +
                    ' contents in this approved plan. Deletion cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          {executionCount !== undefined && (
            <p className="text-3xl font-semibold tabular-nums">
              {executionCount}
              <span className="ml-2 text-sm font-normal text-muted-foreground">contents to delete</span>
            </p>
          )}
          {(executionFeedPlan.isError || (executionPodsPlan.isError && !executionManifest)) && (
            <p role="alert" className="text-sm text-destructive">
              The approved manifest could not be loaded. Close this confirmation and try again.
            </p>
          )}
          <label className="space-y-2 text-sm" htmlFor="execution-item-count">
            <span>Type the number of items to delete</span>
            <Input
              id="execution-item-count"
              inputMode="numeric"
              autoComplete="off"
              placeholder={executionCount === undefined ? '' : 'Type ' + executionCount + ' to confirm'}
              value={executeCount}
              disabled={!executionPlanReady || executionPending}
              onChange={(event) => setExecuteCount(event.target.value)}
            />
          </label>
          {executionManifest && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Plan reference</summary>
              <p className="mt-2 break-all">Manifest {executionManifest}</p>
            </details>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecutionTarget(undefined)}>
              Cancel
            </Button>
            <Button
              variant={executionTarget?.kind === 'pods' ? 'destructive' : 'default'}
              disabled={
                !executionPlanReady || !executionManifest || executeCount !== String(executionCount) || executionPending
              }
              onClick={() => {
                if (
                  !executionTarget ||
                  !executionManifest ||
                  executionCount === undefined ||
                  executeCount !== String(executionCount)
                )
                  return;
                const input = { id: executionTarget.id, manifestHash: executionManifest, confirmedItemCount: executionCount };
                if (executionTarget.kind === 'pods') {
                  executeReset.mutate(input);
                  inspectReset(executionTarget.id);
                  setExecutionTarget(undefined);
                  setExecuteCount('');
                } else {
                  execute.mutate(input, {
                    onSuccess: () => {
                      setExecutionTarget(undefined);
                      setExecuteCount('');
                    },
                  });
                }
              }}
            >
              {executionPending
                ? 'Executing…'
                : executionTarget?.kind === 'pods'
                  ? 'Confirm deletion'
                  : 'Confirm execution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
