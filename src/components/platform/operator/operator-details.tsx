'use client';

import Link from '@/lib/console-link';
import { ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OperatorVisibleContext } from '@/types/platform/operator';
import type {
  OperatorTask,
  OperatorTaskGroup,
  OperatorTaskKind,
} from '@/hooks/use-operator';
import {
  actionLabel,
  lifecycleLabel,
  operatorCopy,
  operatorDomainLabel,
  type OperatorLocale,
} from './operator-copy';
import { operatorDetailsCopy } from './operator-details-copy';
import {
  formatOperatorTime,
  type OperatorEvidence,
  type OperatorMessage,
  type OperatorControls,
} from './operator-workspace-components';
import { operatorResponseBlocks } from './operator-answer';

const fieldNames: Record<string, [string, string]> = {
  status: ['Status', 'الحالة'],
  type: ['Content type', 'نوع المحتوى'],
  source: ['Source', 'المصدر'],
  source_id: ['Source', 'المصدر'],
  source_name: ['Source', 'المصدر'],
  tab: ['Section', 'القسم'],
  section: ['Section', 'القسم'],
  q: ['Search', 'البحث'],
  query: ['Search', 'البحث'],
  search: ['Search', 'البحث'],
  title: ['Title', 'العنوان'],
  enabled: ['Enabled', 'مفعّل'],
  name: ['Name', 'الاسم'],
  category: ['Category', 'الفئة'],
  limit: ['Result limit', 'حد النتائج'],
  tenant_id: ['Tenant', 'المستأجر'],
  feed_visibility: ['Feed visibility', 'الظهور في الخلاصة'],
  media_suitability: ['Media suitability', 'ملاءمة الوسائط'],
  duration_bucket: ['Duration', 'المدة'],
  min_duration: ['Minimum duration', 'الحد الأدنى للمدة'],
  max_duration: ['Maximum duration', 'الحد الأعلى للمدة'],
  url: ['URL', 'الرابط'],
  description: ['Description', 'الوصف'],
  mode: ['Mode', 'الوضع'],
  reason: ['Reason', 'السبب'],
  paused: ['Paused', 'متوقف'],
};
function label(key: string, locale: OperatorLocale) {
  return (
    fieldNames[key]?.[locale === 'ar' ? 1 : 0] ??
    key.replaceAll('_', ' ').replace(/\b\w/, (c) => c.toUpperCase())
  );
}
function sourceName(item: OperatorEvidence, locale: OperatorLocale) {
  const key = item.evidence_id.split(':')[0];
  const names: Record<string, [string, string]> = {
    storage_usage: ['Storage usage snapshot', 'لقطة استخدام التخزين'],
    storage_policy: ['Storage policy', 'سياسة التخزين'],
    media_circulation_policy: [
      'Media circulation policy',
      'سياسة تداول الوسائط',
    ],
    source: ['Source record', 'سجل المصدر'],
    source_run: ['Source run', 'تشغيل المصدر'],
    retention_policy: ['Retention policy', 'سياسة الاحتفاظ'],
  };
  return names[key]?.[locale === 'ar' ? 1 : 0] ?? label(key, locale);
}
function valueText(value: unknown, locale: OperatorLocale): string {
  if (value === true) return locale === 'ar' ? 'نعم' : 'Yes';
  if (value === false) return locale === 'ar' ? 'لا' : 'No';
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value))
    return value.map((item) => valueText(item, locale)).join(' · ');
  if (typeof value === 'object')
    return Object.entries(value)
      .map(([key, v]) => `${label(key, locale)}: ${valueText(v, locale)}`)
      .join(' · ');
  return String(value);
}
export function OperatorContextDetails({
  locale,
  context,
  onChange,
}: {
  locale: OperatorLocale;
  context: OperatorVisibleContext;
  onChange: (context: OperatorVisibleContext) => void;
}) {
  const t = operatorDetailsCopy(locale),
    subjects = context.subjects.filter((item) => item.type !== 'tenant');
  const section = (title: string, children: React.ReactNode) => (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
  return (
    <div
      className="space-y-5 p-4"
      role="region"
      aria-label={operatorCopy(locale).nextQuestionContext}
    >
      <div>
        <h2 className="text-sm font-semibold">{t.nextQuestion}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t.contextHelp}
        </p>
        <Badge variant="secondary" className="mt-3">
          {operatorDomainLabel(context.domain, locale)}
        </Badge>
      </div>
      {context.selection
        ? section(
            t.selection,
            <div className="space-y-2 rounded-lg border p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p>
                  {context.selection.mode === 'filtered'
                    ? t.filtered
                    : t.explicit}{' '}
                  · {context.selection.count}
                  <span className="mt-1 block text-muted-foreground">
                    {context.selection.ids?.length ?? subjects.length}{' '}
                    {t.selected}
                  </span>
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={t.removeSelection}
                  onClick={() =>
                    onChange({
                      ...context,
                      subjects: context.subjects.filter(
                        (item) => item.type === 'tenant'
                      ),
                      selection: undefined,
                    })
                  }
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              {context.selection.truncated ? (
                <p className="leading-5 text-warning">{t.truncated}</p>
              ) : null}
            </div>
          )
        : null}
      {subjects.length
        ? section(
            t.records,
            <div className="divide-y">
              {subjects.map((subject) => (
                <div
                  key={`${subject.type}:${subject.id}`}
                  className="flex items-start gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm" dir="auto">
                      {subject.label ?? label(subject.type, locale)}
                    </p>
                    <details className="mt-1 text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer">
                        {t.technical}
                      </summary>
                      <bdi className="mt-1 block break-all font-mono">
                        {subject.id}
                      </bdi>
                    </details>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`${t.removeRecord}: ${subject.label ?? subject.id}`}
                    onClick={() => {
                      const remaining = subjects.filter(
                        (item) => item !== subject
                      );
                      const ids = context.selection?.ids?.filter(
                        (id) => id !== subject.id
                      );
                      onChange({
                        ...context,
                        subjects: context.subjects.filter(
                          (item) => item !== subject
                        ),
                        selection:
                          context.selection?.mode === 'explicit'
                            ? {
                                ...context.selection,
                                ids,
                                count: ids?.length ?? remaining.length,
                              }
                            : context.selection
                              ? { ...context.selection, ids, truncated: true }
                              : undefined,
                      });
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )
        : null}
      {Object.keys(context.filters).length
        ? section(
            t.filters,
            <div className="divide-y">
              {Object.entries(context.filters).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="text-muted-foreground">
                      {label(key, locale)}
                    </p>
                    <p className="mt-1 break-words leading-5" dir="auto">
                      {valueText(value, locale)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`${t.removeFilter}: ${label(key, locale)}`}
                    onClick={() => {
                      const filters = { ...context.filters };
                      delete filters[key];
                      onChange({ ...context, filters });
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )
        : null}
      {context.draft
        ? section(
            t.draft,
            <div className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-xs leading-5 text-muted-foreground">
                  {t.draftHelp}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`${t.remove}: ${t.draft}`}
                  onClick={() => onChange({ ...context, draft: undefined })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <dl className="mt-3 space-y-3">
                {Object.entries(context.draft.safe_normalized_fields).length ? (
                  Object.entries(context.draft.safe_normalized_fields).map(
                    ([key, value]) => (
                      <div key={key}>
                        <dt className="text-[11px] text-muted-foreground">
                          {label(key, locale)}
                        </dt>
                        <dd
                          className="mt-1 break-words text-xs leading-5"
                          dir="auto"
                        >
                          {valueText(value, locale)}
                        </dd>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t.noDraftValues}
                  </p>
                )}
              </dl>
            </div>
          )
        : null}
      {!subjects.length &&
      !context.selection &&
      !Object.keys(context.filters).length &&
      !context.draft ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {t.noAttachments}
        </p>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            onChange({
              ...context,
              subjects: context.subjects.filter(
                (item) => item.type === 'tenant'
              ),
              filters: {},
              selection: undefined,
              draft: undefined,
            })
          }
        >
          {operatorCopy(locale).clearContext}
        </Button>
      )}
    </div>
  );
}

export function OperatorSourcesDetails({
  locale,
  question,
  reply,
  evidence,
  selectedIDs = [],
  loading,
  error,
  onRetry,
  onAll,
  onFollow,
}: {
  locale: OperatorLocale;
  question?: string;
  reply?: OperatorMessage;
  evidence: OperatorEvidence[];
  selectedIDs?: string[];
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onAll: () => void;
  onFollow: () => void;
}) {
  const t = operatorDetailsCopy(locale),
    copy = operatorCopy(locale),
    blocks = operatorResponseBlocks(reply?.content);
  const selected = new Set(selectedIDs),
    shown = selected.size
      ? evidence.filter((item) => selected.has(item.evidence_id))
      : evidence;
  const missing = selectedIDs.filter(
    (id) => !evidence.some((item) => item.evidence_id === id)
  );
  return (
    <div className="space-y-4 p-4">
      <AnswerScope locale={locale} question={question} at={reply?.created_at} />
      <p className="text-xs leading-5 text-muted-foreground">{t.sourcesHelp}</p>
      {selected.size ? (
        <Button size="sm" variant="outline" onClick={onAll}>
          {t.allSources}
        </Button>
      ) : null}
      {error ? (
        <ReadError text={t.sourceError} retry={t.retry} onRetry={onRetry} />
      ) : loading && !evidence.length ? (
        <Loading />
      ) : (
        <>
          {missing.length ? (
            <p
              role="status"
              className="border-s-2 border-warning ps-3 text-xs leading-5"
            >
              {t.missingSource}
            </p>
          ) : null}
          {!shown.length && !missing.length ? (
            <p className="py-4 text-sm text-muted-foreground">{t.noSources}</p>
          ) : null}
          {shown.map((item) => {
            const claims = blocks.filter((block) =>
              block.evidence_ids.includes(item.evidence_id)
            );
            const stale =
              Date.parse(item.expires_at) <= Date.now() &&
              ['available', 'partial'].includes(item.availability);
            const state = stale ? 'stale' : item.availability;
            return (
              <article
                key={item.id}
                className="space-y-3 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words text-sm font-medium">
                    {sourceName(item, locale)}
                  </h3>
                  <Badge
                    variant={
                      ['stale', 'conflicting', 'unavailable'].includes(state)
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {copy.evidenceStates[
                      state as keyof typeof copy.evidenceStates
                    ] ?? copy.unavailable}
                  </Badge>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                    {t.supports}
                  </p>
                  {claims.length ? (
                    claims.map((claim, i) => (
                      <blockquote
                        key={i}
                        className="mb-2 border-s-2 ps-3 text-xs leading-5"
                        dir="auto"
                      >
                        {claim.text}
                      </blockquote>
                    ))
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t.uncited}
                    </p>
                  )}
                </div>
                <div className="text-[11px] leading-5 text-muted-foreground">
                  <p>
                    {t.recorded}: {formatOperatorTime(item.observed_at)}
                  </p>
                  <p>
                    {t.expires}: {formatOperatorTime(item.expires_at)}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                >
                  <Link href={item.deep_link}>
                    {t.currentRecord}
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer">
                    {copy.sourceDetails}
                  </summary>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt>{t.shared}</dt>
                      <dd>{item.authority}</dd>
                    </div>
                    <div>
                      <dt>{copy.recordedAvailability}</dt>
                      <dd>
                        {copy.evidenceStates[
                          item.availability as keyof typeof copy.evidenceStates
                        ] ?? copy.unavailable}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.evidence}</dt>
                      <dd>
                        <bdi className="break-all font-mono">
                          {item.evidence_id}
                        </bdi>
                      </dd>
                    </div>
                    <div>
                      <dt>Adapter</dt>
                      <dd>
                        <bdi className="break-all">{item.adapter_key}</bdi>
                      </dd>
                    </div>
                  </dl>
                </details>
              </article>
            );
          })}
          {missing.length
            ? blocks
                .filter((block) =>
                  block.evidence_ids.some((id) => missing.includes(id))
                )
                .map((block, i) => (
                  <blockquote
                    key={i}
                    className="border-s-2 ps-3 text-xs leading-5"
                    dir="auto"
                  >
                    {block.text}
                  </blockquote>
                ))
            : null}
        </>
      )}
      <p className="text-[11px] leading-5 text-muted-foreground">
        {t.historical}
      </p>
      {question ? (
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between"
          onClick={onFollow}
        >
          {t.followSource}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Button>
      ) : null}
    </div>
  );
}
export function AnswerScope({
  locale,
  question,
  at,
}: {
  locale: OperatorLocale;
  question?: string;
  at?: string;
}) {
  const t = operatorDetailsCopy(locale);
  return (
    <div className="space-y-1 border-s-2 ps-3">
      <p className="text-[11px] text-muted-foreground">
        {t.forAnswer}
        {at ? ` · ${formatOperatorTime(at)}` : ''}
      </p>
      <p className="break-words text-sm font-medium leading-6" dir="auto">
        {question ?? t.noAnswer}
      </p>
    </div>
  );
}
function Loading() {
  return (
    <div role="status" className="flex justify-center p-5">
      <Loader2
        aria-label="Loading"
        className="size-4 animate-spin motion-reduce:animate-none"
      />
    </div>
  );
}
export function ReadError({
  text,
  retry,
  onRetry,
}: {
  text: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="space-y-3 p-2 text-sm">
      <p className="leading-6 text-warning">{text}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {retry}
      </Button>
    </div>
  );
}

export function OperatorActivityDetails({
  locale,
  scope,
  onScope,
  group,
  onGroup,
  kind,
  onKind,
  tasks,
  loading,
  error,
  onRetry,
  onCancel,
  onOpen,
  onMore,
  hasMore,
  fetchingMore,
  hasChat,
  events = [],
}: {
  locale: OperatorLocale;
  scope: 'chat' | 'all';
  onScope: (scope: 'chat' | 'all') => void;
  group: OperatorTaskGroup;
  onGroup: (group: OperatorTaskGroup) => void;
  kind: OperatorTaskKind;
  onKind: (kind: OperatorTaskKind) => void;
  tasks: OperatorTask[];
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onCancel: (task: OperatorTask) => void;
  onOpen: (task: OperatorTask) => void;
  onMore: () => void;
  hasMore?: boolean;
  fetchingMore?: boolean;
  hasChat: boolean;
  events?: Array<{ sequence: number; event_type: string; created_at: string }>;
}) {
  const t = operatorDetailsCopy(locale),
    copy = operatorCopy(locale);
  return (
    <div className="space-y-4 p-4">
      <Select
        value={scope}
        onValueChange={(value) => {
          if (value === 'chat' || value === 'all') onScope(value);
        }}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <SelectTrigger aria-label={t.scope} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="chat">{t.thisChat}</SelectItem>
          <SelectItem value="all">{t.allWork}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs leading-5 text-muted-foreground">
        {scope === 'chat' ? t.contextUsed : t.allWorkHelp}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={group}
          onValueChange={(value) => {
            if (value === 'all' || value in copy.groups)
              onGroup(value as OperatorTaskGroup);
          }}
        >
          <SelectTrigger
            aria-label={copy.taskStatus}
            className="h-9 min-w-0 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStates}</SelectItem>
            {Object.entries(copy.groups).map(([key, name]) => (
              <SelectItem key={key} value={key}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={kind}
          onValueChange={(value) => {
            if (value in copy.kinds) onKind(value as OperatorTaskKind);
          }}
        >
          <SelectTrigger
            aria-label={copy.taskType}
            className="h-9 min-w-0 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(copy.kinds).map(([key, name]) => (
              <SelectItem key={key} value={key}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <ReadError text={t.activityError} retry={t.retry} onRetry={onRetry} />
      ) : loading && !tasks.length ? (
        <Loading />
      ) : !tasks.length ? (
        <p className="py-4 text-sm leading-6 text-muted-foreground">
          {scope === 'chat' && !hasChat ? t.askFirst : t.emptyActivity}
        </p>
      ) : (
        <div className="divide-y">
          {tasks.map((task) => {
            const expired =
              task.state === 'awaiting_approval' &&
              task.expires_at &&
              Date.parse(task.expires_at) <= Date.now();
            const title =
              (task.kind === 'plan'
                ? actionLabel(
                    `operator.action.${task.title.replaceAll('.', '_')}`,
                    locale
                  )
                : undefined) ?? task.title.replaceAll('_', ' ');
            return (
              <article key={task.id} className="space-y-2 py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      expired ||
                      ['failed', 'blocked', 'paused'].includes(task.state)
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {expired
                      ? copy.expiredPreview
                      : lifecycleLabel(task.state, locale)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {copy.kinds[task.kind]}
                  </span>
                  {task.unread ? (
                    <span
                      className="size-1.5 rounded-full bg-info"
                      aria-label={t.unread}
                    />
                  ) : null}
                </div>
                {task.investigation_id || task.plan_id ? (
                  <button
                    className="block w-full rounded text-start text-sm font-medium leading-6 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onOpen(task)}
                    dir="auto"
                  >
                    {title}
                  </button>
                ) : (
                  <p className="text-sm font-medium leading-6" dir="auto">
                    {title}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {formatOperatorTime(task.updated_at)}
                </p>
                {expired ? (
                  <p className="text-xs leading-5 text-warning">
                    {t.previewExpired}
                  </p>
                ) : null}
                {task.state === 'failed' || task.state === 'blocked' ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t.failureHelp}
                  </p>
                ) : null}
                {task.error_class ? (
                  <details className="text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer">{t.technical}</summary>
                    <bdi className="mt-1 block break-all">
                      {task.error_class}
                    </bdi>
                  </details>
                ) : null}
                {task.can_cancel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCancel(task)}
                  >
                    {copy.cancelTask}
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {hasMore ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onMore}
          disabled={fetchingMore}
        >
          {fetchingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t.more}
        </Button>
      ) : null}
      {events.length && scope === 'chat' ? (
        <details className="border-t pt-3 text-xs">
          <summary className="cursor-pointer font-medium">{t.timeline}</summary>
          <ol className="mt-3 space-y-3 border-s ps-3">
            {events.map((event) => (
              <li key={event.sequence}>
                <p>{lifecycleLabel(event.event_type, locale)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatOperatorTime(event.created_at)}
                </p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export function OperatorStatusDetails({
  locale,
  controls,
  loading,
  error,
  onRetry,
  state,
  reply,
}: {
  locale: OperatorLocale;
  controls?: OperatorControls;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  state?: string;
  reply?: OperatorMessage;
}) {
  const t = operatorDetailsCopy(locale),
    copy = operatorCopy(locale),
    limits = operatorResponseBlocks(reply?.content).filter(
      (block) => block.kind === 'degraded' || block.kind === 'unknown'
    );
  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-sm font-semibold">{t.policy}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t.policyHelp}
        </p>
      </div>
      {error ? (
        <ReadError text={t.statusError} retry={t.retry} onRetry={onRetry} />
      ) : loading ? (
        <Loading />
      ) : (
        <>
          <dl className="divide-y">
            {Object.entries(copy.capabilityNames).map(([key, name]) => {
              const allowed =
                controls?.controls?.[
                  key as keyof NonNullable<OperatorControls['controls']>
                ];
              return (
                <div
                  className="flex items-center justify-between gap-3 py-3 text-xs"
                  key={key}
                >
                  <dt>{name}</dt>
                  <dd>
                    <Badge
                      variant={allowed === false ? 'warning' : 'secondary'}
                    >
                      {allowed === true
                        ? t.allowed
                        : allowed === false
                          ? t.disabled
                          : t.unknown}
                    </Badge>
                  </dd>
                </div>
              );
            })}
          </dl>
          {controls?.spend?.interactive ? (
            <p className="border-s-2 border-warning ps-3 text-xs leading-5">
              {t.budget}
            </p>
          ) : null}
          {controls?.spend?.scheduled_hard_stop ? (
            <p className="border-s-2 border-warning ps-3 text-xs leading-5">
              {t.scheduledBudget}
            </p>
          ) : null}
          {controls?.controls?.adapters?.filter(
            (row) =>
              row.disabled === true &&
              (!row.expires_at || Date.parse(row.expires_at) > Date.now())
          ).length ? (
            <section className="space-y-2">
              <h3 className="text-xs font-medium">{t.disabledReason}</h3>
              {controls.controls.adapters
                .filter(
                  (row) =>
                    row.disabled === true &&
                    (!row.expires_at || Date.parse(row.expires_at) > Date.now())
                )
                .map((row, i) => (
                  <div key={i} className="rounded border p-3 text-xs">
                    <p className="break-words" dir="auto">
                      {row.reason || row.capability_key}
                    </p>
                    {row.expires_at ? (
                      <p className="mt-1 text-muted-foreground">
                        {t.until}: {formatOperatorTime(row.expires_at)}
                      </p>
                    ) : null}
                  </div>
                ))}
            </section>
          ) : null}
        </>
      )}
      {state ? (
        <section className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-medium">{t.latest}</h3>
          <Badge variant={state === 'failed' ? 'warning' : 'secondary'}>
            {lifecycleLabel(state, locale)}
          </Badge>
          {limits.length ? (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {t.limitations}
              </p>
              {limits.map((block, i) => (
                <p key={i} className="text-xs leading-5" dir="auto">
                  {block.text}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <Button
        asChild
        size="sm"
        variant="outline"
        className="w-full justify-between"
      >
        <Link href="/platform/economics">
          {t.economics}
          <ExternalLink className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
