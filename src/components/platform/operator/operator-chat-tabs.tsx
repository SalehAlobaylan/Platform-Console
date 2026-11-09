'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useOperatorTabSummaries,
  type OperatorThread,
} from '@/hooks/use-operator';
import {
  OPERATOR_PATH,
  useWorkspaceSession,
  type OperatorTab,
  type OperatorTabRequest,
} from '@/lib/stores/workspace-session';
import {
  defaultOperatorScope,
  operatorWorkspaceScopes,
} from '@/lib/operator/route-manifest';
import {
  operatorCopy,
  lifecycleLabel,
  type OperatorLocale,
} from './operator-copy';
import { cn } from '@/lib/utils';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validID = (value: string | null) =>
  value && uuid.test(value) ? value : undefined;
export type OperatorTabControls = {
  bar: (mobileActions: ReactNode) => ReactNode;
  summary?: OperatorThread;
  openThread: (thread: OperatorThread, view?: 'history') => void;
  newChat: () => void;
  deletedThread: (id: string) => void;
  reopen: () => void;
  canReopen: boolean;
  canNew: boolean;
};

type TabStatus = {
  label: string;
  working?: boolean;
  attention?: boolean;
  unread?: boolean;
};
export function operatorTabStatus(
  tab: OperatorTab,
  request: OperatorTabRequest | undefined,
  summary: OperatorThread | undefined,
  unavailable: boolean,
  locale: OperatorLocale
): TabStatus {
  const t = operatorCopy(locale);
  if (request?.saving) return { label: t.tabSaving, working: true };
  if (request?.budgetRequired) return { label: t.tabReview, attention: true };
  if (request?.error) return { label: t.tabReview, attention: true };
  if (!tab.threadID) return { label: t.tabDraft };
  if (unavailable) return { label: t.tabUnavailable, attention: true };
  if (!summary) return { label: t.loading };
  if (summary.activity_state === 'idle' && request?.pending?.investigationID)
    return { label: t.tabQueued, working: true };
  const unread = Boolean(summary.unread_count);
  switch (summary.activity_state) {
    case 'working':
      return { label: t.tabWorking, working: true, unread };
    case 'queued':
      return { label: t.tabQueued, working: true, unread };
    case 'needs_approval':
      return { label: t.tabApproval, attention: true, unread };
    case 'needs_review':
      return { label: t.tabReview, attention: true, unread };
    case 'failed':
      return { label: t.tabFailed, attention: true, unread };
    case 'completed':
      return { label: unread ? t.tabUnread : t.tabDone, unread };
    case 'cancelled':
      return { label: lifecycleLabel('cancelled', locale), unread };
    default:
      return { label: t.tabReady, unread };
  }
}

export function OperatorTabsWorkspace({
  children,
}: {
  children: (tab: OperatorTab, controls: OperatorTabControls) => ReactNode;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    searchKey = search.toString();
  const tabs = useWorkspaceSession((state) => state.operatorTabs);
  const closed = useWorkspaceSession((state) => state.closedOperatorTabs);
  const requests = useWorkspaceSession((state) => state.operatorRequests);
  const locale = useWorkspaceSession((state) => state.locale),
    t = operatorCopy(locale);
  const initialID = useRef(crypto.randomUUID());
  const focusTabRef = useRef<string | undefined>(undefined);
  const threadID = validID(search.get('thread')),
    draftID = validID(search.get('draft'));
  const all = [...tabs, ...closed];
  const known = threadID
    ? all.find((tab) => tab.threadID === threadID)
    : draftID
      ? all.find((tab) => tab.id === draftID)
      : tabs.find((tab) => !tab.threadID);
  const active: OperatorTab = known ?? {
    id: threadID ?? draftID ?? initialID.current,
    threadID,
    href: `${OPERATOR_PATH}${searchKey ? `?${searchKey}` : ''}`,
    title: search.get('plan') ? t.planReview : t.newCase,
  };
  const summaries = useOperatorTabSummaries(
    tabs.flatMap((tab) => (tab.threadID ? [tab.threadID] : []))
  );
  const summaryByID = new Map(
    summaries.data?.items.map((item) => [item.id, item])
  );

  useEffect(() => {
    if (focusTabRef.current !== active.id) return;
    focusTabRef.current = undefined;
    const target = window.matchMedia('(min-width: 768px)').matches
      ? `operator-tab-${active.id}`
      : 'operator-mobile-chat-picker';
    (
      document.getElementById(target) ??
      document.getElementById('operator-composer-input')
    )?.focus();
  }, [active.id]);

  useEffect(() => {
    const state = useWorkspaceSession.getState();
    const tab = state.openOperatorTab(active);
    if (!tab) return;
    const params = new URLSearchParams(searchKey);
    if (
      draftID &&
      tab.threadID &&
      new URLSearchParams(tab.href.split('?')[1]).get('thread')
    ) {
      router.replace(tab.href, { scroll: false, fromPath: OPERATOR_PATH });
    } else if (!threadID && !draftID) {
      params.set('draft', tab.id);
      router.replace(`${OPERATOR_PATH}?${params}`, { scroll: false, fromPath: OPERATOR_PATH });
    } else
      state.updateOperatorTab(tab.id, {
        href: `${OPERATOR_PATH}?${searchKey}`,
      });
    // URL changes select a chat. Metadata and status refreshes never select one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, active.id]);

  useEffect(() => {
    for (const summary of summaries.data?.items ?? []) {
      const tab = useWorkspaceSession
        .getState()
        .operatorTabs.find((item) => item.threadID === summary.id);
      if (tab)
        useWorkspaceSession
          .getState()
          .updateOperatorTab(tab.id, { title: summary.title });
    }
  }, [summaries.data]);

  const select = (tab: OperatorTab, keyboard = false) => {
    if (keyboard) focusTabRef.current = tab.id;
    router.replace(tab.href, { scroll: false, fromPath: OPERATOR_PATH });
  };
  const newChat = () => {
    const scope =
      operatorWorkspaceScopes.find(
        (item) => item.domain === search.get('domain')
      ) ?? defaultOperatorScope;
    const id = crypto.randomUUID();
    const params = new URLSearchParams({
      domain: scope.domain,
      view: scope.view,
      draft: id,
    });
    const intent = search.get('intent');
    if (intent && scope.available_intents.some((value) => value === intent))
      params.set('intent', intent);
    const tab = useWorkspaceSession.getState().openOperatorTab({
      id,
      href: `${OPERATOR_PATH}?${params}`,
      title: t.newCase,
    });
    if (tab) select(tab);
  };
  const close = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    useWorkspaceSession.getState().closeOperatorTab(id);
    if (id !== active.id) return;
    const remaining = useWorkspaceSession.getState().operatorTabs;
    const next = remaining[Math.max(0, index - 1)] ?? remaining[0];
    if (next) select(next, true);
    else newChat();
  };
  const reopen = () => {
    const tab = useWorkspaceSession.getState().reopenOperatorTab();
    if (tab) select(tab);
  };
  const openThread = (thread: OperatorThread, view?: 'history') => {
    const previous = [
      ...useWorkspaceSession.getState().operatorTabs,
      ...useWorkspaceSession.getState().closedOperatorTabs,
    ].find((tab) => tab.threadID === thread.id);
    const scope =
      operatorWorkspaceScopes.find(
        (item) => item.domain === thread.last_domain
      ) ?? defaultOperatorScope;
    const params = new URLSearchParams({
      domain: scope.domain,
      view: scope.view,
      thread: thread.id,
    });
    const tab = useWorkspaceSession.getState().openOperatorTab(
      previous ?? {
        id: thread.id,
        threadID: thread.id,
        href: `${OPERATOR_PATH}?${params}`,
        title: thread.title,
      }
    );
    if (!tab) return;
    if (view === 'history') {
      const params = new URLSearchParams(tab.href.split('?')[1]);
      params.delete('detail');
      params.set('sidebar', 'history');
      params.set('panel', params.has('plan') ? 'plan' : 'conversation');
      params.delete('inspector');
      const href = `${OPERATOR_PATH}?${params}`;
      useWorkspaceSession.getState().updateOperatorTab(tab.id, { href });
      select({ ...tab, href });
    } else select(tab);
  };
  const deletedThread = (id: string) => {
    useWorkspaceSession.getState().forgetOperatorThread(id);
    if (active.threadID === id) {
      const next = useWorkspaceSession.getState().operatorTabs[0];
      if (next) select(next);
      else newChat();
    }
  };
  const models = tabs.map((tab) => ({
    tab,
    status: operatorTabStatus(
      tab,
      requests[tab.id],
      summaryByID.get(tab.threadID ?? ''),
      summaries.isError ||
        Boolean(
          tab.threadID && summaries.isSuccess && !summaryByID.has(tab.threadID)
        ),
      locale
    ),
  }));
  const bar = (mobileActions: ReactNode) => (
    <OperatorChatTabs
      locale={locale}
      tabs={models}
      activeID={active.id}
      onSelect={select}
      onClose={close}
      mobileActions={mobileActions}
    />
  );
  return children(active, {
    bar,
    newChat,
    openThread,
    deletedThread,
    reopen,
    canReopen: closed.length > 0 && tabs.length < 30,
    canNew: tabs.length < 30,
    summary: summaryByID.get(active.threadID ?? ''),
  });
}

export function OperatorChatTabs({
  locale,
  tabs,
  activeID,
  onSelect,
  onClose,
  mobileActions,
}: {
  locale: OperatorLocale;
  tabs: Array<{ tab: OperatorTab; status: TabStatus }>;
  activeID: string;
  onSelect: (tab: OperatorTab, keyboard?: boolean) => void;
  onClose: (id: string) => void;
  mobileActions?: ReactNode;
}) {
  const t = operatorCopy(locale);
  const active = tabs.find((item) => item.tab.id === activeID);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reveal = () =>
      document
        .getElementById(`operator-tab-${activeID}`)
        ?.parentElement?.scrollIntoView?.({
          block: 'nearest',
          inline: 'nearest',
        });
    reveal();
    if (!listRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reveal);
    observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [activeID]);
  const statusIcon = (status: TabStatus) =>
    status.working ? (
      <Loader2
        aria-hidden="true"
        className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
      />
    ) : status.attention ? (
      <CircleAlert
        aria-hidden="true"
        className="size-3 shrink-0 text-warning"
      />
    ) : status.unread ? (
      <CircleDot aria-hidden="true" className="size-3 shrink-0 text-info" />
    ) : null;
  return (
    <div
      className="min-w-0 flex-1 sm:flex-initial"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="hidden min-w-0 items-center md:flex">
        <div
          ref={listRef}
          role="tablist"
          aria-label={t.openChats}
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(({ tab, status }, index) => (
            <div
              key={tab.id}
              role="presentation"
              className={cn(
                'group flex h-10 w-44 shrink-0 items-center rounded-md border border-transparent transition-colors lg:w-52',
                tab.id === activeID
                  ? 'border-primary/20 bg-primary/5 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <button
                role="tab"
                id={`operator-tab-${tab.id}`}
                aria-controls={`operator-chat-${tab.id}`}
                aria-selected={tab.id === activeID}
                title={`${tab.title} · ${status.label}`}
                tabIndex={tab.id === activeID ? 0 : -1}
                className="flex h-full min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-s-lg px-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onSelect(tab, true)}
                onKeyDown={(event) => {
                  const forward = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight',
                    backward = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft';
                  const next =
                    event.key === forward
                      ? (index + 1) % tabs.length
                      : event.key === backward
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : undefined;
                  if (next !== undefined) {
                    event.preventDefault();
                    onSelect(tabs[next].tab, true);
                  }
                  if (event.key === 'Delete') {
                    event.preventDefault();
                    onClose(tab.id);
                  }
                }}
              >
                <span
                  className="w-full truncate text-xs font-medium leading-4"
                  dir="auto"
                >
                  {tab.title}
                </span>
                <span className="flex w-full items-center gap-1.5 truncate text-[10px] leading-3 text-muted-foreground">
                  {statusIcon(status)}
                  {status.label}
                </span>
              </button>
              <button
                type="button"
                aria-label={`${t.closeTab}: ${tab.title}`}
                title={t.closeTabHint}
                tabIndex={tab.id === activeID ? 0 : -1}
                className="me-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onClose(tab.id)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 md:hidden">
        <DropdownMenu dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 w-full min-w-0 justify-start gap-1.5 rounded-md px-1 text-xs text-muted-foreground sm:px-2"
              aria-label={`${t.openChats} (${tabs.length})`}
              id="operator-mobile-chat-picker"
              title={
                active
                  ? `${active.tab.title} · ${active.status.label}`
                  : t.openChats
              }
            >
              <span className="font-medium text-foreground">{t.cases}</span>
              {active ? (
                <span className="hidden min-[360px]:flex">
                  {statusIcon(active.status)}
                </span>
              ) : null}
              <span className="hidden shrink-0 text-[10px] leading-5 min-[360px]:inline">
                {tabs.length}
              </span>
              <ChevronDown className="size-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="flex max-h-[min(600px,calc(100dvh-80px))] w-[min(340px,calc(100vw-24px))] flex-col overflow-y-auto"
          >
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t.openChats}
            </DropdownMenuLabel>
            <div className="min-h-24 overflow-y-auto">
              {tabs.map(({ tab, status }) => (
                <DropdownMenuItem
                  key={tab.id}
                  className="gap-2"
                  onSelect={() => onSelect(tab, true)}
                >
                  {statusIcon(status)}
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {tab.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {status.label}
                  </span>
                  {tab.id === activeID ? <Check className="size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            {mobileActions}
            {mobileActions ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => onClose(activeID)}>
              <X className="me-2 size-3.5" />
              {t.closeTab}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
