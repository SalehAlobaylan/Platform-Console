'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  operatorKeys,
  useOperatorBriefing,
  useOperatorControls,
  useOperatorEligibleActions,
  useOperatorEvidence,
  useOperatorInvestigationEvents,
  useOperatorMutations,
  useOperatorPlan,
  useOperatorPlanEvents,
  useOperatorRecommendations,
  useOperatorStatus,
  useOperatorTasks,
  useOperatorThread,
  useOperatorThreads,
  type OperatorAction,
  type OperatorTask,
  type OperatorTaskGroup,
  type OperatorTaskKind,
} from '@/hooks/use-operator';
import { consumeOperatorLaunchContext } from '@/lib/operator/launch-context';
import { operatorRouteManifest } from '@/lib/operator/route-manifest';
import type { ApiError } from '@/lib/api/client';
import type {
  OperatorIntent,
  OperatorVisibleContext,
} from '@/types/platform/operator';
import {
  OperatorBriefingPanel,
  OperatorCapabilityNotices,
  OperatorCaseRail,
  OperatorComposer,
  OperatorInspector,
  OperatorStatusBand,
  OperatorTranscript,
  OperatorWorkspaceHeader,
  type InspectorTab,
  type OperatorBriefing,
  type OperatorMessage,
} from './operator-workspace-components';
import { operatorCopy, type OperatorLocale } from './operator-copy';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validInspectors = new Set<InspectorTab>([
  'evidence',
  'tasks',
  'plan',
  'governance',
]);
const validGroups = new Set<OperatorTaskGroup>([
  'active',
  'needs_approval',
  'failed',
  'completed',
]);
const validKinds = new Set<OperatorTaskKind>([
  'all',
  'investigation',
  'plan',
  'schedule',
  'schedule_run',
]);
const validIntents = new Set<OperatorIntent>([
  'explain',
  'investigate',
  'compare',
  'recommend',
  'resolve',
]);

function detectedLocale(message: string): OperatorLocale {
  return /[\u0600-\u06ff]/.test(message) ? 'ar' : 'en';
}
function titleFrom(message: string, fallback: string) {
  return message.trim().replace(/\s+/g, ' ').slice(0, 74) || fallback;
}
function validUUID(value: string | null) {
  return value && uuidPattern.test(value) ? value : undefined;
}

export function OperatorWorkspace() {
  const router = useRouter();
  const search = useSearchParams();
  const searchKey = search.toString();
  const queryClient = useQueryClient();
  const [launchContext, setLaunchContext] = useState<OperatorVisibleContext>();
  const [locale, setLocale] = useState<OperatorLocale>('en');
  const [caseMode, setCaseMode] = useState<'recent' | 'pinned' | 'archived'>(
    'recent'
  );
  const [caseQuery, setCaseQuery] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [planStale, setPlanStale] = useState(false);
  const [selectedAction, setSelectedAction] =
    useState<Extract<OperatorAction, { kind: 'plan' }>>();
  const [caseSheet, setCaseSheet] = useState(false);
  const [inspectorSheet, setInspectorSheet] = useState(false);
  const verifiedPlanRef = useRef<string | undefined>(undefined);

  const routeContext = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    const domain = params.get('domain');
    const view = params.get('view');
    const descriptor =
      operatorRouteManifest.find(
        (item) => item.domain === domain && item.view === view
      ) ??
      operatorRouteManifest.find((item) => item.domain === domain) ??
      operatorRouteManifest.find(
        (item) => item.domain === 'media_circulation'
      ) ??
      operatorRouteManifest[0];
    return {
      schema_version: 'wahb-operator/v1',
      domain: descriptor.domain,
      view: descriptor.view,
      filters: {},
      subjects: [{ type: 'tenant', id: 'current' }],
      available_intents: descriptor.available_intents,
    } as OperatorVisibleContext;
  }, [searchKey]);
  const visibleContext = launchContext ?? routeContext;

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const restored = consumeOperatorLaunchContext(
      params.get('domain') ?? undefined,
      params.get('view') ?? undefined
    );
    if (restored) setLaunchContext(restored);
  }, [searchKey]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        document.getElementById('operator-composer-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const replaceParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(search.toString());
      Object.entries(updates).forEach(([key, value]) =>
        value ? params.set(key, value) : params.delete(key)
      );
      params.set('domain', visibleContext.domain);
      params.set('view', visibleContext.view);
      router.replace(`/platform/operator?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, search, visibleContext.domain, visibleContext.view]
  );

  const activeThreadID = validUUID(search.get('thread'));
  const requestedInvestigationID = validUUID(search.get('investigation'));
  const requestedPlanID = validUUID(search.get('plan'));
  const inspector = validInspectors.has(search.get('inspector') as InspectorTab)
    ? (search.get('inspector') as InspectorTab)
    : 'evidence';
  const taskGroup = validGroups.has(
    search.get('task_group') as OperatorTaskGroup
  )
    ? (search.get('task_group') as OperatorTaskGroup)
    : search.get('inbox') === '1'
      ? 'needs_approval'
      : 'active';
  const taskKind = validKinds.has(search.get('task_kind') as OperatorTaskKind)
    ? (search.get('task_kind') as OperatorTaskKind)
    : 'all';
  const requestedIntent = validIntents.has(
    search.get('intent') as OperatorIntent
  )
    ? (search.get('intent') as OperatorIntent)
    : 'investigate';
  const intent = visibleContext.available_intents.includes(requestedIntent)
    ? requestedIntent
    : visibleContext.available_intents[0];

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    let changed = false;
    for (const key of ['thread', 'investigation', 'plan']) {
      const value = params.get(key);
      if (value && !uuidPattern.test(value)) {
        params.delete(key);
        changed = true;
      }
    }
    if (
      params.get('inspector') &&
      !validInspectors.has(params.get('inspector') as InspectorTab)
    ) {
      params.set('inspector', 'evidence');
      changed = true;
    }
    if (
      params.get('task_group') &&
      !validGroups.has(params.get('task_group') as OperatorTaskGroup)
    ) {
      params.set('task_group', 'active');
      changed = true;
    }
    if (
      params.get('task_kind') &&
      !validKinds.has(params.get('task_kind') as OperatorTaskKind)
    ) {
      params.set('task_kind', 'all');
      changed = true;
    }
    if (
      params.get('intent') &&
      !validIntents.has(params.get('intent') as OperatorIntent)
    ) {
      params.set('intent', 'investigate');
      changed = true;
    }
    const exactRoute = operatorRouteManifest.some(
      (item) =>
        item.domain === params.get('domain') && item.view === params.get('view')
    );
    if (!exactRoute) {
      params.set('domain', routeContext.domain);
      params.set('view', routeContext.view);
      changed = true;
    }
    if (changed)
      router.replace(`/platform/operator?${params.toString()}`, {
        scroll: false,
      });
  }, [routeContext.domain, routeContext.view, router, searchKey]);

  const status = useOperatorStatus();
  const controls = useOperatorControls();
  const threads = useOperatorThreads({
    archived: caseMode === 'archived',
    pinned: caseMode === 'pinned',
    q: caseQuery.trim() || undefined,
  });
  const thread = useOperatorThread(activeThreadID);
  const briefing = useOperatorBriefing(visibleContext, locale);
  const activeTasks = useOperatorTasks({ group: 'active', kind: 'all' });
  const approvalTasks = useOperatorTasks({
    group: 'needs_approval',
    kind: 'all',
  });
  const failedTasks = useOperatorTasks({ group: 'failed', kind: 'all' });
  const selectedTasks = useOperatorTasks({ group: taskGroup, kind: taskKind });
  const mutations = useOperatorMutations();

  useEffect(() => {
    if (thread.data?.thread.locale) setLocale(thread.data.thread.locale);
  }, [thread.data?.thread.locale]);

  const messages = (thread.data?.messages ?? []) as OperatorMessage[];
  const latestInvestigationID = [...messages]
    .reverse()
    .find((message) => message.investigation_id)?.investigation_id;
  const latestPlanID = [...messages]
    .reverse()
    .find((message) => message.plan_id)?.plan_id;
  const investigationID = requestedInvestigationID ?? latestInvestigationID;
  const planID = requestedPlanID ?? latestPlanID;
  const investigationEvents = useOperatorInvestigationEvents(investigationID);
  const investigationState =
    investigationEvents.data?.state ??
    (messages.some(
      (message) =>
        message.investigation_id === investigationID &&
        message.actor_type === 'operator'
    )
      ? 'completed'
      : undefined);
  const investigationCompleted = investigationState === 'completed';
  const evidence = useOperatorEvidence(investigationID);
  const actions = useOperatorEligibleActions(
    investigationID,
    investigationCompleted
  );
  const recommendations = useOperatorRecommendations(
    investigationID,
    investigationCompleted
  );
  const plan = useOperatorPlan(planID);
  const planEvents = useOperatorPlanEvents(planID);

  useEffect(() => {
    if (selectedAction || !plan.data?.tool_key || !actions.data?.items.length)
      return;
    const restored = actions.data.items.find(
      (item): item is Extract<OperatorAction, { kind: 'plan' }> =>
        item.kind === 'plan' && item.key === plan.data?.tool_key
    );
    if (restored) setSelectedAction(restored);
  }, [actions.data?.items, plan.data?.tool_key, selectedAction]);

  useEffect(() => {
    if (!activeThreadID || requestedInvestigationID || !latestInvestigationID)
      return;
    replaceParams({ investigation: latestInvestigationID, plan: latestPlanID });
  }, [
    activeThreadID,
    latestInvestigationID,
    latestPlanID,
    replaceParams,
    requestedInvestigationID,
  ]);

  useEffect(() => {
    if (!investigationCompleted) return;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: operatorKeys.thread(activeThreadID),
      }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'threads'] }),
      queryClient.invalidateQueries({ queryKey: ['operator', 'tasks'] }),
    ]);
  }, [activeThreadID, investigationCompleted, queryClient]);

  useEffect(() => {
    if (!planID || !planEvents.data?.state) return;
    void queryClient.invalidateQueries({ queryKey: operatorKeys.plan(planID) });
  }, [planEvents.data?.state, planID, queryClient]);

  useEffect(() => {
    const current = plan.data;
    if (
      !current ||
      current.state !== 'succeeded' ||
      verifiedPlanRef.current === current.id
    )
      return;
    verifiedPlanRef.current = current.id;
    const domains =
      current.verified_effects?.affected_domains ??
      current.affected_domains ??
      [];
    void mutations.invalidateAffectedDomains(domains);
  }, [mutations, plan.data]);

  const refreshAll = async () => {
    setError('');
    await queryClient.invalidateQueries({ queryKey: operatorKeys.all });
  };

  const startNewCase = () => {
    setPrompt('');
    setError('');
    setSelectedAction(undefined);
    setPlanStale(false);
    replaceParams({
      thread: undefined,
      investigation: undefined,
      plan: undefined,
      inspector: 'evidence',
      inbox: undefined,
    });
    setCaseSheet(false);
  };

  const selectThread = (id: string) => {
    setError('');
    setSelectedAction(undefined);
    setPlanStale(false);
    replaceParams({
      thread: id,
      investigation: undefined,
      plan: undefined,
      inspector: 'evidence',
      inbox: undefined,
    });
    setCaseSheet(false);
  };

  const send = async (event: FormEvent, confirmed = false): Promise<void> => {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || status.data?.controls.read_enabled !== true) return;
    setError('');
    try {
      const nextLocale = activeThreadID ? locale : detectedLocale(question);
      const threadID =
        activeThreadID ??
        (
          await mutations.createThread.mutateAsync({
            title: titleFrom(question, operatorCopy(nextLocale).newCase),
            locale: nextLocale,
          })
        ).id;
      const started = await mutations.startInvestigation.mutateAsync({
        visible_context: visibleContext,
        intent,
        locale: nextLocale,
        message: question,
        tier: 'fast',
        thread_id: threadID,
        spend_acknowledged: confirmed,
      });
      setLocale(nextLocale);
      setPrompt('');
      replaceParams({
        thread: threadID,
        investigation: started.investigation_id,
        plan: undefined,
        inspector: 'evidence',
        intent,
      });
      await queryClient.invalidateQueries({
        queryKey: operatorKeys.thread(threadID),
      });
    } catch (cause) {
      const failure = cause as ApiError;
      if (!confirmed && ['ai_budget_confirmation_required','interactive_soft_spend_warning'].includes(failure.code ?? '') && window.confirm(failure.message + '\nContinue with a paid interactive answer?')) {
        await send(event,true);
        return;
      }
      setError(failure.message ?? operatorCopy(locale).unavailable);
    }
  };

  const preparePlan = async (
    action: Extract<OperatorAction, { kind: 'plan' }>
  ) => {
    if (!investigationID) return;
    setSelectedAction(action);
    setPlanStale(false);
    setError('');
    try {
      const created = await mutations.createPlan.mutateAsync({
        investigation_id: investigationID,
        tool_key: action.key,
        target_ids: action.target_ids,
      });
      replaceParams({ plan: created.id, inspector: 'plan' });
      setInspectorSheet(true);
    } catch (cause) {
      setError(
        (cause as ApiError)?.message ?? operatorCopy(locale).unavailable
      );
    }
  };

  const approvePlan = async (confirmation: string) => {
    if (!planID) return;
    setError('');
    try {
      await mutations.approvePlan.mutateAsync({ id: planID, confirmation });
      setPlanStale(false);
    } catch (cause) {
      if ((cause as ApiError)?.status === 422) setPlanStale(true);
      else
        setError(
          (cause as ApiError)?.message ?? operatorCopy(locale).unavailable
        );
    }
  };

  const refreshStalePlan = () => {
    if (selectedAction) void preparePlan(selectedAction);
  };
  const toggleLocale = async () => {
    const next = locale === 'en' ? 'ar' : 'en';
    setLocale(next);
    if (activeThreadID) {
      try {
        await mutations.patchThread.mutateAsync({
          id: activeThreadID,
          locale: next,
        });
      } catch (cause) {
        setError(
          (cause as ApiError)?.message ?? operatorCopy(next).unavailable
        );
      }
    }
  };
  const cancelTask = (task: OperatorTask) => {
    if (task.kind === 'investigation' && task.investigation_id)
      void mutations.cancelInvestigation.mutateAsync(task.investigation_id);
    if (task.kind === 'plan' && task.plan_id)
      void mutations.cancelPlan.mutateAsync(task.plan_id);
  };
  const enabledControls = status.data
    ? Object.values(status.data.controls).filter(Boolean).length
    : 0;
  const refreshing =
    status.isFetching ||
    controls.isFetching ||
    threads.isFetching ||
    selectedTasks.isFetching;

  const rail = (
    <OperatorCaseRail
      locale={locale}
      threads={threads.data?.items ?? []}
      activeID={activeThreadID}
      mode={caseMode}
      query={caseQuery}
      loading={threads.isLoading}
      onMode={setCaseMode}
      onQuery={setCaseQuery}
      onCreate={startNewCase}
      onSelect={selectThread}
      onPatch={(item, patch) =>
        void mutations.patchThread.mutateAsync({ id: item.id, ...patch })
      }
      onDelete={(id) => {
        void mutations.deleteThread.mutateAsync(id);
        if (id === activeThreadID) startNewCase();
      }}
    />
  );
  const inspectorPanel = (
    <OperatorInspector
      locale={locale}
      tab={inspector}
      context={visibleContext}
      evidence={evidence.data?.items ?? []}
      tasks={selectedTasks.data?.items ?? []}
      taskGroup={taskGroup}
      taskKind={taskKind}
      controls={controls.data}
      plan={plan.data}
      planEvents={planEvents.data?.events ?? []}
      planStale={planStale}
      approving={mutations.approvePlan.isPending}
      onTab={(next) => replaceParams({ inspector: next })}
      onTaskGroup={(next) =>
        replaceParams({ task_group: next, inbox: undefined })
      }
      onTaskKind={(next) => replaceParams({ task_kind: next })}
      onCancelTask={cancelTask}
      onApprove={(phrase) => void approvePlan(phrase)}
      onCancelPlan={() => {
        if (planID) void mutations.cancelPlan.mutateAsync(planID);
      }}
      onRefreshPlan={refreshStalePlan}
    />
  );

  return (
    <div
      className="space-y-5"
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <OperatorWorkspaceHeader
        locale={locale}
        context={visibleContext}
        refreshing={refreshing}
        onLocale={() => void toggleLocale()}
        onRefresh={() => void refreshAll()}
        onNew={startNewCase}
        onOpenCases={() => setCaseSheet(true)}
        onOpenInspector={() => setInspectorSheet(true)}
      />
      <OperatorCapabilityNotices
        locale={locale}
        controls={status.data?.controls}
      />
      <OperatorStatusBand
        locale={locale}
        active={activeTasks.data?.items.length ?? 0}
        approvals={approvalTasks.data?.items.length ?? 0}
        failures={failedTasks.data?.items.length ?? 0}
        enabledControls={enabledControls}
        loading={
          activeTasks.isLoading ||
          approvalTasks.isLoading ||
          failedTasks.isLoading ||
          status.isLoading
        }
      />
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px] xl:items-start">
        <div className="hidden min-w-0 xl:block">{rail}</div>
        <Card className="flex min-h-[620px] min-w-0 flex-col overflow-hidden xl:h-[680px]">
          <CardHeader className="border-b p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {thread.data?.thread.title ??
                    operatorCopy(locale).shiftBriefing}
                </CardTitle>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {visibleContext.domain.replaceAll('_', ' ')} ·{' '}
                  {visibleContext.view.replaceAll('_', ' ')}
                </p>
              </div>
              {investigationState ? (
                <span className="text-xs text-muted-foreground">
                  {investigationState.replaceAll('_', ' ')}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {messages.length || investigationID ? (
              <OperatorTranscript
                locale={locale}
                messages={messages}
                activeInvestigationID={investigationID}
                investigationState={investigationState}
                investigationEvents={investigationEvents.data?.events ?? []}
                evidenceCount={evidence.data?.items.length ?? 0}
                actions={actions.data?.items ?? []}
                recommendations={recommendations.data?.items ?? []}
                onEvidence={() => {
                  replaceParams({ inspector: 'evidence' });
                  setInspectorSheet(true);
                }}
                onPrepare={(action) => void preparePlan(action)}
                onCancelInvestigation={() => {
                  if (investigationID)
                    void mutations.cancelInvestigation.mutateAsync(
                      investigationID
                    );
                }}
              />
            ) : (
              <OperatorBriefingPanel
                locale={locale}
                briefing={briefing.data as OperatorBriefing | undefined}
                loading={briefing.isLoading}
                activeTasks={activeTasks.data?.items.length ?? 0}
                onQuestion={(text, mode) => {
                  setPrompt(text);
                  replaceParams({ intent: mode });
                }}
              />
            )}
          </div>
          <OperatorComposer
            locale={locale}
            prompt={prompt}
            intent={intent}
            allowed={visibleContext.available_intents}
            disabled={status.data?.controls.read_enabled !== true}
            busy={
              mutations.createThread.isPending ||
              mutations.startInvestigation.isPending
            }
            onPrompt={setPrompt}
            onIntent={(next) => replaceParams({ intent: next })}
            onSubmit={send}
          />
        </Card>
        <div className="hidden min-w-0 xl:block">{inspectorPanel}</div>
      </div>
      <Sheet open={caseSheet} onOpenChange={setCaseSheet}>
        <SheetContent
          side="left"
          className="w-[min(92vw,340px)] p-3 sm:max-w-[340px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{operatorCopy(locale).cases}</SheetTitle>
          </SheetHeader>
          <div className="mt-8">{rail}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={inspectorSheet} onOpenChange={setInspectorSheet}>
        <SheetContent
          side="bottom"
          className="max-h-[86vh] overflow-y-auto p-3"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{operatorCopy(locale).inspector}</SheetTitle>
          </SheetHeader>
          <div className="mx-auto mt-6 max-w-2xl">{inspectorPanel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
