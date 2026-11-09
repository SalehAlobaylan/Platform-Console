'use client';

import Link from '@/lib/console-link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Check,
  CircleDot,
  Clock3,
  ExternalLink,
  FileSearch,
  Inbox,
  Layers,
  Loader2,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { operatorWorkspaceScopes } from '@/lib/operator/route-manifest';
import type {
  OperatorIntent,
  OperatorVisibleContext,
} from '@/types/platform/operator';
import type {
  OperatorAction,
  OperatorPlan,
  OperatorTask,
  OperatorTaskGroup,
  OperatorTaskKind,
  OperatorThread,
} from '@/hooks/use-operator';
import {
  actionLabel,
  lifecycleLabel,
  operatorCopy,
  operatorDomainLabel,
  type OperatorLocale,
} from './operator-copy';

import { operatorDetailsCopy } from './operator-details-copy';
import { OperatorIntentSelect } from './operator-intent-select';
import { OperatorScopeSelect } from './operator-conversation-chrome';
import {
  OperatorActionGroups,
  type OperatorActionRecommendation,
} from './operator-action-groups';
import {
  OperatorAnswer,
  operatorResponseBlocks as responseBlocks,
} from './operator-answer';

export type OperatorMessage = {
  id: string;
  kind: string;
  actor_type: 'admin' | 'operator' | 'system';
  created_at: string;
  content: unknown;
  investigation_id?: string;
  plan_id?: string;
};
export type OperatorEvidence = {
  id: string;
  evidence_id: string;
  authority: string;
  domain: string;
  adapter_key: string;
  adapter_version: string;
  required_permission: string;
  record_refs?: unknown;
  deep_link: string;
  observed_at: string;
  fetched_at: string;
  expires_at: string;
  availability: string;
  source_version: string;
};
export type OperatorBriefing = {
  generated_at: string;
  headline: string;
  items: Array<{
    id: string;
    domain: string;
    kind: string;
    severity: string;
    title: string;
    summary: string;
    deep_link?: string;
  }>;
  suggested_questions: Array<{ intent: OperatorIntent; text: string }>;
};
export type OperatorControls = {
  controls?: {
    read_enabled: boolean;
    llm_enabled: boolean;
    execution_enabled: boolean;
    schedules_enabled: boolean;
    adapters?: Array<{
      disabled?: boolean;
      reason?: string;
      expires_at?: string | null;
      capability_key?: string;
    }>;
  };
  spend?: { interactive: boolean; scheduled_hard_stop: boolean };
};
export type OperatorWorkspaceView =
  | 'conversation'
  | 'evidence'
  | 'tasks'
  | 'plan'
  | 'governance';

export function formatOperatorTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
}

function stateVariant(state: string): BadgeProps['variant'] {
  if (['available', 'succeeded', 'completed', 'done'].includes(state))
    return 'success';
  if (['failed', 'blocked'].includes(state)) return 'destructive';
  if (
    [
      'awaiting_approval',
      'paused',
      'stale',
      'partial',
      'unavailable',
      'conflicting',
    ].includes(state)
  )
    return 'warning';
  if (
    [
      'running',
      'queued',
      'claimed',
      'accepted',
      'backgrounded',
      'verifying',
      'active',
    ].includes(state)
  )
    return 'info';
  return 'secondary';
}

function taskHref(task: OperatorTask) {
  const scope = operatorWorkspaceScopes.find(
    (item) => item.domain === task.domain
  );
  if (!scope || !task.deep_link.startsWith('/platform/operator?'))
    return task.deep_link;
  const params = new URLSearchParams(task.deep_link.split('?')[1]);
  params.set('domain', scope.domain);
  params.set('view', scope.view);
  return `/platform/operator?${params.toString()}`;
}

export function OperatorCaseRail({
  locale,
  threads,
  activeID,
  mode,
  query,
  loading,
  onMode,
  onQuery,
  onSelect,
  onPatch,
  onDelete,
  embedded = false,
  error,
  onRetry,
  hasMore,
  fetchingMore,
  onMore,
}: {
  locale: OperatorLocale;
  threads: OperatorThread[];
  activeID?: string;
  mode: 'recent' | 'pinned' | 'archived';
  query: string;
  loading: boolean;
  embedded?: boolean;
  error?: boolean;
  onRetry?: () => void;
  hasMore?: boolean;
  fetchingMore?: boolean;
  onMore?: () => void;
  onMode: (mode: 'recent' | 'pinned' | 'archived') => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onPatch: (
    thread: OperatorThread,
    patch: { title?: string; pinned?: boolean; archived?: boolean }
  ) => void;
  onDelete: (id: string) => void;
}) {
  const t = operatorCopy(locale);
  const d = operatorDetailsCopy(locale);
  const [renameThread, setRenameThread] = useState<OperatorThread>();
  const [name, setName] = useState('');
  const [deleteThread, setDeleteThread] = useState<OperatorThread>();
  return (
    <>
      <Card
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden shadow-none',
          embedded && 'rounded-none border-0 bg-transparent'
        )}
      >
        <CardHeader className="space-y-3 p-4 pb-3">
          {!embedded ? (
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.cases}</CardTitle>
            </div>
          ) : null}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              className="ps-9"
              placeholder={t.searchCases}
              aria-label={t.searchCases}
            />
          </div>
        </CardHeader>
        <div className="px-3 pb-2">
          <DropdownMenu dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-1 text-xs text-muted-foreground"
                aria-label={d.chatFilter}
              >
                {t[mode]}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(['recent', 'pinned', 'archived'] as const).map((value) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => onMode(value)}
                  className="gap-2"
                >
                  <span className="flex-1">{t[value]}</span>
                  {mode === value ? <Check className="size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 divide-y overflow-y-auto">
          {error ? (
            <div role="alert" className="space-y-3 p-4 text-sm">
              <p>{d.historyError}</p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                {d.retry}
              </Button>
            </div>
          ) : null}
          {loading && !threads.length ? (
            <div className="p-4 text-xs text-muted-foreground">{t.loading}</div>
          ) : threads.length ? (
            threads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  'relative flex items-start gap-2 p-3 transition-colors hover:bg-muted/50',
                  activeID === thread.id &&
                    'bg-primary/5 before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary'
                )}
              >
                <button
                  className="min-w-0 flex-1 rounded-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-current={activeID === thread.id ? 'page' : undefined}
                  onClick={() => onSelect(thread.id)}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {thread.title}
                    </span>
                    {(thread.unread_count ?? 0) > 0 ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-info" />
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {thread.last_domain ? (
                      <span>
                        {operatorDomainLabel(thread.last_domain, locale)}
                      </span>
                    ) : null}
                    {thread.last_state ? (
                      <Badge
                        variant={stateVariant(thread.last_state)}
                        className="px-1.5 py-0 text-[9px]"
                      >
                        {lifecycleLabel(thread.last_state, locale)}
                      </Badge>
                    ) : null}
                    <span>{formatOperatorTime(thread.last_activity_at)}</span>
                    <span>{thread.locale === 'ar' ? 'AR' : 'EN'}</span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`${t.chatMenu}: ${thread.title}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameThread(thread);
                        setName(thread.title);
                      }}
                    >
                      {d.rename}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onPatch(thread, { pinned: !thread.pinned_at })
                      }
                    >
                      <Pin className="me-2 size-4" />
                      {thread.pinned_at ? t.unpin : t.pin}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onPatch(thread, { archived: !thread.archived_at })
                      }
                    >
                      <Archive className="me-2 size-4" />
                      {thread.archived_at ? t.restore : t.archive}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteThread(thread)}
                    >
                      <Trash2 className="me-2 size-4" />
                      {t.deleteCase}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 p-5 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t.noCases}</p>
            </div>
          )}
          {hasMore ? (
            <Button
              size="sm"
              variant="outline"
              className="m-3 shrink-0"
              onClick={onMore}
              disabled={fetchingMore}
            >
              {fetchingMore ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {d.more}
            </Button>
          ) : null}
        </div>
      </Card>
      <Dialog
        open={Boolean(renameThread)}
        onOpenChange={(open) => {
          if (!open) setRenameThread(undefined);
        }}
      >
        <DialogContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{d.rename}</DialogTitle>
            <DialogDescription>{d.name}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (renameThread && name.trim()) {
                onPatch(renameThread, { title: name.trim() });
                setRenameThread(undefined);
              }
            }}
          >
            <label htmlFor="operator-chat-name" className="text-xs">
              {d.name}
            </label>
            <Input
              id="operator-chat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={240}
              className="mt-2"
            />
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={!name.trim()}>
                {d.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteThread)}
        onOpenChange={(open) => {
          if (!open) setDeleteThread(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>{t.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteThread(undefined)}
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteThread) onDelete(deleteThread.id);
                setDeleteThread(undefined);
              }}
            >
              {t.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OperatorBriefingPanel({
  locale,
  briefing,
  loading,
  failed,
  onQuestion,
}: {
  locale: OperatorLocale;
  briefing?: OperatorBriefing;
  loading: boolean;
  failed?: boolean;
  onQuestion: (text: string, intent: OperatorIntent) => void;
}) {
  const t = operatorCopy(locale);
  const questions = briefing?.suggested_questions.length
    ? briefing.suggested_questions.slice(0, 3)
    : [
        {
          intent: 'investigate' as const,
          text:
            locale === 'ar'
              ? 'ما الذي يحتاج انتباهي هنا؟'
              : 'What needs my attention here?',
        },
        {
          intent: 'explain' as const,
          text:
            locale === 'ar'
              ? 'اشرح حالة النظام الحالية.'
              : 'Explain the current system status.',
        },
        {
          intent: 'recommend' as const,
          text:
            locale === 'ar'
              ? 'ما الخطوة الآمنة التالية؟'
              : 'What is a safe next step?',
        },
      ];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-5 sm:px-8 sm:py-8">
      <div>
        <Bot className="mb-3 size-6 text-primary" />
        <h2 className="text-xl font-semibold">{t.welcome}</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          {t.welcomeDescription}
        </p>
      </div>
      <div className="divide-y border-y">
        {questions.map((question) => (
          <button
            key={question.text}
            type="button"
            onClick={() => onQuestion(question.text, question.intent)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-sm py-3 text-start text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            dir="auto"
          >
            {question.text}
            <ChevronRight className="size-4 shrink-0 rtl:rotate-180" />
          </button>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t.currentBriefing}
          {loading ? ` · ${t.loading}` : ''}
        </summary>
        <div className="mt-3 space-y-3">
          {failed ? (
            <p className="text-xs text-warning">{t.unavailable}</p>
          ) : (
            <p className="text-sm font-medium" dir="auto">
              {briefing?.headline ?? (loading ? t.loading : t.noBriefing)}
            </p>
          )}
          {briefing?.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 border-t pt-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium" dir="auto">
                  {item.title.replaceAll('_', ' ')}
                </p>
                <p
                  className="mt-1 text-xs leading-5 text-muted-foreground"
                  dir="auto"
                >
                  {item.summary.replaceAll('_', ' ')}
                </p>
              </div>
              {item.deep_link ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                >
                  <Link href={item.deep_link} aria-label={t.openRecord}>
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          ))}
          {briefing?.generated_at ? (
            <p className="text-xs text-muted-foreground">
              {t.refreshed} {formatOperatorTime(briefing.generated_at)}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function messageText(content: unknown) {
  return content &&
    typeof content === 'object' &&
    'text' in content &&
    typeof (content as { text?: unknown }).text === 'string'
    ? (content as { text: string }).text
    : '';
}

export function OperatorTranscript({
  locale,
  messages,
  activeInvestigationID,
  investigationState,
  investigationEvents,
  actions,
  actionsLoading,
  actionsError,
  recommendations,
  onEvidence,
  onPrepare,
  onCancelInvestigation,
  onRetry,
  compactActions = false,
  onAllActions,
  onInspectActions,
}: {
  locale: OperatorLocale;
  messages: OperatorMessage[];
  activeInvestigationID?: string;
  investigationState?: string;
  investigationEvents: Array<{ sequence: number; event_type: string }>;
  actions: OperatorAction[];
  actionsLoading?: boolean;
  actionsError?: boolean;
  recommendations: OperatorActionRecommendation[];
  onEvidence: (investigationID?: string, evidenceIDs?: string[]) => void;
  onPrepare: (action: Extract<OperatorAction, { kind: 'plan' }>) => void;
  onCancelInvestigation: () => void;
  onRetry?: () => void;
  compactActions?: boolean;
  onAllActions?: () => void;
  onInspectActions?: (investigationID: string) => void;
}) {
  const t = operatorCopy(locale);
  const responseMessages = messages.filter(
    (message) => message.actor_type !== 'system' || message.kind !== 'plan'
  );
  const latestReply = [...responseMessages]
    .reverse()
    .find(
      (message) =>
        message.actor_type === 'operator' &&
        (!activeInvestigationID ||
          message.investigation_id === activeInvestigationID)
    );
  const latestBlocks = responseBlocks(latestReply?.content);
  const conversationOnly =
    latestBlocks.length > 0 &&
    latestBlocks.every((block) => block.kind === 'message');
  return (
    <div className="space-y-8 py-5 sm:py-8">
      {responseMessages.map((message) => {
        const blocks = responseBlocks(message.content);
        const text = messageText(message.content);
        const isAdmin = message.actor_type === 'admin';
        return (
          <section
            key={message.id}
            id={
              isAdmin && message.investigation_id
                ? `operator-message-${message.investigation_id}`
                : undefined
            }
            className={cn(
              'min-w-0',
              isAdmin && 'ms-auto max-w-[90%] rounded-2xl bg-muted px-4 py-3'
            )}
          >
            {!isAdmin ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Bot className="size-3.5" />
                  {t.title}
                  <span>·</span>
                  {formatOperatorTime(message.created_at)}
                </span>
                <div className="flex items-center gap-3">
                  {message.investigation_id &&
                  message.investigation_id !== activeInvestigationID &&
                  blocks.some((block) => block.kind !== 'message') &&
                  onInspectActions ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        onInspectActions(message.investigation_id!)
                      }
                    >
                      {t.groupedActions}
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 rtl:rotate-180"
                      />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {text ? (
              <p
                className="whitespace-pre-wrap break-words text-[15px] leading-7"
                dir="auto"
              >
                {text}
              </p>
            ) : null}
            {blocks.length ? (
              <OperatorAnswer
                content={message.content}
                comfortable
                locale={locale}
                onEvidence={(ids) => onEvidence(message.investigation_id, ids)}
              />
            ) : null}
          </section>
        );
      })}
      {activeInvestigationID &&
      investigationState &&
      !['completed', 'failed', 'cancelled'].includes(investigationState) ? (
        <section
          className="space-y-3 p-4 sm:p-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-info" />
              <div>
                <p className="text-sm font-medium">
                  {lifecycleLabel(
                    investigationEvents.at(-1)?.event_type ??
                      investigationState,
                    locale
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.questionSaved}
                </p>
              </div>
            </div>
            {['accepted', 'backgrounded'].includes(investigationState) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelInvestigation}
              >
                {t.cancelTask}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {investigationEvents.slice(-5).map((event) => (
              <Badge variant="outline" key={event.sequence}>
                <CircleDot className="me-1 size-3" />
                {lifecycleLabel(event.event_type, locale)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
      {['failed', 'cancelled'].includes(investigationState ?? '') ? (
        <section
          className="m-4 rounded-lg border border-warning/40 bg-warning/5 p-4 sm:m-5"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <h3 className="text-sm font-medium">
                {investigationState === 'failed'
                  ? t.failedQuestion
                  : t.cancelledQuestion}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t.failedHelp}
              </p>
              {onRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onRetry}
                >
                  {t.reviewQuestion}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      <OperatorActionGroups
        locale={locale}
        actions={actions}
        recommendations={recommendations}
        onPrepare={onPrepare}
        compact={compactActions}
        onAllActions={onAllActions}
      />
      {!actions.length &&
      investigationState === 'completed' &&
      !conversationOnly &&
      (actionsError || actionsLoading || !recommendations.length) ? (
        <section className="p-4 sm:p-5">
          <p
            className="text-xs text-muted-foreground"
            role={actionsError ? 'alert' : undefined}
          >
            {actionsError
              ? t.actionsUnavailable
              : actionsLoading
                ? t.loading
                : t.noActions}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function OperatorComposer({
  locale,
  prompt,
  intent,
  allowed,
  disabled,
  busy,
  onPrompt,
  onIntent,
  onSubmit,
  context,
  onScope,
  onContext,
  working = false,
}: {
  context?: OperatorVisibleContext;
  onScope?: (domain: string) => void;
  onContext?: () => void;
  working?: boolean;
  locale: OperatorLocale;
  prompt: string;
  intent: OperatorIntent;
  allowed: OperatorIntent[];
  disabled: boolean;
  busy: boolean;
  onPrompt: (value: string) => void;
  onIntent: (intent: OperatorIntent) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const t = operatorCopy(locale);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedCount = context
    ? (context.selection?.count ??
      context.subjects.filter((subject) => subject.type !== 'tenant').length)
    : 0;
  const hasContext = Boolean(
    selectedCount ||
    context?.draft ||
    (context && Object.keys(context.filters).length)
  );
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = 'auto';
      input.style.height = `${Math.min(160, Math.max(64, input.scrollHeight))}px`;
    }
  }, [prompt]);
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-[880px] shrink-0 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-5"
    >
      <div className="rounded-2xl border bg-background p-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
        <Textarea
          id="operator-composer-input"
          ref={inputRef}
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!busy && !disabled && !working && prompt.trim())
                event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={t.placeholder}
          disabled={disabled || busy}
          maxLength={8000}
          rows={2}
          className="max-h-40 min-h-16 resize-none border-0 bg-transparent p-1 text-base leading-7 shadow-none focus-visible:ring-0 sm:text-[15px]"
          placeholder={t.placeholder}
          dir="auto"
        />
        <div
          className={cn(
            'mt-2 items-center gap-1',
            context
              ? 'grid grid-cols-[minmax(80px,auto)_minmax(0,1fr)_auto_36px] sm:flex'
              : 'flex justify-between'
          )}
        >
          <OperatorIntentSelect
            compact={Boolean(context)}
            locale={locale}
            value={intent}
            allowed={allowed}
            disabled={disabled || busy}
            onChange={onIntent}
          />
          {context && onScope ? (
            <OperatorScopeSelect
              locale={locale}
              context={context}
              onScope={onScope}
              disabled={disabled || busy}
            />
          ) : null}
          {context ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 shrink-0 gap-1.5 px-2 text-xs"
              aria-label={t.context}
              title={t.context}
              onClick={onContext}
            >
              <Layers aria-hidden="true" className="hidden size-4 sm:block" />
              <span>{t.contextButton}</span>
              {hasContext ? (
                <span
                  aria-hidden="true"
                  className="min-w-4 rounded bg-muted px-1 text-[10px] leading-4 text-muted-foreground"
                >
                  {selectedCount
                    ? selectedCount > 99
                      ? '99+'
                      : selectedCount
                    : '•'}
                </span>
              ) : null}
              {selectedCount ? (
                <span className="sr-only">
                  {selectedCount} {t.selectedRecords}
                </span>
              ) : null}
            </Button>
          ) : null}
          {busy ? (
            <span role="status" className="sr-only">
              {t.saving}
            </span>
          ) : null}
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-full sm:ms-auto"
            disabled={disabled || busy || working || !prompt.trim()}
            aria-label={t.send}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
        {working ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {t.followUpWaiting}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function OperatorPlanPanel({
  locale,
  plan,
  events,
  stale,
  approving,
  onApprove,
  onCancel,
  onRefresh,
}: {
  locale: OperatorLocale;
  plan?: OperatorPlan;
  events: Array<{ sequence: number; event_type: string; created_at: string }>;
  stale: boolean;
  approving: boolean;
  onApprove: (phrase: string) => void;
  onCancel: () => void;
  onRefresh?: () => void;
}) {
  const t = operatorCopy(locale);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  if (!plan) return <EmptyPanel icon={ShieldCheck} text={t.emptyPlan} />;
  const label = plan.localized_action_key
    ? actionLabel(plan.localized_action_key, locale)
    : undefined;
  const high = plan.risk_tier === 'high_impact';
  const expected =
    plan.confirmation_phrases?.[locale === 'ar' ? 1 : 0] ??
    (locale === 'ar' ? 'أوافق' : 'APPROVE');
  const cancellable = ['awaiting_approval', 'queued'].includes(plan.state);
  const expired =
    plan.state === 'awaiting_approval' &&
    Date.parse(plan.expires_at) <= Date.now();
  const previewStale = stale || expired;
  const effectKeys = (['before', 'after', 'verified'] as const).filter(
    (key) =>
      plan.verified_effects?.[key] !== null &&
      plan.verified_effects?.[key] !== undefined
  );
  const proof = plan.verified_effects?.verified;
  const hasProof =
    plan.state === 'succeeded' &&
    (proof === true ||
      (typeof proof === 'object' &&
        proof !== null &&
        Object.keys(proof).length > 0));
  const rollback = plan.canonical_plan.rollback;
  const rollbackText = /^(sources|media_sources)\.resume$/.test(rollback)
    ? t.resumeSource
    : /^(sources|media_sources)\.pause$/.test(rollback)
      ? t.pauseSource
      : rollback === 'not_required_idempotent_refresh'
        ? t.repeatableRollback
        : rollback;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{label ?? t.unavailable}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.target_type?.replaceAll('_', ' ') ?? t.target}
          </p>
        </div>
        <Badge variant={previewStale ? 'warning' : stateVariant(plan.state)}>
          {expired
            ? t.expiredPreview
            : stale
              ? t.stale
              : lifecycleLabel(plan.state, locale)}
        </Badge>
      </div>
      {previewStale ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs">
          <p>{t.stalePlan}</p>
          {onRefresh ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onRefresh}
            >
              <RefreshCw className="size-3.5" />
              {t.freshPlan}
            </Button>
          ) : (
            <p className="mt-2 leading-5">{t.freshEvidenceRequired}</p>
          )}
        </div>
      ) : null}
      {plan.state === 'awaiting_approval' ? (
        <p className="border-s-2 border-info ps-3 text-sm leading-6">
          {t.approvalPending}
        </p>
      ) : null}
      <dl className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Detail label={t.target}>
            <bdi className="break-all font-mono">
              {plan.canonical_plan.target_ids.join(', ')}
            </bdi>
          </Detail>
        </div>
        <Detail label={t.affected}>
          {(plan.affected_domains ?? [])
            .map((domain) => operatorDomainLabel(domain, locale))
            .join(', ') || '—'}
        </Detail>
        <Detail label={t.cancellation}>
          {plan.canonical_plan.cancellation === 'before_start_only'
            ? t.cancelBeforeStart
            : plan.canonical_plan.cancellation === 'none'
              ? t.noCancellation
              : plan.canonical_plan.cancellation}
        </Detail>
        <div className="sm:col-span-2">
          <Detail label={t.rollback}>{rollbackText}</Detail>
        </div>
        <div className="sm:col-span-2">
          <Detail label={t.contingencies}>
            <ul className="list-inside list-disc space-y-1">
              {plan.canonical_plan.contingencies.map((item) => (
                <li key={item}>
                  {item ===
                  'source_missing_or_category_changed:stop_and_record_failure'
                    ? t.sourceGuardrail
                    : item === 'verification_failed:stop_and_record_failure'
                      ? t.verificationGuardrail
                      : item}
                </li>
              ))}
            </ul>
          </Detail>
        </div>
      </dl>
      <details className="border-t pt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">
          {t.planTechnicalDetails}
        </summary>
        <dl className="mt-3 space-y-3">
          <Detail label="Digest">
            <bdi className="break-all font-mono">{plan.digest}</bdi>
          </Detail>
          <Detail label={t.cancellation}>
            <bdi>{plan.canonical_plan.cancellation}</bdi>
          </Detail>
          <Detail label={t.rollback}>
            <bdi>{rollback}</bdi>
          </Detail>
          <Detail label={t.contingencies}>
            <ul className="space-y-1 font-mono text-xs">
              {plan.canonical_plan.contingencies.map((item) => (
                <li key={item}>
                  <bdi>{item}</bdi>
                </li>
              ))}
            </ul>
          </Detail>
        </dl>
      </details>
      {events.length ? (
        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-medium">
            {locale === 'ar' ? 'مسار التنفيذ' : 'Execution trail'}
          </p>
          <div className="space-y-2">
            {events.slice(-8).map((event) => (
              <div
                key={event.sequence}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2">
                  <CircleDot className="size-3 text-muted-foreground" />
                  {lifecycleLabel(event.event_type, locale)}
                </span>
                <span className="text-muted-foreground">
                  {formatOperatorTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {effectKeys.length > 0 ? (
        <section className="space-y-3 border-t pt-4">
          <h3
            className={cn(
              'flex items-center gap-2 text-sm font-semibold',
              hasProof && 'text-success'
            )}
          >
            {hasProof ? <CheckCircle2 className="size-4" /> : null}
            {hasProof ? t.proof : t.recordedResults}
          </h3>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              {t.verificationDetails}
            </summary>
            <div className="mt-3 space-y-3">
              {effectKeys.map((key) => (
                <Detail
                  key={key}
                  label={
                    key === 'before'
                      ? t.before
                      : key === 'after'
                        ? t.after
                        : hasProof
                          ? t.proof
                          : t.verificationDetails
                  }
                >
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(plan.verified_effects?.[key], null, 2)}
                  </pre>
                </Detail>
              ))}
            </div>
          </details>
          {plan.verified_effects?.deep_links?.map((href) => (
            <Button asChild key={href} variant="outline" size="sm">
              <Link href={href}>
                {t.openRecord}
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          ))}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {plan.state === 'awaiting_approval' && !previewStale && label ? (
          <Button
            size="sm"
            onClick={() => {
              setPhrase(high ? '' : expected);
              setConfirmOpen(true);
            }}
          >
            {high ? t.approveHigh : t.approve}
          </Button>
        ) : null}
        {cancellable ? (
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t.cancelPlan}
          </Button>
        ) : null}
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t.close}
        >
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{high ? t.approveHigh : t.approve}</DialogTitle>
            <DialogDescription>
              {label}.{' '}
              {high
                ? t.typePhrase
                : `${t.target}: ${plan.canonical_plan.target_ids.join(', ')}`}
            </DialogDescription>
          </DialogHeader>
          {high ? (
            <div>
              <label
                htmlFor="operator-plan-approval"
                className="text-xs font-medium"
              >
                {t.typePhrase}
              </label>
              <Input
                id="operator-plan-approval"
                className="mt-2"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder={expected}
                dir="ltr"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              disabled={approving || phrase !== expected || previewStale}
              onClick={() => {
                if (previewStale) return;
                onApprove(phrase);
                setConfirmOpen(false);
              }}
            >
              {approving ? <Loader2 className="size-4 animate-spin" /> : null}
              {high ? t.approveHigh : t.approve}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm leading-6">{children}</dd>
    </div>
  );
}
function EmptyPanel({
  icon: Icon,
  text,
}: {
  icon: typeof FileSearch;
  text: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-5 text-center">
      <Icon className="size-6 text-muted-foreground" />
      <p className="max-w-56 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

export function OperatorWorkspacePanel({
  locale,
  compact = false,
  tab,
  context,
  question,
  evidence,
  evidenceLoading,
  evidenceError,
  tasks,
  tasksLoading,
  tasksError,
  taskGroup,
  taskKind,
  controls,
  controlsLoading,
  controlsError,
  plan,
  planLoading,
  planError,
  planEvents,
  planStale,
  approving,
  onTaskGroup,
  onTaskKind,
  onCancelTask,
  onApprove,
  onCancelPlan,
  onRefreshPlan,
}: {
  compact?: boolean;
  locale: OperatorLocale;
  tab: Exclude<OperatorWorkspaceView, 'conversation'>;
  context: OperatorVisibleContext;
  question?: string;
  evidence: OperatorEvidence[];
  evidenceLoading?: boolean;
  evidenceError?: boolean;
  tasks: OperatorTask[];
  tasksLoading?: boolean;
  tasksError?: boolean;
  taskGroup: OperatorTaskGroup;
  taskKind: OperatorTaskKind;
  controls?: OperatorControls;
  controlsLoading?: boolean;
  controlsError?: boolean;
  plan?: OperatorPlan;
  planLoading?: boolean;
  planError?: boolean;
  planEvents: Array<{
    sequence: number;
    event_type: string;
    created_at: string;
  }>;
  planStale: boolean;
  approving: boolean;
  onTaskGroup: (group: OperatorTaskGroup) => void;
  onTaskKind: (kind: OperatorTaskKind) => void;
  onCancelTask: (task: OperatorTask) => void;
  onApprove: (phrase: string) => void;
  onCancelPlan: () => void;
  onRefreshPlan?: () => void;
}) {
  const t = operatorCopy(locale);
  if (tab === 'evidence')
    return (
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t.evidenceDescription}
        </p>
        {question ? (
          <blockquote
            className="border-s-2 ps-4 text-sm font-medium leading-6"
            dir="auto"
          >
            {question}
          </blockquote>
        ) : null}
        {evidenceError ? (
          <p role="alert" className="text-sm text-warning">
            {t.unavailable}
          </p>
        ) : evidence.length ? (
          <div className={cn('grid gap-3', !compact && 'md:grid-cols-2')}>
            {evidence.map((item) => {
              const expired = Date.parse(item.expires_at) <= Date.now();
              const availability =
                expired && ['available', 'partial'].includes(item.availability)
                  ? 'stale'
                  : item.availability;
              const sourceName = item.evidence_id.includes(':')
                ? item.evidence_id.split(':')[0].replaceAll('_', ' ')
                : operatorDomainLabel(item.domain, locale);
              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className="break-words text-sm font-semibold"
                        dir="auto"
                      >
                        {sourceName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {operatorDomainLabel(item.domain, locale)}
                      </p>
                    </div>
                    <Badge variant={stateVariant(availability)}>
                      {t.evidenceStates[
                        availability as keyof typeof t.evidenceStates
                      ] ?? t.unavailable}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Detail label={t.observed}>
                      {formatOperatorTime(item.observed_at)}
                    </Detail>
                    <Detail label={t.expires}>
                      {formatOperatorTime(item.expires_at)}
                    </Detail>
                  </dl>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Link href={item.deep_link}>
                        {t.openRecord}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                    <details className="w-full text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">
                        {t.sourceDetails}
                      </summary>
                      <dl className="mt-3 space-y-3">
                        <Detail label={t.evidence}>
                          <bdi className="break-all font-mono">
                            {item.evidence_id}
                          </bdi>
                        </Detail>
                        <Detail label={t.recordedAvailability}>
                          {t.evidenceStates[
                            item.availability as keyof typeof t.evidenceStates
                          ] ?? t.unavailable}
                        </Detail>
                        <Detail label={t.authority}>{item.authority}</Detail>
                        <Detail label="Adapter">
                          <bdi>{item.adapter_key}</bdi>
                        </Detail>
                      </dl>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyPanel
            icon={FileSearch}
            text={evidenceLoading ? t.loading : t.emptyEvidence}
          />
        )}
      </div>
    );
  if (tab === 'tasks')
    return (
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div
          className={cn(
            'flex flex-col justify-between gap-4',
            !compact && 'sm:flex-row sm:items-center'
          )}
        >
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {t.activityDescription}
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <Select
              value={taskGroup}
              onValueChange={(value) => onTaskGroup(value as OperatorTaskGroup)}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              <SelectTrigger className="h-9 min-w-32" aria-label={t.taskStatus}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(t.groups).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={taskKind}
              onValueChange={(value) => onTaskKind(value as OperatorTaskKind)}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              <SelectTrigger className="h-9 min-w-32" aria-label={t.taskType}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(t.kinds).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {tasksError ? (
          <p role="alert" className="text-sm text-warning">
            {t.unavailable}
          </p>
        ) : tasks.length ? (
          <div className="divide-y border-y">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <Link
                    href={taskHref(task)}
                    className="block text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    dir="auto"
                  >
                    {(task.kind === 'plan'
                      ? actionLabel(
                          `operator.action.${task.title.replaceAll('.', '_')}`,
                          locale
                        )
                      : undefined) ?? task.title.replaceAll('_', ' ')}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.kinds[task.kind]} · {formatOperatorTime(task.updated_at)}
                  </p>
                </div>
                <Badge variant={stateVariant(task.state)}>
                  {lifecycleLabel(task.state, locale)}
                </Badge>
                {task.can_cancel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCancelTask(task)}
                  >
                    {t.cancelTask}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel
            icon={Inbox}
            text={tasksLoading ? t.loading : t.emptyTasks}
          />
        )}
      </div>
    );
  if (tab === 'plan')
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <p className="text-sm leading-6 text-muted-foreground">
          {t.planDescription}
        </p>
        {planError ? (
          <p role="alert" className="text-sm text-warning">
            {t.unavailable}
          </p>
        ) : planLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t.loading}
          </p>
        ) : (
          <OperatorPlanPanel
            locale={locale}
            plan={plan}
            events={planEvents}
            stale={planStale}
            approving={approving}
            onApprove={onApprove}
            onCancel={onCancelPlan}
            onRefresh={onRefreshPlan}
          />
        )}
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        {t.controlsDescription}
      </p>
      {controlsError ? (
        <p role="alert" className="text-sm text-warning">
          {t.unavailable}
        </p>
      ) : controlsLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t.loading}
        </p>
      ) : (
        <div className="divide-y border-y">
          {Object.entries({
            read_enabled: controls?.controls?.read_enabled,
            llm_enabled: controls?.controls?.llm_enabled,
            execution_enabled: controls?.controls?.execution_enabled,
            schedules_enabled: controls?.controls?.schedules_enabled,
          }).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-4 text-sm"
            >
              <span>
                {t.capabilityNames[key as keyof typeof t.capabilityNames] ??
                  key}
              </span>
              <Badge
                variant={
                  enabled === true
                    ? 'success'
                    : enabled === false
                      ? 'warning'
                      : 'secondary'
                }
              >
                {enabled === true
                  ? t.enabled
                  : enabled === false
                    ? t.disabled
                    : t.unavailable}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t.currentContext}</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label={t.scope}>
            {operatorDomainLabel(context.domain, locale)}
          </Detail>
          <Detail label={t.context}>
            <bdi>{context.view}</bdi>
          </Detail>
        </dl>
        {context.subjects.filter((subject) => subject.type !== 'tenant')
          .length > 0 ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t.selectedRecords}</summary>
            <div className="mt-2 space-y-1">
              {context.subjects
                .filter((subject) => subject.type !== 'tenant')
                .map((subject) => (
                  <bdi
                    className="block break-all font-mono"
                    key={`${subject.type}:${subject.id}`}
                  >
                    {subject.label ?? `${subject.type}:${subject.id}`}
                  </bdi>
                ))}
            </div>
          </details>
        ) : null}
      </section>
      {controls?.spend?.interactive ? (
        <p className="border-s-2 border-warning ps-3 text-sm">
          {t.spendWarning}
        </p>
      ) : null}
    </div>
  );
}

export function OperatorCapabilityNotices({
  locale,
  controls,
}: {
  locale: OperatorLocale;
  controls?: OperatorControls['controls'];
}) {
  const t = operatorCopy(locale);
  const notices = controls
    ? ([
        [!controls.read_enabled, t.readDisabled],
        [!controls.llm_enabled, t.llmDisabled],
        [!controls.execution_enabled, t.executionDisabled],
        [!controls.schedules_enabled, t.schedulesDisabled],
      ] as const)
    : [];
  return (
    <>
      {notices
        .filter(([show]) => show)
        .map(([, text]) => (
          <div
            key={text}
            className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>{text}</span>
          </div>
        ))}
    </>
  );
}
