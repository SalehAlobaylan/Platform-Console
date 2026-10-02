'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Ban,
  CircleAlert,
  LoaderCircle,
  RotateCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  advanceContentResetPlanning,
  cancelContentResetCampaign,
  createContentResetCampaign,
  getContentResetCampaign,
  getContentResetCapabilities,
  listContentResetCampaigns,
  listContentResetEvidence,
  listContentResetTargets,
  validateContentResetCampaign,
  type ContentResetLane,
  type ContentResetOperation,
  type ContentResetPlanRequest,
  type ContentResetScopeKind,
} from '@/lib/api/cms/content-reset';
import FeedRecoveryPanel from './_components/feed-recovery-panel';
import ContentResetExecutionPanel from './_components/content-reset-execution-panel';
import ContentResetStagedPreview from './_components/content-reset-staged-preview';

const contentStatuses = [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'ARCHIVED',
] as const;
const parseIDs = (value: string) =>
  value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

function errorMessage(error: unknown) {
  const responseError = (
    error as { response?: { data?: { error?: string } } } | undefined
  )?.response?.data?.error;
  const apiMessage = (error as { message?: string } | undefined)?.message;
  return (
    responseError ||
    apiMessage ||
    (error instanceof Error ? error.message : 'Request failed')
  );
}

export default function RecoveryPage() {
  const queryClient = useQueryClient();
  const [workspace, setWorkspace] = useState<'reset' | 'feed-recovery'>(
    'reset'
  );
  const [operation, setOperation] =
    useState<ContentResetOperation>('fresh_start');
  const [lane, setLane] = useState<ContentResetLane>('pods');
  const [scopeKind, setScopeKind] = useState<ContentResetScopeKind>('all_lane');
  const [scopeSourceIDs, setScopeSourceIDs] = useState('');
  const [contentIDs, setContentIDs] = useState('');
  const [processingGeneration, setProcessingGeneration] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statuses, setStatuses] = useState<
    Array<(typeof contentStatuses)[number]>
  >([]);
  const [coveragePolicy, setCoveragePolicy] = useState<
    'preserve_protected' | 'require_exact'
  >('preserve_protected');
  const [interactionPolicy, setInteractionPolicy] = useState<
    'protect' | 'preserve_history'
  >('protect');
  const [replayMode, setReplayMode] = useState<
    'bounded_recent' | 'from_now' | 'available_history' | 'exact_rebuild'
  >('bounded_recent');
  const [windowDays, setWindowDays] = useState('14');
  const [replaySourceScope, setReplaySourceScope] = useState<
    'all_active_lane_sources' | 'explicit_sources'
  >('all_active_lane_sources');
  const [replaySourceIDs, setReplaySourceIDs] = useState('');
  const [processingStrategy, setProcessingStrategy] = useState<
    'copy_verified' | 'recompute'
  >('copy_verified');
  const [capacityStrategy, setCapacityStrategy] = useState<
    'build_first' | 'clear_first'
  >('build_first');
  const [
    newsAvailabilityExceptionRequested,
    setNewsAvailabilityExceptionRequested,
  ] = useState(false);
  const [
    newsAvailabilityExceptionReason,
    setNewsAvailabilityExceptionReason,
  ] = useState('');
  const [selectedCampaignID, setSelectedCampaignID] = useState('');
  const [targetCursor, setTargetCursor] = useState(0);
  const [targetCursorHistory, setTargetCursorHistory] = useState<number[]>([]);
  const [evidenceCursor, setEvidenceCursor] = useState(0);
  const [evidenceCursorHistory, setEvidenceCursorHistory] =
    useState<number[]>([]);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'feed-recovery') {
      setWorkspace('feed-recovery');
    }
    const campaignID = params.get('campaign');
    if (campaignID) setSelectedCampaignID(campaignID);
  }, []);

  const selectWorkspace = (next: 'reset' | 'feed-recovery') => {
    setWorkspace(next);
    const url = new URL(window.location.href);
    if (next === 'feed-recovery') {
      url.searchParams.set('view', 'feed-recovery');
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const selectCampaign = (campaignID: string) => {
    setSelectedCampaignID(campaignID);
    setTargetCursor(0);
    setTargetCursorHistory([]);
    setEvidenceCursor(0);
    setEvidenceCursorHistory([]);
    const url = new URL(window.location.href);
    url.searchParams.set('campaign', campaignID);
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const capabilities = useQuery({
    queryKey: ['content-reset', 'capabilities'],
    queryFn: getContentResetCapabilities,
    enabled: workspace === 'reset',
  });
  const campaigns = useQuery({
    queryKey: ['content-reset', 'campaigns'],
    queryFn: listContentResetCampaigns,
    refetchInterval: 10_000,
    enabled: workspace === 'reset',
  });
  const detail = useQuery({
    queryKey: ['content-reset', 'campaign', selectedCampaignID],
    queryFn: () => getContentResetCampaign(selectedCampaignID),
    enabled: workspace === 'reset' && Boolean(selectedCampaignID),
    refetchInterval: (query) =>
      query.state.data?.campaign.state === 'planning' ? 2_000 : false,
  });
  const targets = useQuery({
    queryKey: ['content-reset', 'targets', selectedCampaignID, targetCursor],
    queryFn: () =>
      listContentResetTargets(selectedCampaignID, targetCursor, 100),
    enabled: workspace === 'reset' && Boolean(selectedCampaignID),
  });
  const evidence = useQuery({
    queryKey: ['content-reset', 'evidence', selectedCampaignID, evidenceCursor],
    queryFn: () =>
      listContentResetEvidence(selectedCampaignID, evidenceCursor, 50),
    enabled: workspace === 'reset' && Boolean(selectedCampaignID),
    refetchInterval: () =>
      detail.data?.campaign.state === 'planning' ? 2_000 : false,
  });
  const validation = useQuery({
    queryKey: ['content-reset', 'validation', selectedCampaignID],
    queryFn: () => validateContentResetCampaign(selectedCampaignID),
    enabled: false,
    retry: false,
  });

  const refreshCampaigns = () => {
    void queryClient.invalidateQueries({ queryKey: ['content-reset'] });
  };
  const createCampaign = useMutation({
    mutationFn: ({
      request,
      key,
    }: {
      request: ContentResetPlanRequest;
      key: string;
    }) => createContentResetCampaign(request, key),
    onSuccess: (result) => {
      setRequestError('');
      selectCampaign(result.campaign.id);
      refreshCampaigns();
    },
    onError: (error) => setRequestError(errorMessage(error)),
  });
  const advancePlanning = useMutation({
    mutationFn: () =>
      advanceContentResetPlanning(
        selectedCampaignID,
        detail.data?.revision.scan_cursor ?? 0
      ),
    onSuccess: () => {
      setRequestError('');
      refreshCampaigns();
    },
    onError: (error) => setRequestError(errorMessage(error)),
  });
  const cancelCampaign = useMutation({
    mutationFn: () => cancelContentResetCampaign(selectedCampaignID),
    onSuccess: () => {
      setRequestError('');
      refreshCampaigns();
    },
    onError: (error) => setRequestError(errorMessage(error)),
  });

  const buildRequest = (): ContentResetPlanRequest => {
    const scope: ContentResetPlanRequest['scope'] = {
      kind: scopeKind,
      ...(statuses.length
        ? { statuses: [...statuses] }
        : {}),
    };
    if (scopeKind === 'source_ids') scope.source_ids = parseIDs(scopeSourceIDs);
    if (scopeKind === 'explicit_ids')
      scope.content_item_ids = parseIDs(contentIDs);
    if (scopeKind === 'published_between' || scopeKind === 'created_between') {
      scope.from = new Date(from).toISOString();
      scope.to = new Date(to).toISOString();
    }
    if (processingGeneration.trim()) {
      const generation = Number(processingGeneration);
      if (!Number.isSafeInteger(generation) || generation < 1) {
        throw new Error('Processing generation must be a positive whole number.');
      }
      scope.processing_generation = generation;
    }
    const replay: ContentResetPlanRequest['replay'] =
      operation === 'fresh_start'
        ? {
            mode: replayMode,
            ...(replayMode === 'bounded_recent'
              ? { window_days: Number(windowDays) }
              : {}),
            source_scope: replaySourceScope,
            ...(replaySourceScope === 'explicit_sources'
              ? { source_ids: parseIDs(replaySourceIDs) }
              : {}),
          }
        : { mode: 'none' };
    return {
      operation,
      lane,
      scope,
      coverage_policy: coveragePolicy,
      interaction_policy: interactionPolicy,
      intake_after: operation === 'empty' ? 'paused' : 'continue',
      replay,
      processing_strategy:
        operation === 'fresh_start' ? processingStrategy : 'none',
      capacity_strategy:
        operation === 'fresh_start' ? capacityStrategy : 'none',
      ...(newsAvailabilityExceptionRequested
        ? {
            news_availability_exception_requested: true,
            news_availability_exception_reason: newsAvailabilityExceptionReason,
          }
        : {}),
    };
  };

  const submitPlan = () => {
    try {
      setRequestError('');
      const request = buildRequest();
      createCampaign.mutate({
        request,
        key: `content-reset-${crypto.randomUUID()}`,
      });
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Review the selected date range.'
      );
    }
  };

  const selected = detail.data;
  const isPlanning = selected?.campaign.state === 'planning';
  const targetPage = targets.data;

  if (workspace === 'feed-recovery') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-8 md:pt-8">
          <Button variant="outline" onClick={() => selectWorkspace('reset')}>
            Fresh Start &amp; Clear
          </Button>
          <Button onClick={() => selectWorkspace('feed-recovery')}>
            Feed Repair &amp; Pods Reset
          </Button>
        </div>
        <FeedRecoveryPanel />
      </div>
    );
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => selectWorkspace('reset')}>
          Fresh Start &amp; Clear
        </Button>
        <Button variant="outline" onClick={() => selectWorkspace('feed-recovery')}>
          Feed Repair &amp; Pods Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              Recovery &amp; Content Reset
            </h1>
            <Badge variant="outline">Preview only</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Prepare a durable, exact-scope preview for clearing content,
            starting from selected sources, or emptying a selected lane or
            complete source scope. This page cannot approve or execute a reset.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/platform/retention">
              Retention <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Destructive execution is locked</p>
            <p className="mt-1 text-muted-foreground">
              Current previews are blocked until dependency owners, cross-system
              claims, replacement identity, feed isolation, source replay, and
              mode-specific qualification are complete. Creating a preview does
              not pause ingestion or change serving.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Prepare a Content Reset preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Operation">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={operation}
                  onChange={(event) => {
                    const nextOperation = event.target
                      .value as ContentResetOperation;
                    setOperation(nextOperation);
                    if (nextOperation === 'empty') {
                      setCoveragePolicy('require_exact');
                      setStatuses([]);
                      setProcessingGeneration('');
                      if (
                        scopeKind === 'explicit_ids' ||
                        scopeKind === 'published_between' ||
                        scopeKind === 'created_between'
                      ) {
                        setScopeKind('all_lane');
                      }
                    }
                  }}
                >
                  <option value="fresh_start">Fresh start from sources</option>
                  <option value="clear">Clear selected content</option>
                  <option value="empty">
                    Empty selected lane/source and keep paused
                  </option>
                </select>
              </Field>
              <Field label="Lane">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={lane}
                  onChange={(event) => {
                    const nextLane = event.target.value as ContentResetLane;
                    setLane(nextLane);
                    if (nextLane === 'pods') {
                      setNewsAvailabilityExceptionRequested(false);
                      setNewsAvailabilityExceptionReason('');
                    }
                  }}
                >
                  <option value="news">News</option>
                  <option value="pods">Pods</option>
                  <option value="both">News and Pods</option>
                </select>
              </Field>
              <Field label="Content selection">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={scopeKind}
                  onChange={(event) =>
                    setScopeKind(event.target.value as ContentResetScopeKind)
                  }
                >
                  <option value="all_lane">Entire selected lane</option>
                  <option value="source_ids">Selected sources</option>
                  {operation !== 'empty' && (
                    <>
                      <option value="explicit_ids">Exact content IDs</option>
                      <option value="published_between">
                        Publication date range
                      </option>
                      <option value="created_between">
                        Ingestion date range
                      </option>
                    </>
                  )}
                </select>
              </Field>
              <Field label="Protected content">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={coveragePolicy}
                  onChange={(event) =>
                    setCoveragePolicy(
                      event.target.value as typeof coveragePolicy
                    )
                  }
                >
                  {operation !== 'empty' && (
                    <option value="preserve_protected">
                      Preserve and list protected items
                    </option>
                  )}
                  <option value="require_exact">
                    Block unless the exact scope is clear
                  </option>
                </select>
              </Field>
              {(lane === 'news' || lane === 'both') && (
                <div className="space-y-3 rounded-md border p-3 sm:col-span-2">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={newsAvailabilityExceptionRequested}
                      onChange={(event) => {
                        setNewsAvailabilityExceptionRequested(
                          event.target.checked
                        );
                        if (!event.target.checked) {
                          setNewsAvailabilityExceptionReason('');
                        }
                      }}
                    />
                    <span>
                      Request a News availability exception
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Records intent only. This preview cannot waive Retention
                        or archive protections.
                      </span>
                    </span>
                  </label>
                  {newsAvailabilityExceptionRequested && (
                    <Field label="Reason for the News availability exception">
                      <Textarea
                        value={newsAvailabilityExceptionReason}
                        onChange={(event) =>
                          setNewsAvailabilityExceptionReason(event.target.value)
                        }
                        placeholder="Explain the News availability impact and why this exception is requested."
                        rows={3}
                      />
                    </Field>
                  )}
                </div>
              )}
              {scopeKind === 'source_ids' && (
                <Field label="Source IDs" className="sm:col-span-2">
                  <Textarea
                    value={scopeSourceIDs}
                    onChange={(event) => setScopeSourceIDs(event.target.value)}
                    placeholder="One source UUID per line"
                    rows={3}
                  />
                </Field>
              )}
              {scopeKind === 'explicit_ids' && (
                <Field label="Content item IDs" className="sm:col-span-2">
                  <Textarea
                    value={contentIDs}
                    onChange={(event) => setContentIDs(event.target.value)}
                    placeholder="One content UUID per line"
                    rows={4}
                  />
                </Field>
              )}
              {(scopeKind === 'published_between' ||
                scopeKind === 'created_between') && (
                <>
                  <Field label="From">
                    <Input
                      type="datetime-local"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </Field>
                  <Field label="Until (exclusive)">
                    <Input
                      type="datetime-local"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </Field>
                </>
              )}
              {operation !== 'empty' && (
                <Field label="Processing generation (optional)">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={processingGeneration}
                    onChange={(event) =>
                      setProcessingGeneration(event.target.value)
                    }
                    placeholder="Any generation"
                  />
                </Field>
              )}
            </div>

            {operation === 'empty' ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Empty includes every status in the selected lane or complete
                source scope. Protected items block the empty result.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Statuses included</Label>
                <p className="text-xs text-muted-foreground">
                  Leave all unchecked to include every status.
                </p>
                <div className="flex flex-wrap gap-2">
                  {contentStatuses.map((status) => {
                    const checked = statuses.includes(status);
                    return (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        aria-pressed={checked}
                        variant={checked ? 'secondary' : 'outline'}
                        onClick={() =>
                          setStatuses((current) =>
                            checked
                              ? current.filter((item) => item !== status)
                              : [...current, status]
                          )
                        }
                      >
                        {status}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Interaction history">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={interactionPolicy}
                  onChange={(event) =>
                    setInteractionPolicy(
                      event.target.value as typeof interactionPolicy
                    )
                  }
                >
                  <option value="protect">
                    Keep interacted content protected
                  </option>
                  <option value="preserve_history">
                    Preserve history on retired content
                  </option>
                </select>
              </Field>
            </div>

            {operation === 'fresh_start' && (
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="font-medium">Replacement content</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source replay is recorded in the preview; providers are not
                    called.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Replay window">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={replayMode}
                      onChange={(event) =>
                        setReplayMode(event.target.value as typeof replayMode)
                      }
                    >
                      <option value="bounded_recent">
                        Bounded recent history
                      </option>
                      <option value="from_now">New items from now</option>
                      <option value="available_history">
                        Provider available history
                      </option>
                      <option value="exact_rebuild">
                        Rebuild these exact items
                      </option>
                    </select>
                  </Field>
                  {replayMode === 'bounded_recent' && (
                    <Field label="History window (days)">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={windowDays}
                        onChange={(event) => setWindowDays(event.target.value)}
                      />
                    </Field>
                  )}
                  <Field label="Replay sources">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={replaySourceScope}
                      onChange={(event) =>
                        setReplaySourceScope(
                          event.target.value as typeof replaySourceScope
                        )
                      }
                    >
                      <option value="all_active_lane_sources">
                        All active sources in the lane
                      </option>
                      <option value="explicit_sources">
                        Choose exact source IDs
                      </option>
                    </select>
                  </Field>
                  {replaySourceScope === 'explicit_sources' && (
                    <Field label="Replay source IDs">
                      <Textarea
                        value={replaySourceIDs}
                        onChange={(event) =>
                          setReplaySourceIDs(event.target.value)
                        }
                        placeholder="One source UUID per line"
                        rows={3}
                      />
                    </Field>
                  )}
                  <Field label="Derived data">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={processingStrategy}
                      onChange={(event) =>
                        setProcessingStrategy(
                          event.target.value as typeof processingStrategy
                        )
                      }
                    >
                      <option value="copy_verified">
                        Copy verified compatible inputs
                      </option>
                      <option value="recompute">Recompute derived data</option>
                    </select>
                  </Field>
                  <Field label="Capacity strategy">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={capacityStrategy}
                      onChange={(event) =>
                        setCapacityStrategy(
                          event.target.value as typeof capacityStrategy
                        )
                      }
                    >
                      <option value="build_first">
                        Build replacements first
                      </option>
                      <option value="clear_first">
                        Clear first to reduce peak storage
                      </option>
                    </select>
                  </Field>
                </div>
              </div>
            )}

            {requestError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {requestError}
              </div>
            )}
            <Button onClick={submitPlan} disabled={createCampaign.isPending}>
              {createCampaign.isPending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create preview
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Recent campaigns</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshCampaigns()}
              aria-label="Refresh campaigns"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaigns.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading campaigns…
              </p>
            )}
            {campaigns.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No Content Reset previews yet.
              </p>
            )}
            {campaigns.data?.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                aria-pressed={selectedCampaignID === campaign.id}
                onClick={() => selectCampaign(campaign.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/60 ${selectedCampaignID === campaign.id ? 'border-primary bg-muted/40' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {campaign.operation.replace('_', ' ')} · {campaign.lane}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(campaign.created_at).toLocaleString()}
                  </span>
                </span>
                <Badge
                  variant={
                    campaign.state === 'blocked' ? 'destructive' : 'secondary'
                  }
                >
                  {campaign.state}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Campaign preview</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.campaign.id} · manifest{' '}
                {selected.revision.manifest_hash?.slice(0, 16) ?? 'planning'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  selected.campaign.state === 'blocked'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {selected.campaign.state}
              </Badge>
              {(isPlanning || selected.campaign.state === 'blocked') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelCampaign.mutate()}
                  disabled={cancelCampaign.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" /> Cancel preview
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ContentResetExecutionPanel key={selected.campaign.id} detail={selected} />
            {selected.campaign.operation === 'fresh_start' && ['executing', 'published', 'cleanup_pending', 'partial'].includes(selected.campaign.state) ? (
              <ContentResetStagedPreview key={`staged-${selected.campaign.id}`} detail={selected} />
            ) : null}
            <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Intent</p>
                <p className="mt-1 font-medium">
                  {selected.campaign.operation.replace('_', ' ')} ·{' '}
                  {selected.campaign.lane}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selection</p>
                <p className="mt-1 font-medium">
                  {selected.revision.request.scope.kind.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Protection</p>
                <p className="mt-1 font-medium">
                  {selected.revision.request.coverage_policy.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Interaction policy
                </p>
                <p className="mt-1 font-medium">
                  {selected.revision.request.interaction_policy.replace(
                    '_',
                    ' '
                  )}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Summary
                label="Selected items"
                value={selected.revision.target_count}
              />
              <Summary
                label="Protected"
                value={selected.revision.protected_count}
              />
              <Summary
                label="Unknown dates"
                value={selected.revision.unknown_date_count}
              />
              <Summary
                label="Unattributed source items"
                value={selected.revision.unattributed_count}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Frozen inventory boundary: sequence ≤{' '}
              {selected.revision.inventory_highwater} · item ID ≤{' '}
              {selected.revision.selection_highwater}
            </p>
            <section className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">Validate this preview</h3>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    Rechecks the frozen manifest, target snapshots, protection,
                    inventory boundary, and replay source versions. This does
                    not approve or execute the campaign, and the result is not
                    stored as approval evidence.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void validation.refetch()}
                  disabled={validation.isFetching || isPlanning}
                >
                  {validation.isFetching ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="mr-2 h-4 w-4" />
                  )}
                  Verify preview
                </Button>
              </div>
              {validation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(validation.error)}
                </p>
              )}
              {validation.data && (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        validation.data.manifest_integrity_valid
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      Manifest{' '}
                      {validation.data.manifest_integrity_valid
                        ? 'intact'
                        : 'invalid'}
                    </Badge>
                    <Badge
                      variant={
                        validation.data.preview_current
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      Preview{' '}
                      {validation.data.preview_current
                        ? 'current'
                        : 'stale'}
                    </Badge>
                    <Badge
                      variant={
                        validation.data.approval_eligible
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {validation.data.approval_eligible
                        ? 'Approval eligible'
                        : 'Approval unavailable'}
                    </Badge>
                    <Badge
                      variant={
                        validation.data.execution_enabled
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {validation.data.execution_enabled
                        ? 'Execution enabled'
                        : 'Execution locked'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Checked {new Date(validation.data.checked_at).toLocaleString()} · verified{' '}
                    {validation.data.verified_target_count.toLocaleString()} of{' '}
                    {validation.data.target_count.toLocaleString()} targets
                  </p>
                  {validation.data.issues.length > 0 && (
                    <ul className="space-y-2">
                      {validation.data.issues.map((issue) => (
                        <li
                          key={issue.code}
                          className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{issue.owner}</Badge>
                            <span className="font-mono">{issue.code}</span>
                            {issue.count > 1 && <span>({issue.count})</span>}
                          </div>
                          <p className="mt-2 text-sm">{issue.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!validation.data.approval_eligible && (
                    <p className="text-xs text-muted-foreground">
                      Approval and execution are unavailable in this release
                      even when the frozen preview validates successfully.
                    </p>
                  )}
                </div>
              )}
            </section>
            {selected.revision.request.news_availability_exception_requested && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="font-medium">News availability exception requested</p>
                <p className="mt-1 text-muted-foreground">
                  {selected.revision.request.news_availability_exception_reason}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is frozen request intent only. It does not authorize
                  removal of protected News or archive dependencies.
                </p>
              </div>
            )}
            {isPlanning && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <p className="text-sm text-muted-foreground">
                  Inventory is being materialized in bounded pages. Cursor:{' '}
                  {selected.revision.scan_cursor} /{' '}
                  {selected.revision.selection_highwater}
                </p>
                <Button
                  size="sm"
                  onClick={() => advancePlanning.mutate()}
                  disabled={advancePlanning.isPending}
                >
                  Continue inventory
                </Button>
              </div>
            )}
            {selected.campaign.operation === 'fresh_start' && (
              <section className="space-y-2">
                <h3 className="font-medium">Frozen replay sources</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.revision.request.replay.mode.replace('_', ' ')} ·{' '}
                  {selected.revision.request.replay.window_days
                    ? `${selected.revision.request.replay.window_days} days · `
                    : ''}
                  {selected.revision.replay_source_snapshot.length} source
                  configurations
                </p>
                {selected.revision.replay_source_snapshot.length ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="p-3">Source ID</th>
                          <th className="p-3">Lane</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Config version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.revision.replay_source_snapshot.map(
                          (source) => (
                            <tr key={source.id} className="border-t">
                              <td className="p-3 font-mono text-xs">
                                {source.id}
                              </td>
                              <td className="p-3">{source.category}</td>
                              <td className="p-3">{source.type}</td>
                              <td className="p-3">{source.config_version}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            )}
            {selected.revision.blockers?.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-medium">Why execution is blocked</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {selected.revision.blockers.map((blocker) => (
                    <div
                      key={blocker.code}
                      className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{blocker.owner}</Badge>
                        <span className="font-mono text-xs">
                          {blocker.code}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{blocker.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Next: {blocker.next_action}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium">Preview audit trail</h3>
                  <p className="text-xs text-muted-foreground">
                    Append-only planning evidence with a verified payload hash.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={evidenceCursorHistory.length === 0}
                    onClick={() => {
                      const previousCursor =
                        evidenceCursorHistory[evidenceCursorHistory.length - 1] ?? 0;
                      setEvidenceCursor(previousCursor);
                      setEvidenceCursorHistory((history) => history.slice(0, -1));
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !evidence.data?.has_more
                    }
                    onClick={() => {
                      setEvidenceCursorHistory((history) => [
                        ...history,
                        evidenceCursor,
                      ]);
                      setEvidenceCursor(evidence.data?.next_cursor ?? evidenceCursor);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
              {evidence.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading preview evidence…
                </p>
              ) : evidence.data?.data.length ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Observed</th>
                        <th className="p-3">Event</th>
                        <th className="p-3">Owner</th>
                        <th className="p-3">Payload hash</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.data.data.map((entry) => (
                        <tr key={entry.id} className="border-t align-top">
                          <td className="whitespace-nowrap p-3 text-xs">
                            {new Date(entry.observed_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {entry.evidence_type}
                          </td>
                          <td className="p-3 text-xs">{entry.owner}</td>
                          <td
                            className="p-3 font-mono text-xs"
                            title={entry.payload_hash}
                          >
                            {entry.payload_hash.slice(0, 16)}…
                          </td>
                          <td className="p-3">
                            <details>
                              <summary className="cursor-pointer text-xs text-primary">
                                View recorded details
                              </summary>
                              <pre className="mt-2 max-h-64 max-w-2xl overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                                {JSON.stringify(entry.payload, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No planning evidence has been recorded yet.
                </p>
              )}
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Frozen content inventory</h3>
                <p className="text-xs text-muted-foreground">
                  Showing up to {targetPage?.limit ?? 100} items
                </p>
              </div>
              {targets.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading target page…
                </p>
              ) : targetPage?.data.length ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Content ID</th>
                        <th className="p-3">Lane</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Generation</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Replay identity</th>
                        <th className="p-3">Created</th>
                        <th className="p-3">Published</th>
                        <th className="p-3">Parent / story</th>
                        <th className="p-3">Preview decision</th>
                        <th className="p-3">Protection evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetPage.data.map((target) => (
                        <tr key={target.content_item_id} className="border-t">
                          <td className="p-3 font-mono text-xs">
                            {target.content_item_id}
                          </td>
                          <td className="p-3">{target.lane}</td>
                          <td className="p-3">{target.snapshot.status}</td>
                          <td className="p-3 font-mono text-xs">
                            {target.snapshot.processing_generation}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {target.snapshot.content_source_id ?? '—'}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                target.snapshot.source_identity_quality ===
                                  'provider_key_candidate' ||
                                target.snapshot.source_identity_quality ===
                                  'legacy_ingest_candidate'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                              title={target.snapshot.source_identity_hash}
                            >
                              {target.snapshot.source_identity_quality ===
                              'legacy_unresolved'
                                ? 'Unresolved'
                                : target.snapshot.source_identity_quality ===
                                    'provider_key_candidate' ||
                                  target.snapshot.source_identity_quality ===
                                    'legacy_ingest_candidate'
                                  ? 'Candidate only'
                                  : 'Not recorded'}
                            </Badge>
                            {target.snapshot.source_identity_hash && (
                              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                                {target.snapshot.source_identity_hash.slice(0, 12)}…
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {new Date(
                              target.snapshot.created_at
                            ).toLocaleString()}
                          </td>
                          <td className="p-3 text-xs">
                            {target.snapshot.published_at
                              ? new Date(
                                  target.snapshot.published_at
                                ).toLocaleString()
                              : 'Unknown'}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <span className="block">
                              {target.snapshot.parent_content_item_id ?? '—'}
                            </span>
                            {target.snapshot.story_id && (
                              <span className="mt-1 block text-muted-foreground">
                                Story {target.snapshot.story_id}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                target.disposition === 'blocked'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {target.disposition}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {target.protection_evidence?.join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No targets on this page.
                </p>
              )}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={targetCursorHistory.length === 0}
                  onClick={() => {
                    const previousCursor =
                      targetCursorHistory[targetCursorHistory.length - 1] ?? 0;
                    setTargetCursor(previousCursor);
                    setTargetCursorHistory((history) => history.slice(0, -1));
                  }}
                >
                  Previous page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !targetPage?.has_more
                  }
                  onClick={() => {
                    setTargetCursorHistory((history) => [
                      ...history,
                      targetCursor,
                    ]);
                    setTargetCursor(targetPage?.next_cursor ?? targetCursor);
                  }}
                >
                  Next page
                </Button>
              </div>
            </section>
          </CardContent>
        </Card>
      )}

      {capabilities.data && !capabilities.data.execution_enabled && (
        <p className="text-xs text-muted-foreground">
          Execution capability is locked for every operation and lane in this
          release.
        </p>
      )}
    </main>
  );
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="block space-y-2">
        <span className="block">{label}</span>
        {children}
      </Label>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
