'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowDown, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  OPERATOR_PATH,
  useWorkspaceSession,
  type OperatorDraftSnapshot,
  type OperatorTab,
  type OperatorPendingQuestion,
} from '@/lib/stores/workspace-session';
import {
  defaultOperatorScope,
  operatorRouteManifest,
  operatorWorkspaceScopes,
} from '@/lib/operator/route-manifest';
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
  OperatorWorkspacePanel,
  OperatorTranscript,
  type OperatorWorkspaceView,
  type OperatorBriefing,
  type OperatorMessage,
} from './operator-workspace-components';
import { operatorCopy, type OperatorLocale } from './operator-copy';

import {
  OperatorConversationHeader,
  OperatorConversationSidebar,
  type OperatorSidebarSection,
} from './operator-conversation-chrome';
import {
  OperatorContextDetails,
  OperatorSourcesDetails,
  OperatorActivityDetails,
  OperatorStatusDetails,
  AnswerScope,
} from './operator-details';
import { operatorDetailsCopy } from './operator-details-copy';
import { operatorResponseBlocks } from './operator-answer';
import { OperatorActionGroups } from './operator-action-groups';
import {
  OperatorTabsWorkspace,
  type OperatorTabControls,
} from './operator-chat-tabs';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validViews = new Set<OperatorWorkspaceView>([
  'conversation',
  'evidence',
  'tasks',
  'plan',
  'governance',
]);
const validSidebarSections = new Set<OperatorSidebarSection>([
  'history',
  'context',
  'evidence',
  'tasks',
  'governance',
  'actions',
]);
const validGroups = new Set<OperatorTaskGroup>([
  'all',
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
function sameTargets(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function messageQuestion(message?: OperatorMessage) {
  const content = message?.content;
  return content &&
    typeof content === 'object' &&
    'text' in content &&
    typeof content.text === 'string'
    ? content.text
    : undefined;
}

type QuestionDraft = {
  question: string;
  locale: OperatorLocale;
  intent: OperatorIntent;
  context: OperatorVisibleContext;
  threadID?: string;
  originKey?: string;
};
type SavedDraft = OperatorDraftSnapshot;

export function OperatorWorkspace() {
  return (
    <OperatorTabsWorkspace>
      {(tab, controls) => (
        <OperatorChatWorkspace key={tab.id} tab={tab} tabs={controls} />
      )}
    </OperatorTabsWorkspace>
  );
}

function OperatorChatWorkspace({
  tab,
  tabs,
}: {
  tab: OperatorTab;
  tabs: OperatorTabControls;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const searchKey = search.toString();
  const queryClient = useQueryClient();
  const sessionOwner = useRef(useWorkspaceSession.getState().owner);
  const initialDraft = useRef(
    useWorkspaceSession.getState().drafts[tab.id] ??
      useWorkspaceSession.getState().drafts[
        tab.threadID ?? (!search.has('draft') ? 'new' : '')
      ]
  ).current;
  const mountedRef = useRef(true);
  const [launchContext, setLaunchContext] = useState<
    OperatorVisibleContext | undefined
  >(initialDraft?.context);
  const attachedOnEntryRef = useRef(false);
  const restoredEntryRef = useRef(false);
  const [locale, setLocale] = useState<OperatorLocale>(
    initialDraft?.locale ?? useWorkspaceSession.getState().locale
  );
  const [caseMode, setCaseMode] = useState<'recent' | 'pinned' | 'archived'>(
    'recent'
  );
  const [caseQuery, setCaseQuery] = useState('');
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? '');
  const request = useWorkspaceSession(
    (state) => state.operatorRequests[tab.id]
  );
  const error = request?.error ?? '';
  const setError = (error: string) =>
    useWorkspaceSession
      .getState()
      .setOperatorRequest(tab.id, { error }, sessionOwner.current);
  const [planStale, setPlanStale] = useState(false);
  const [selectedAction, setSelectedAction] =
    useState<Extract<OperatorAction, { kind: 'plan' }>>();
  const [caseSheet, setCaseSheet] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<OperatorSidebarSection>(
    () =>
      validSidebarSections.has(search.get('sidebar') as OperatorSidebarSection)
        ? (search.get('sidebar') as OperatorSidebarSection)
        : 'history'
  );
  const [planExpanded, setPlanExpanded] = useState(false);
  const [newReply, setNewReply] = useState(false);
  const [readingLatest, setReadingLatest] = useState(
    search.has('focus') ? false : (initialDraft?.follow ?? true)
  );
  const pendingQuestion = request?.pending;
  const setPendingQuestion = useCallback(
    (pending: OperatorPendingQuestion | undefined) =>
      useWorkspaceSession
        .getState()
        .setOperatorRequest(tab.id, { pending }, sessionOwner.current),
    [tab.id]
  );
  const draftOwner = useRef(tab.id);
  const draftSnapshot = useRef<SavedDraft | undefined>(initialDraft);
  const sidebarReturnFocus = useRef<HTMLElement | null>(null);
  const [budgetReview, setBudgetReview] = useState<
    QuestionDraft & { reason: string }
  >();
  const draftThreadRef = useRef<string | undefined>(initialDraft?.threadID);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef(initialDraft?.scroll ?? 0);
  const restoreScrollRef = useRef(Boolean(initialDraft));
  const followReplyRef = useRef(
    !search.has('focus') && (initialDraft?.follow ?? true)
  );
  const inlinePlanRef = useRef<HTMLDivElement>(null);
  const olderScrollRef = useRef<{ height: number; top: number } | undefined>(
    undefined
  );
  const verifiedPlanRef = useRef<string | undefined>(undefined);
  const acceptedQuestionsRef = useRef(new Set<string>());
  const readInvestigationsRef = useRef(new Set<string>());

  useEffect(() => {
    // A pending navigation can briefly mount the outgoing route again. Only
    // a workspace mounted at its own URL can own the draft on cleanup.
    mountedRef.current = window.location.pathname === OPERATOR_PATH;
    if (!mountedRef.current) return;
    const save = () => {
      if (sessionOwner.current !== useWorkspaceSession.getState().owner) return;
      if (draftSnapshot.current) {
        const snapshot = {
          ...draftSnapshot.current,
          scroll: transcriptScrollRef.current,
          follow: followReplyRef.current,
          threadID: draftThreadRef.current,
        };
        const state = useWorkspaceSession.getState();
        const savedTab = [
          ...state.operatorTabs,
          ...state.closedOperatorTabs,
        ].find((item) => item.id === tab.id);
        if (!savedTab) return;
        const threadID = savedTab.threadID;
        useWorkspaceSession.getState().saveDrafts({
          [tab.id]: snapshot,
          ...(threadID ? { [threadID]: snapshot } : {}),
        });
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      mountedRef.current = false;
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [tab.id]);

  useEffect(() => {
    useWorkspaceSession.getState().setLocale(locale);
  }, [locale]);

  const routeContext = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    const domain = params.get('domain');
    const view = params.get('view');
    const descriptor =
      operatorRouteManifest.find(
        (item) => item.domain === domain && item.view === view
      ) ??
      operatorRouteManifest.find((item) => item.domain === domain) ??
      defaultOperatorScope;
    return {
      schema_version: 'wahb-operator/v1',
      domain: descriptor.domain,
      view: descriptor.view,
      filters: {},
      subjects: [],
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
    if (restored) {
      attachedOnEntryRef.current = true;
      setLaunchContext(restored);
    }
  }, [searchKey]);

  const replaceParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(search.toString());
      params.set('domain', visibleContext.domain);
      params.set('view', visibleContext.view);
      Object.entries(updates).forEach(([key, value]) =>
        value ? params.set(key, value) : params.delete(key)
      );
      router.replace(`/platform/operator?${params.toString()}`, {
        scroll: false,
        fromPath: OPERATOR_PATH,
      });
    },
    [router, search, visibleContext.domain, visibleContext.view]
  );

  const activeThreadID = validUUID(search.get('thread')) ?? tab.threadID;
  const requestedInvestigationID = validUUID(search.get('investigation'));
  const requestedPlanID = validUUID(search.get('plan'));
  const requestedEvidenceID = validUUID(search.get('evidence_for'));
  const focusedInvestigationID = validUUID(search.get('focus'));
  const activeChatKey = tab.id;
  if (draftOwner.current === undefined) draftOwner.current = activeChatKey;
  const sidebarVisible = desktop ? sidebarOpen : caseSheet;
  const panelParam = search.get('panel') ?? search.get('inspector');
  const workspaceView: OperatorWorkspaceView = validViews.has(
    panelParam as OperatorWorkspaceView
  )
    ? (panelParam as OperatorWorkspaceView)
    : requestedPlanID
      ? 'plan'
      : search.get('task_kind') || search.get('inbox') === '1'
        ? 'tasks'
        : 'conversation';
  const taskGroup = validGroups.has(
    search.get('task_group') as OperatorTaskGroup
  )
    ? (search.get('task_group') as OperatorTaskGroup)
    : search.get('inbox') === '1'
      ? 'needs_approval'
      : 'all';
  const taskScope =
    search.get('task_scope') === 'all' || search.get('inbox') === '1'
      ? 'all'
      : 'chat';
  const taskKind = validKinds.has(search.get('task_kind') as OperatorTaskKind)
    ? (search.get('task_kind') as OperatorTaskKind)
    : 'all';
  const requestedIntent = validIntents.has(
    search.get('intent') as OperatorIntent
  )
    ? (search.get('intent') as OperatorIntent)
    : 'explain';
  const intent = visibleContext.available_intents.includes(requestedIntent)
    ? requestedIntent
    : visibleContext.available_intents[0];

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    let changed = false;
    for (const key of [
      'thread',
      'investigation',
      'plan',
      'evidence_for',
      'focus',
      'draft',
    ]) {
      const value = params.get(key);
      if (value && !uuidPattern.test(value)) {
        params.delete(key);
        changed = true;
      }
    }
    for (const key of ['panel', 'inspector']) {
      const value = params.get(key);
      if (value && !validViews.has(value as OperatorWorkspaceView)) {
        params.delete(key);
        changed = true;
      }
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
    if (!restoredEntryRef.current) {
      restoredEntryRef.current = true;
      if (initialDraft && !attachedOnEntryRef.current) {
        for (const [key, value] of Object.entries({
          domain: initialDraft.context.domain,
          view: initialDraft.context.view,
          intent: initialDraft.intent,
        })) {
          if (params.get(key) !== value) {
            params.set(key, value);
            changed = true;
          }
        }
      }
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
        fromPath: OPERATOR_PATH,
      });
  }, [initialDraft, routeContext.domain, routeContext.view, router, searchKey]);

  const status = useOperatorStatus();
  const controls = useOperatorControls(
    sidebarVisible && sidebarSection === 'governance'
  );
  const threads = useOperatorThreads(
    {
      archived: caseMode === 'archived',
      pinned: caseMode === 'pinned',
      q: caseQuery.trim() || undefined,
    },
    sidebarVisible && sidebarSection === 'history'
  );
  const thread = useOperatorThread(
    activeThreadID,
    focusedInvestigationID ?? requestedEvidenceID
  );
  const briefing = useOperatorBriefing(visibleContext, locale, !activeThreadID);
  const selectedTasks = useOperatorTasks(
    {
      group: taskGroup,
      kind: taskKind,
      ...(taskScope === 'chat' && activeThreadID
        ? { threadID: activeThreadID }
        : {}),
    },
    sidebarVisible &&
      sidebarSection === 'tasks' &&
      (taskScope === 'all' || Boolean(activeThreadID))
  );
  const mutations = useOperatorMutations();

  useEffect(() => {
    if (thread.data?.thread.locale) setLocale(thread.data.thread.locale);
  }, [thread.data?.thread.locale]);

  const messages = useMemo(
    () => (thread.data?.messages ?? []) as OperatorMessage[],
    [thread.data?.messages]
  );
  const latestInvestigationID = [...messages]
    .reverse()
    .find((message) => message.investigation_id)?.investigation_id;
  const latestPlanID = [...messages]
    .reverse()
    .find((message) => message.plan_id)?.plan_id;
  // A new accepted UUID may precede the refreshed messages. Older citations
  // inspect their own packet without taking over the active conversation run.
  const requestedIsRecorded = messages.some(
    (message) => message.investigation_id === requestedInvestigationID
  );
  const investigationID =
    pendingQuestion?.investigationID ??
    (requestedInvestigationID && !requestedIsRecorded && !focusedInvestigationID
      ? requestedInvestigationID
      : (latestInvestigationID ?? requestedInvestigationID));
  const inspectedInvestigationID =
    requestedEvidenceID ??
    (workspaceView === 'evidence' ? requestedInvestigationID : undefined) ??
    investigationID;
  const evidenceQuestion = messageQuestion(
    messages.find(
      (message) =>
        message.actor_type === 'admin' &&
        message.investigation_id === inspectedInvestigationID
    )
  );
  const inspectedReply = [...messages]
    .reverse()
    .find(
      (message) =>
        message.actor_type === 'operator' &&
        message.investigation_id === inspectedInvestigationID
    );
  const latestReply = [...messages]
    .reverse()
    .find(
      (message) =>
        message.actor_type === 'operator' &&
        message.investigation_id === investigationID
    );
  const citations = useMemo(() => {
    try {
      const raw = search.get('citations');
      if (!raw || raw.length > 4000) return [];
      const ids: unknown = JSON.parse(raw);
      return Array.isArray(ids) &&
        ids.length <= 30 &&
        ids.every((id) => typeof id === 'string' && id.length <= 200)
        ? (ids as string[])
        : [];
    } catch {
      return [];
    }
  }, [search]);
  const inspectedActions = useOperatorEligibleActions(
    inspectedInvestigationID,
    sidebarVisible && sidebarSection === 'actions' && Boolean(inspectedReply)
  );
  const inspectedRecommendations = useOperatorRecommendations(
    inspectedInvestigationID,
    sidebarVisible && sidebarSection === 'actions' && Boolean(inspectedReply)
  );
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
      : pendingQuestion?.investigationID === investigationID
        ? pendingQuestion?.state
        : undefined);
  const investigationCompleted = investigationState === 'completed';
  const readWorking =
    investigationState !== undefined
      ? ['accepted', 'backgrounded', 'running'].includes(investigationState)
      : (tabs.summary?.active_investigation_count ?? 0) > 0;
  const evidence = useOperatorEvidence(
    inspectedInvestigationID,
    sidebarVisible && sidebarSection === 'evidence'
  );
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
    if (
      !plan.data?.tool_key ||
      !actions.data?.items.length ||
      plan.data.investigation_id !== investigationID
    )
      return;
    const targets = plan.data.canonical_plan.target_ids;
    const restored = actions.data.items.find(
      (item): item is Extract<OperatorAction, { kind: 'plan' }> =>
        item.kind === 'plan' &&
        item.key === plan.data?.tool_key &&
        sameTargets(item.target_ids, targets)
    );
    if (restored) setSelectedAction(restored);
  }, [actions.data?.items, plan.data, investigationID]);

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
      queryClient.invalidateQueries({
        queryKey: ['operator', 'tab-summaries'],
      }),
      queryClient.invalidateQueries({
        queryKey: operatorKeys.evidence(investigationID),
      }),
    ]);
  }, [activeThreadID, investigationID, investigationCompleted, queryClient]);

  useEffect(() => {
    if (
      thread.data?.thread.title &&
      sessionOwner.current === useWorkspaceSession.getState().owner
    )
      useWorkspaceSession
        .getState()
        .updateOperatorTab(tab.id, { title: thread.data.thread.title });
  }, [thread.data?.thread.title, tab.id]);

  useEffect(() => {
    if (!tab.threadID)
      useWorkspaceSession.getState().updateOperatorTab(tab.id, {
        title: titleFrom(prompt, operatorCopy(locale).newCase),
      });
  }, [tab.id, tab.threadID, prompt, locale]);

  useEffect(() => {
    if (
      pendingQuestion?.investigationID &&
      !request?.saving &&
      !acceptedQuestionsRef.current.has(pendingQuestion.investigationID)
    ) {
      acceptedQuestionsRef.current.add(pendingQuestion.investigationID);
      if (prompt.trim() === pendingQuestion.text) {
        setPrompt('');
        const saved = useWorkspaceSession.getState().drafts[tab.id];
        if (saved) setLaunchContext(saved.context);
      }
    }
  }, [
    pendingQuestion?.investigationID,
    pendingQuestion?.text,
    request?.saving,
    prompt,
    tab.id,
  ]);

  useEffect(() => {
    if (
      !investigationID ||
      !['completed', 'failed', 'cancelled'].includes(
        investigationState ?? ''
      ) ||
      !mutations.markInvestigationRead ||
      readInvestigationsRef.current.has(investigationID)
    )
      return;
    if (
      investigationCompleted &&
      !messages.some(
        (message) =>
          message.actor_type === 'operator' &&
          message.investigation_id === investigationID
      )
    )
      return;
    const acknowledge = () => {
      if (
        document.visibilityState === 'hidden' ||
        !readingLatest ||
        readInvestigationsRef.current.has(investigationID)
      )
        return;
      readInvestigationsRef.current.add(investigationID);
      void mutations.markInvestigationRead
        .mutateAsync(investigationID)
        .catch(() => readInvestigationsRef.current.delete(investigationID));
    };
    acknowledge();
    document.addEventListener('visibilitychange', acknowledge);
    return () => document.removeEventListener('visibilitychange', acknowledge);
  }, [
    investigationID,
    investigationState,
    investigationCompleted,
    messages,
    mutations.markInvestigationRead,
    readingLatest,
  ]);

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

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setDesktop(media.matches);
      if (media.matches) setCaseSheet(false);
    };
    update();
    media.addEventListener('change', update);
    try {
      setSidebarOpen(localStorage.getItem('operator.sidebar.open') === 'true');
    } catch {}
    return () => media.removeEventListener('change', update);
  }, []);

  const setSidebarVisible = (open: boolean) => {
    if (desktop) {
      setSidebarOpen(open);
      try {
        localStorage.setItem('operator.sidebar.open', String(open));
      } catch {}
    } else setCaseSheet(open);
  };
  const closeSidebar = () => {
    setSidebarVisible(false);
    if (workspaceView !== 'conversation' && workspaceView !== 'plan')
      replaceParams({ panel: 'conversation', inspector: undefined });
    const target = sidebarReturnFocus.current;
    if (desktop)
      requestAnimationFrame(() =>
        (target?.isConnected
          ? target
          : document.getElementById('operator-sidebar-trigger')
        )?.focus()
      );
  };
  const showSidebar = (
    section: OperatorSidebarSection,
    updates: Record<string, string | undefined> = {}
  ) => {
    if (!sidebarVisible)
      sidebarReturnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setSidebarSection(section);
    setSidebarVisible(true);
    replaceParams({
      sidebar: section,
      detail: undefined,
      panel: ['evidence', 'tasks', 'governance'].includes(section)
        ? section
        : 'conversation',
      inspector: undefined,
      ...updates,
    });
  };
  useEffect(() => {
    if (workspaceView === 'plan') {
      setPlanExpanded(true);
      setCaseSheet(false);
    } else if (workspaceView !== 'conversation') {
      setSidebarSection(workspaceView);
      if (window.matchMedia('(min-width: 1024px)').matches)
        setSidebarOpen(true);
      else setCaseSheet(true);
    }
  }, [workspaceView]);

  useEffect(() => {
    draftSnapshot.current = {
      prompt,
      context: visibleContext,
      intent,
      locale,
      scroll: transcriptScrollRef.current,
      follow: followReplyRef.current,
      threadID: draftThreadRef.current,
    };
  }, [prompt, visibleContext, intent, locale]);

  useEffect(() => {
    if (
      pendingQuestion?.investigationID &&
      messages.some(
        (message) =>
          message.actor_type === 'admin' &&
          message.investigation_id === pendingQuestion.investigationID
      )
    )
      setPendingQuestion(undefined);
  }, [messages, pendingQuestion, setPendingQuestion]);

  const refreshAll = async () => {
    setError('');
    await queryClient.invalidateQueries({ queryKey: operatorKeys.all });
  };

  const startNewCase = tabs.newChat;
  const selectThread = (id: string) => {
    const selected = threads.data?.items.find((item) => item.id === id);
    if (selected) tabs.openThread(selected, 'history');
  };

  const sendQuestion = async (
    draft: QuestionDraft,
    confirmed = false
  ): Promise<void> => {
    if (status.data?.controls.read_enabled !== true || readWorking) return;
    const originKey = tab.id;
    if (
      !useWorkspaceSession.getState().beginOperatorRequest(
        originKey,
        {
          text: draft.question,
          at: new Date().toISOString(),
          owner: originKey,
        },
        sessionOwner.current
      )
    )
      return;
    followReplyRef.current = true;
    setReadingLatest(true);
    setError('');
    let threadID = draft.threadID ?? activeThreadID ?? draftThreadRef.current;
    try {
      if (!threadID) {
        threadID = (
          await mutations.createThread.mutateAsync({
            title: titleFrom(
              draft.question,
              operatorCopy(draft.locale).newCase
            ),
            locale: draft.locale,
          })
        ).id;
        if (draftOwner.current === originKey) draftThreadRef.current = threadID;
        if (sessionOwner.current === useWorkspaceSession.getState().owner)
          useWorkspaceSession.getState().updateOperatorTab(tab.id, {
            threadID,
            title: titleFrom(
              draft.question,
              operatorCopy(draft.locale).newCase
            ),
          });
        const state = useWorkspaceSession.getState();
        const saved = state.drafts[originKey];
        if (
          state.owner === sessionOwner.current &&
          saved?.prompt.trim() === draft.question
        )
          state.saveDrafts({ [originKey]: { ...saved, threadID } });
      }
      const started = await mutations.startInvestigation.mutateAsync({
        visible_context: draft.context,
        intent: draft.intent,
        locale: draft.locale,
        message: draft.question,
        tier: 'fast',
        thread_id: threadID,
        spend_acknowledged: confirmed,
      });
      const resolved = started.visible_context ?? draft.context;
      if (draftOwner.current === originKey) draftThreadRef.current = undefined;
      const cleared: SavedDraft = {
        prompt: '',
        context: resolved,
        intent: draft.intent,
        scroll: 0,
        follow: true,
        locale: draft.locale,
      };
      const resumedParams = new URLSearchParams({
        domain: resolved.domain,
        view: resolved.view,
        intent: draft.intent,
        thread: threadID,
        investigation: started.investigation_id,
      });
      const resumedHref = `/platform/operator?${resumedParams}`;
      if (sessionOwner.current === useWorkspaceSession.getState().owner) {
        const existing = useWorkspaceSession.getState().drafts[originKey];
        useWorkspaceSession.getState().saveDrafts({
          [threadID]: cleared,
          ...(!existing || existing.prompt.trim() === draft.question
            ? { [originKey]: cleared }
            : {}),
        });
        useWorkspaceSession
          .getState()
          .updateOperatorTab(tab.id, { threadID, href: resumedHref });
      }
      setPendingQuestion({
        text: draft.question,
        at: new Date().toISOString(),
        owner: originKey,
        investigationID: started.investigation_id,
        state: started.state,
      });
      if (mountedRef.current && draftOwner.current === originKey) {
        setLocale(draft.locale);
        setLaunchContext(resolved);
        setPrompt('');
        draftSnapshot.current = cleared;
        followReplyRef.current = true;
        setPlanExpanded(false);
        setSelectedAction(undefined);
        replaceParams({
          thread: threadID,
          draft: undefined,
          investigation: started.investigation_id,
          domain: resolved.domain,
          view: resolved.view,
          plan: undefined,
          panel: 'conversation',
          inspector: undefined,
          evidence_for: undefined,
          focus: undefined,
          citations: undefined,
          intent: draft.intent,
        });
      }
      void queryClient.invalidateQueries({
        queryKey: operatorKeys.thread(threadID),
      });
    } catch (cause) {
      setPendingQuestion(undefined);
      const failure = cause as ApiError;
      if (
        !confirmed &&
        [
          'ai_budget_confirmation_required',
          'interactive_soft_spend_warning',
        ].includes(failure.code ?? '')
      ) {
        useWorkspaceSession
          .getState()
          .setOperatorRequest(
            tab.id,
            { budgetRequired: true, error: failure.message },
            sessionOwner.current
          );
        if (mountedRef.current)
          setBudgetReview({
            ...draft,
            originKey,
            threadID,
            reason: failure.message,
          });
      } else setError(failure.message ?? operatorCopy(locale).unavailable);
    } finally {
      useWorkspaceSession
        .getState()
        .setOperatorRequest(tab.id, { saving: false }, sessionOwner.current);
    }
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const question = prompt.trim();
    if (question)
      void sendQuestion({
        question,
        locale: activeThreadID ? locale : detectedLocale(question),
        intent,
        context: visibleContext,
        originKey: activeChatKey,
      });
  };
  const focusQuestion = (question: string, mode?: OperatorIntent) => {
    setPrompt(question);
    if (mode && visibleContext.available_intents.includes(mode))
      replaceParams({ intent: mode });
    document.getElementById('operator-composer-input')?.focus();
  };
  const chooseScope = (domain: string) => {
    const scope = operatorWorkspaceScopes.find(
      (item) => item.domain === domain
    );
    if (!scope || domain === visibleContext.domain) return;
    const context: OperatorVisibleContext = {
      schema_version: 'wahb-operator/v1',
      domain: scope.domain,
      view: scope.view,
      filters: {},
      subjects: [],
      available_intents: scope.available_intents,
    };
    setLaunchContext(context);
    setError('');
    replaceParams({
      domain: scope.domain,
      view: scope.view,
      intent: scope.available_intents.includes(intent)
        ? intent
        : scope.available_intents[0],
    });
  };
  const openPanel = (
    view: OperatorWorkspaceView,
    group?: OperatorTaskGroup
  ) => {
    if (view === 'plan') {
      setPlanExpanded(true);
      setCaseSheet(false);
      replaceParams({ panel: 'plan', inspector: undefined });
    } else if (view !== 'conversation') {
      showSidebar(view);
      if (group)
        replaceParams({ panel: view, task_group: group, inspector: undefined });
    }
  };
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    if (olderScrollRef.current) {
      if (thread.isFetchingNextPage) return;
      const saved = olderScrollRef.current;
      olderScrollRef.current = undefined;
      el.scrollTop = saved.top + el.scrollHeight - saved.height;
      return;
    }
    if (restoreScrollRef.current) {
      if (thread.isLoading) return;
      el.scrollTop = followReplyRef.current
        ? el.scrollHeight
        : transcriptScrollRef.current;
      restoreScrollRef.current = false;
      setNewReply(false);
      return;
    }
    if (followReplyRef.current) {
      el.scrollTop = el.scrollHeight;
      setNewReply(false);
    } else setNewReply(true);
  }, [
    messages.length,
    investigationEvents.data?.next_sequence,
    activeThreadID,
    pendingQuestion?.at,
    thread.isLoading,
    thread.isFetchingNextPage,
  ]);
  useEffect(() => {
    if (planExpanded)
      requestAnimationFrame(() =>
        inlinePlanRef.current?.scrollIntoView?.({ block: 'nearest' })
      );
  }, [planExpanded, plan.data?.id]);

  useEffect(() => {
    if (planExpanded) inlinePlanRef.current?.focus({ preventScroll: true });
  }, [planExpanded]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followReplyRef.current && !restoreScrollRef.current)
        el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const preparePlan = async (
    action: Extract<OperatorAction, { kind: 'plan' }>,
    sourceInvestigationID = investigationID
  ) => {
    if (!sourceInvestigationID) return;
    setSelectedAction(action);
    setPlanStale(false);
    setError('');
    try {
      const created = await mutations.createPlan.mutateAsync({
        investigation_id: sourceInvestigationID,
        tool_key: action.key,
        target_ids: action.target_ids,
      });
      if (!mountedRef.current) return;
      setPlanExpanded(true);
      setSidebarVisible(false);
      replaceParams({
        plan: created.id,
        panel: 'plan',
        inspector: undefined,
        evidence_for: sourceInvestigationID,
      });
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

  useEffect(() => {
    if (!focusedInvestigationID) return;
    const target = document.getElementById(
      `operator-message-${focusedInvestigationID}`
    );
    if (target) {
      followReplyRef.current = false;
      setReadingLatest(false);
      target.scrollIntoView?.({ block: 'start' });
    }
  }, [focusedInvestigationID, messages.length]);

  const refreshStalePlan = () => {
    if (selectedAction)
      void preparePlan(
        selectedAction,
        plan.data?.investigation_id ?? inspectedInvestigationID
      );
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
  const refreshing =
    status.isFetching ||
    controls.isFetching ||
    threads.isFetching ||
    selectedTasks.isFetching;

  const rail = (
    <OperatorCaseRail
      embedded
      locale={locale}
      threads={threads.data?.items ?? []}
      activeID={activeThreadID}
      mode={caseMode}
      query={caseQuery}
      loading={threads.isLoading}
      error={threads.isError}
      onRetry={() => void threads.refetch()}
      hasMore={threads.hasNextPage}
      fetchingMore={threads.isFetchingNextPage}
      onMore={() => void threads.fetchNextPage()}
      onMode={setCaseMode}
      onQuery={setCaseQuery}
      onSelect={selectThread}
      onPatch={(item, patch) =>
        void mutations.patchThread
          .mutateAsync({ id: item.id, ...patch })
          .catch((cause: ApiError) =>
            setError(cause.message ?? operatorCopy(locale).unavailable)
          )
      }
      onDelete={(id) => {
        void mutations.deleteThread
          .mutateAsync(id)
          .then(() => tabs.deletedThread(id))
          .catch((cause: ApiError) =>
            setError(cause.message ?? operatorCopy(locale).unavailable)
          );
      }}
    />
  );
  const busy = request?.saving === true;
  const t = operatorCopy(locale);
  const optimistic =
    pendingQuestion &&
    pendingQuestion.owner === activeChatKey &&
    (!pendingQuestion.investigationID ||
      !messages.some(
        (message) =>
          message.actor_type === 'admin' &&
          message.investigation_id === pendingQuestion.investigationID
      ))
      ? pendingQuestion
      : undefined;
  const displayMessages: OperatorMessage[] = optimistic
    ? [
        ...messages,
        {
          id: 'local-question',
          kind: 'message',
          actor_type: 'admin',
          created_at: optimistic.at,
          content: { text: optimistic.text },
        },
      ]
    : messages;
  const d = operatorDetailsCopy(locale);
  const putFollowUp = (text: string) => {
    setPrompt(text);
    closeSidebar();
    requestAnimationFrame(() =>
      document.getElementById('operator-composer-input')?.focus()
    );
  };
  const openTask = (task: OperatorTask) => {
    followReplyRef.current = false;
    setReadingLatest(false);
    const params = new URLSearchParams(task.deep_link.split('?')[1]);
    const scope =
      operatorWorkspaceScopes.find((item) => item.domain === task.domain) ??
      defaultOperatorScope;
    params.set(
      'domain',
      task.thread_id === activeThreadID ? visibleContext.domain : scope.domain
    );
    params.set(
      'view',
      task.thread_id === activeThreadID ? visibleContext.view : scope.view
    );
    params.set('panel', task.kind === 'plan' ? 'plan' : 'conversation');
    if (task.investigation_id) {
      params.set('evidence_for', task.investigation_id);
      params.set('focus', task.investigation_id);
    }
    setSidebarVisible(false);
    router.replace(`/platform/operator?${params}`, { scroll: false, fromPath: OPERATOR_PATH });
  };
  const sidebar = (
    <OperatorConversationSidebar
      locale={locale}
      title={thread.data?.thread.title ?? tab.title}
      section={sidebarSection}
      detailKey={
        sidebarSection === 'evidence' || sidebarSection === 'actions'
          ? `${inspectedInvestigationID}:${citations.join(',')}`
          : undefined
      }
      onClose={closeSidebar}
      onSection={showSidebar}
    >
      {sidebarSection === 'history' ? (
        rail
      ) : sidebarSection === 'context' ? (
        <OperatorContextDetails
          locale={locale}
          context={visibleContext}
          onChange={setLaunchContext}
        />
      ) : sidebarSection === 'evidence' ? (
        <OperatorSourcesDetails
          locale={locale}
          question={evidenceQuestion}
          reply={inspectedReply}
          evidence={evidence.data?.items ?? []}
          selectedIDs={citations}
          loading={evidence.isLoading}
          error={evidence.isError}
          onRetry={() => void evidence.refetch()}
          onAll={() => replaceParams({ citations: undefined })}
          onFollow={() =>
            putFollowUp(`${d.sourcePrompt} ${evidenceQuestion ?? ''}`)
          }
        />
      ) : sidebarSection === 'tasks' ? (
        <OperatorActivityDetails
          locale={locale}
          scope={taskScope}
          onScope={(scope) => replaceParams({ task_scope: scope })}
          group={taskGroup}
          onGroup={(group) => replaceParams({ task_group: group })}
          kind={taskKind}
          onKind={(kind) => replaceParams({ task_kind: kind })}
          tasks={selectedTasks.data?.items ?? []}
          loading={selectedTasks.isLoading}
          error={selectedTasks.isError}
          onRetry={() => void selectedTasks.refetch()}
          onCancel={cancelTask}
          onOpen={openTask}
          hasMore={selectedTasks.hasNextPage}
          fetchingMore={selectedTasks.isFetchingNextPage}
          onMore={() => void selectedTasks.fetchNextPage()}
          hasChat={Boolean(activeThreadID)}
          events={investigationEvents.data?.events ?? []}
        />
      ) : sidebarSection === 'governance' ? (
        <OperatorStatusDetails
          locale={locale}
          controls={controls.data}
          loading={controls.isLoading}
          error={controls.isError}
          onRetry={() => void controls.refetch()}
          state={investigationState}
          reply={latestReply}
        />
      ) : (
        <div className="space-y-4 pb-4">
          <div className="px-4 pt-4">
            <AnswerScope
              locale={locale}
              question={evidenceQuestion}
              at={inspectedReply?.created_at}
            />
          </div>
          {inspectedActions.isError || inspectedRecommendations.isError ? (
            <div role="alert" className="px-4 text-xs leading-5 text-warning">
              {t.actionsUnavailable}
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  void inspectedActions.refetch();
                  void inspectedRecommendations.refetch();
                }}
              >
                {d.retry}
              </Button>
            </div>
          ) : inspectedActions.data?.items.length ||
            inspectedRecommendations.data?.items.length ? (
            <OperatorActionGroups
              narrow
              locale={locale}
              actions={inspectedActions.data?.items ?? []}
              recommendations={inspectedRecommendations.data?.items ?? []}
              onPrepare={(action) =>
                void preparePlan(action, inspectedInvestigationID)
              }
            />
          ) : (
            <p className="px-4 text-sm leading-6 text-muted-foreground">
              {inspectedActions.isLoading || inspectedRecommendations.isLoading
                ? t.loading
                : inspectedReply
                  ? d.noSteps
                  : d.noAnswer}
            </p>
          )}
          {inspectedReply && evidenceQuestion ? (
            <section className="space-y-2 border-t px-4 pt-4">
              <h3 className="text-xs font-medium">{d.followUps}</h3>
              <p className="text-xs leading-5 text-muted-foreground">
                {d.followHelp}
              </p>
              {[
                d.recheck,
                ...(operatorResponseBlocks(inspectedReply.content).some(
                  (block) => ['unknown', 'degraded'].includes(block.kind)
                )
                  ? [d.explainGaps]
                  : []),
              ].map((text) => (
                <Button
                  key={text}
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-9 w-full justify-between whitespace-normal text-start text-xs"
                  onClick={() => putFollowUp(`${text}: ${evidenceQuestion}`)}
                >
                  {text}
                  <ArrowDown className="ms-2 size-3.5 shrink-0" />
                </Button>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </OperatorConversationSidebar>
  );
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <OperatorConversationHeader
        locale={locale}
        title={thread.data?.thread.title ?? t.title}
        sidebarOpen={sidebarVisible && sidebarSection === 'history'}
        refreshing={refreshing}
        busy={busy}
        onSidebar={() =>
          sidebarVisible && sidebarSection === 'history'
            ? closeSidebar()
            : showSidebar('history')
        }
        onActivity={() => showSidebar('tasks')}
        onStatus={() => showSidebar('governance')}
        onLocale={() => void toggleLocale()}
        onRefresh={() => void refreshAll()}
        onNew={startNewCase}
        tabs={tabs.bar}
        onReopen={tabs.reopen}
        canReopen={tabs.canReopen}
        canNew={tabs.canNew}
      />
      <div className="flex min-h-0 flex-1">
        {desktop && sidebarOpen ? (
          <aside
            className="w-80 shrink-0 border-e"
            aria-label={t.sidebarSections}
          >
            {sidebar}
          </aside>
        ) : null}
        <div
          id={`operator-chat-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`operator-tab-${tab.id}`}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div className="mx-auto w-full max-w-[880px] shrink-0 px-4 sm:px-7">
            <OperatorCapabilityNotices
              locale={locale}
              controls={status.data?.controls}
            />
            {error || status.isError ? (
              <div
                role="alert"
                className="my-2 flex items-start gap-2 rounded-lg border border-destructive/30 p-3 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{error || t.accessUnavailable}</span>
                {status.isError ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void status.refetch()}
                  >
                    {t.retry}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative min-h-0 flex-1">
            <div
              ref={transcriptRef}
              role="log"
              aria-label={t.conversation}
              className="scrollbar-thin h-full overflow-y-auto overscroll-contain"
              onScroll={(event) => {
                const el = event.currentTarget;
                transcriptScrollRef.current = el.scrollTop;
                followReplyRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                setReadingLatest(followReplyRef.current);
                if (followReplyRef.current) setNewReply(false);
              }}
            >
              <div className="mx-auto min-h-full w-full max-w-[880px] px-4 sm:px-7">
                {thread.hasNextPage ? (
                  <div className="flex justify-center py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={thread.isFetchingNextPage}
                      onClick={() => {
                        const el = transcriptRef.current;
                        if (el) {
                          olderScrollRef.current = {
                            height: el.scrollHeight,
                            top: el.scrollTop,
                          };
                          followReplyRef.current = false;
                          setReadingLatest(false);
                        }
                        void thread.fetchNextPage().catch(() => {
                          olderScrollRef.current = undefined;
                        });
                      }}
                    >
                      {d.older}
                    </Button>
                  </div>
                ) : null}
                {thread.isFetchNextPageError ? (
                  <p role="alert" className="text-xs text-warning">
                    {d.historyError}
                  </p>
                ) : null}

                {activeThreadID && thread.isLoading && !optimistic ? (
                  <p
                    role="status"
                    className="py-6 text-sm text-muted-foreground"
                  >
                    {t.loading}
                  </p>
                ) : activeThreadID && thread.isError && !messages.length ? (
                  <div role="alert" className="space-y-3 py-6 text-sm">
                    <p>{t.caseUnavailable}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void thread.refetch()}
                    >
                      {t.retry}
                    </Button>
                  </div>
                ) : displayMessages.length || investigationID ? (
                  <OperatorTranscript
                    locale={locale}
                    messages={displayMessages}
                    activeInvestigationID={investigationID}
                    investigationState={investigationState}
                    investigationEvents={investigationEvents.data?.events ?? []}
                    actions={
                      optimistic && !optimistic.investigationID
                        ? []
                        : (actions.data?.items ?? [])
                    }
                    actionsLoading={actions.isLoading}
                    actionsError={actions.isError}
                    recommendations={
                      optimistic && !optimistic.investigationID
                        ? []
                        : (recommendations.data?.items ?? [])
                    }
                    compactActions
                    onInspectActions={(id) =>
                      showSidebar('actions', {
                        evidence_for: id,
                        citations: undefined,
                      })
                    }
                    onAllActions={() =>
                      showSidebar('actions', {
                        evidence_for: investigationID,
                        citations: undefined,
                      })
                    }
                    onEvidence={(id, ids) =>
                      showSidebar('evidence', {
                        evidence_for: id ?? investigationID,
                        citations: ids?.length
                          ? JSON.stringify(ids)
                          : undefined,
                      })
                    }
                    onPrepare={(action) => void preparePlan(action)}
                    onRetry={() => {
                      const question = [...messages]
                        .reverse()
                        .find(
                          (message) =>
                            message.actor_type === 'admin' &&
                            (!investigationID ||
                              message.investigation_id === investigationID)
                        );
                      const text = messageQuestion(question);
                      if (text) focusQuestion(text);
                    }}
                    onCancelInvestigation={() => {
                      if (investigationID)
                        void mutations.cancelInvestigation.mutateAsync(
                          investigationID
                        );
                    }}
                  />
                ) : (
                  <div className="flex min-h-full items-center py-8">
                    <OperatorBriefingPanel
                      locale={locale}
                      briefing={briefing.data as OperatorBriefing | undefined}
                      loading={briefing.isLoading}
                      failed={briefing.isError}
                      onQuestion={focusQuestion}
                    />
                  </div>
                )}
                {optimistic && !optimistic.investigationID ? (
                  <p
                    role="status"
                    className="pb-4 text-xs text-muted-foreground"
                  >
                    {t.saving}
                  </p>
                ) : null}
                {planID && !planExpanded ? (
                  <div className="pb-5">
                    <Button
                      id="operator-plan-trigger"
                      size="sm"
                      variant="outline"
                      onClick={() => openPanel('plan')}
                    >
                      {t.planReview}
                    </Button>
                  </div>
                ) : null}
                {planExpanded ? (
                  <div
                    ref={inlinePlanRef}
                    className="my-5 rounded-xl border"
                    role="region"
                    aria-label={t.planReview}
                    tabIndex={-1}
                  >
                    <div className="flex items-center justify-between border-b px-4 py-2">
                      <h2 className="text-sm font-semibold">{t.planReview}</h2>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9"
                        aria-label={t.closePlan}
                        onClick={() => {
                          setPlanExpanded(false);
                          replaceParams({
                            panel: 'conversation',
                            inspector: undefined,
                          });
                          requestAnimationFrame(() =>
                            document
                              .getElementById('operator-plan-trigger')
                              ?.focus()
                          );
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <OperatorWorkspacePanel
                      locale={locale}
                      tab="plan"
                      context={visibleContext}
                      evidence={[]}
                      tasks={[]}
                      taskGroup={taskGroup}
                      taskKind={taskKind}
                      plan={plan.data}
                      planLoading={plan.isLoading}
                      planError={plan.isError}
                      planEvents={planEvents.data?.events ?? []}
                      planStale={planStale}
                      approving={mutations.approvePlan.isPending}
                      onTaskGroup={() => {}}
                      onTaskKind={() => {}}
                      onCancelTask={cancelTask}
                      onApprove={(phrase) => void approvePlan(phrase)}
                      onCancelPlan={() => {
                        if (planID)
                          void mutations.cancelPlan.mutateAsync(planID);
                      }}
                      onRefreshPlan={
                        selectedAction &&
                        plan.data &&
                        plan.data.investigation_id === investigationID &&
                        plan.data.tool_key === selectedAction.key &&
                        sameTargets(
                          selectedAction.target_ids,
                          plan.data.canonical_plan.target_ids
                        )
                          ? refreshStalePlan
                          : undefined
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {newReply ? (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-3 start-1/2 -translate-x-1/2 gap-2 rtl:translate-x-1/2"
                onClick={() => {
                  followReplyRef.current = true;
                  setReadingLatest(true);
                  if (transcriptRef.current)
                    transcriptRef.current.scrollTop =
                      transcriptRef.current.scrollHeight;
                  setNewReply(false);
                }}
              >
                <ArrowDown className="size-3.5" />
                {t.newReply}
              </Button>
            ) : null}
          </div>
          <OperatorComposer
            locale={locale}
            prompt={prompt}
            intent={intent}
            allowed={visibleContext.available_intents}
            context={visibleContext}
            onScope={chooseScope}
            onContext={() => showSidebar('context')}
            disabled={status.data?.controls.read_enabled !== true}
            busy={busy}
            working={readWorking}
            onPrompt={setPrompt}
            onIntent={(next) => replaceParams({ intent: next })}
            onSubmit={send}
          />
        </div>
      </div>
      {!desktop ? (
        <Sheet
          open={caseSheet}
          onOpenChange={(open) => {
            if (open) setCaseSheet(true);
            else closeSidebar();
          }}
        >
          <SheetContent
            side={locale === 'ar' ? 'right' : 'left'}
            hasAccessibleHeader
            aria-describedby={undefined}
            closeLabel={t.closeSidebar}
            className="flex w-[min(92vw,340px)] flex-col p-0 sm:max-w-[340px] [&>button:last-child]:hidden"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            lang={locale}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = sidebarReturnFocus.current;
              (target?.isConnected
                ? target
                : document.getElementById(
                    window.matchMedia('(min-width: 768px)').matches
                      ? 'operator-sidebar-trigger'
                      : 'operator-mobile-chat-picker'
                  )
              )?.focus();
            }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t.sidebarSections}</SheetTitle>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>
      ) : null}
      <Dialog
        open={Boolean(budgetReview)}
        onOpenChange={(open) => {
          if (!open) setBudgetReview(undefined);
        }}
      >
        <DialogContent
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t.close}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById('operator-composer-input')?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.paidTitle}</DialogTitle>
            <DialogDescription>{budgetReview?.reason}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBudgetReview(undefined)}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                const reviewed = budgetReview;
                setBudgetReview(undefined);
                if (reviewed) void sendQuestion(reviewed, true);
              }}
            >
              {t.paidContinue}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
