'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Database,
  Layers3,
  Radio,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  WorkloadResource,
  WorkloadStatus,
} from '@/types/platform/workload';
import {
  copy,
  EmptyWorkload,
  name,
  observedResourceState,
  WorkloadPanel,
  WorkloadNotice,
  WorkloadState,
  WorkloadTime,
  type WorkloadLocale,
} from './presentation';

export function resourceState(
  resource: WorkloadResource,
  now: number,
  maxAgeSeconds: number
) {
  if (
    !resource.observed_at ||
    !Number.isFinite(Date.parse(resource.observed_at))
  )
    return 'unknown';
  if (
    !resource.fresh ||
    now - Date.parse(resource.observed_at) > maxAgeSeconds * 1000 ||
    Date.parse(resource.observed_at) > now + 1000
  )
    return 'stale';
  if (!resource.available || !resource.healthy)
    return observedResourceState(resource);
  if (
    resource.kind === 'slots' &&
    resource.limit.capacity > 0 &&
    resource.reserved >= resource.limit.capacity
  )
    return 'saturated';
  if (
    resource.state === 'normal' &&
    (resource.kind === 'slots' ? resource.reserved : resource.pressure) === 0
  )
    return 'idle';
  return resource.state;
}
const unknownStates = ['unknown', 'stale', 'unavailable'];
const pressureStates = ['constrained', 'saturated', 'recovering'];
const healthStates = ['incident', 'unhealthy'];
const groups = [
  {
    key: 'aggregation',
    en: 'Collection & processing',
    ar: 'الجمع والمعالجة',
    icon: Layers3,
    resources: [
      'aggregation_svc',
      'agg_fetch_queue',
      'agg_news_queue',
      'agg_pods_queue',
      'agg_media_queue',
    ],
  },
  {
    key: 'enrichment',
    en: 'Text & language models',
    ar: 'النصوص والنماذج اللغوية',
    icon: Sparkles,
    resources: ['enrichment_svc', 'llm_slots'],
  },
  {
    key: 'media',
    en: 'Media & transcription',
    ar: 'الوسائط والتفريغ الصوتي',
    icon: Radio,
    resources: ['media_svc', 'stt_slots'],
  },
  {
    key: 'database',
    en: 'Database',
    ar: 'قاعدة البيانات',
    icon: Database,
    resources: ['cms_db'],
  },
];
const shortNames: Record<string, [string, string]> = {
  aggregation_svc: ['Processing starts', 'بدء المعالجة'],
  agg_fetch_queue: ['Source collection', 'جمع المصادر'],
  agg_news_queue: ['News backlog', 'تراكم الأخبار'],
  agg_pods_queue: ['Pods backlog', 'تراكم بودز'],
  agg_media_queue: ['Media backlog', 'تراكم الوسائط'],
  enrichment_svc: ['Text processing', 'معالجة النصوص'],
  llm_slots: ['Language models', 'النماذج اللغوية'],
  media_svc: ['Media processing', 'معالجة الوسائط'],
  stt_slots: ['Transcription', 'التفريغ الصوتي'],
  cms_db: ['Database sweeps', 'فحوصات قاعدة البيانات'],
};

export function ResourceEvidence({
  resource,
  locale,
  now,
  maxAgeSeconds,
  unavailable = false,
}: {
  resource: WorkloadResource;
  locale: WorkloadLocale;
  now: number;
  maxAgeSeconds: number;
  unavailable?: boolean;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const state = unavailable
    ? 'stale'
    : resourceState(resource, now, maxAgeSeconds);
  const known = !unknownStates.includes(state);
  const slots = resource.kind === 'slots';
  const value = slots ? resource.reserved : resource.pressure;
  const ceiling = slots ? resource.limit.capacity : resource.limit.hard;
  const ratio = ceiling > 0 ? Math.max(0, Math.min(value / ceiling, 1)) : 0;
  const label = shortNames[resource.key]
    ? t(...shortNames[resource.key])
    : name(resource.key, locale);
  return (
    <details
      className="group/resource border-t first:border-t-0"
      data-resource={resource.key}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(9rem,1fr)_minmax(7rem,1fr)_auto] sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {known && value === 0
              ? slots
                ? t('No slots reserved', 'لا توجد حجوزات')
                : t(
                    'No queued jobs reported',
                    'لا توجد مهام مُبلّغ عنها في الطابور'
                  )
              : slots
                ? t('Reserved slots', 'الحجوزات المستخدمة')
                : t('Queued jobs', 'مهام في الطابور')}
          </span>
        </span>
        <span className="flex items-center justify-end gap-2 sm:col-start-3 sm:row-start-1">
          <WorkloadState value={state} locale={locale} />
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open/resource:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </span>
        <span className="col-span-2 flex items-center gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <span
            className="relative h-1.5 min-w-8 flex-1 rounded-full bg-muted"
            aria-hidden="true"
          >
            {known && (
              <span
                className={cn(
                  'absolute inset-y-0 start-0 rounded-full',
                  ['saturated', ...healthStates].includes(state)
                    ? 'bg-destructive'
                    : ['constrained', 'recovering'].includes(state)
                      ? 'bg-amber-500'
                      : 'bg-primary/65'
                )}
                style={{ width: `${ratio * 100}%` }}
              />
            )}
            {!slots && ceiling > 0 && (
              <span
                className="absolute -top-0.5 h-2.5 w-px bg-foreground/35"
                style={{
                  insetInlineStart: `${Math.min(resource.limit.soft / ceiling, 1) * 100}%`,
                }}
              />
            )}
          </span>
          <span dir="ltr" className="min-w-16 text-end text-xs tabular-nums">
            <span className="font-semibold text-foreground">
              {known ? value.toLocaleString(locale) : '—'}
            </span>
            <span className="text-muted-foreground">
              {' '}
              / {ceiling.toLocaleString(locale)}
            </span>
          </span>
          {known && ceiling > 0 && (
            <meter
              className="sr-only"
              min={0}
              max={ceiling}
              value={Math.min(value, ceiling)}
              aria-label={`${name(resource.key, locale)}: ${value} / ${ceiling}`}
            />
          )}
        </span>
      </summary>
      <div className="space-y-2 border-t bg-muted/25 px-4 py-3 text-xs sm:px-5">
        <p className="text-muted-foreground">
          {t('Observed', 'وقت الرصد')}:{' '}
          <WorkloadTime value={resource.observed_at} locale={locale} />
        </p>
        {!slots && (
          <p className="text-muted-foreground">
            {t('Pressure threshold', 'عتبة الضغط')}:{' '}
            {resource.limit.soft.toLocaleString(locale)} ·{' '}
            {t('Hard limit', 'الحد الأقصى')}: {ceiling.toLocaleString(locale)}
          </p>
        )}
        <p>
          {slots
            ? t(
                'Reservations count work admitted by CMS. Service readiness is checked separately.',
                'تحسب الحجوزات العمل الذي قبله نظام المحتوى. وتُفحص جاهزية الخدمة بشكل مستقل.'
              )
            : t(
                'The marker shows where queue pressure begins to limit new work.',
                'تشير العلامة إلى الحد الذي يبدأ عنده ضغط الطابور بتقييد العمل الجديد.'
              )}
        </p>
        {resource.reason && (
          <p className="break-words text-muted-foreground" dir="auto">
            {state === 'incident'
              ? t(
                  'An open or recovering System Health incident affects this resource. Review the incident for its current status.',
                  'يؤثر حادث مفتوح أو قيد التعافي في صحة النظام على هذا المورد. راجع الحادث لمعرفة حالته الحالية.'
                )
              : resource.reason}
          </p>
        )}
      </div>
    </details>
  );
}

export function WorkloadOverview({
  data,
  locale,
  now,
  unavailable,
  navigate,
}: {
  data: WorkloadStatus;
  locale: WorkloadLocale;
  now: number;
  unavailable: boolean;
  navigate: (tab: string, filters?: Record<string, string>) => void;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const stateOf = (r: WorkloadResource) =>
    unavailable
      ? 'stale'
      : resourceState(r, now, data.policy.snapshot_max_age_seconds);
  const unknown = data.resources.filter((r) =>
    unknownStates.includes(stateOf(r))
  );
  const pressure = data.resources.filter((r) =>
    pressureStates.includes(stateOf(r))
  );
  const healthIssues = data.resources.filter((r) =>
    healthStates.includes(stateOf(r))
  );
  const incidents = healthIssues.filter((r) => stateOf(r) === 'incident');
  const needsAttention = (r: WorkloadResource) =>
    [...unknownStates, ...pressureStates, ...healthStates].includes(stateOf(r));
  const attentionCount = unknown.length + pressure.length + healthIssues.length;
  const missingEvidence = unknown.length > 0 || !data.resources.length;
  const paused =
    !!data.policy.paused_until && Date.parse(data.policy.paused_until) > now;
  const needsOwner =
    data.summary.uncertain_permits > 0 || data.summary.overdue_permits > 0;
  const headline = unavailable
    ? t(
        'Current capacity cannot be verified',
        'لا يمكن التحقق من السعة الحالية'
      )
    : missingEvidence
      ? t('Capacity evidence needs attention', 'أدلة السعة تحتاج إلى متابعة')
      : needsOwner
        ? t('Unresolved work needs review', 'عمل غير محسوم يحتاج إلى مراجعة')
        : healthIssues.length
          ? t('Service health needs attention', 'صحة الخدمات تحتاج إلى متابعة')
          : pressure.length
            ? t('Some resources are under pressure', 'بعض الموارد تحت ضغط')
            : t(
                'Observed resources have capacity',
                'تتوفر سعة لدى الموارد المرصودة'
              );
  const reviewOwners = () =>
    navigate('activity', {
      history: 'permits',
      class: '',
      verdict: '',
      state: data.summary.uncertain_permits ? 'uncertain' : '',
      permits_before: '',
    });
  const description =
    unavailable || missingEvidence
      ? t(
          'Some readings are missing or out of date. Check service health before changing admission.',
          'بعض القراءات مفقودة أو قديمة. افحص صحة الخدمات قبل تغيير القبول.'
        )
      : needsOwner
        ? t(
            'Some work has no verified completion. Review it with the responsible owner before admitting more.',
            'بعض الأعمال دون إثبات اكتمال. راجعها مع الجهة المسؤولة قبل قبول المزيد.'
          )
        : healthIssues.length
          ? t(
              'Health status and workload are separate signals. Review the health alert even when no queued work or reservations are reported.',
              'صحة الخدمة وحجم العمل إشارتان منفصلتان. راجع تنبيه الصحة حتى عند عدم وجود مهام أو حجوزات مُبلّغ عنها.'
            )
          : paused
            ? t(
                'Admission bypass is temporarily active. Native service and financial limits still apply.',
                'الاستثناء المؤقت من ضبط القبول مفعّل. تظل حدود الخدمات والإنفاق المحلية سارية.'
              )
            : data.mode === 'off'
              ? t(
                  'The governor is off. Start Observe to collect a reviewable admission record.',
                  'المنظّم متوقف. ابدأ المراقبة لجمع سجل قابل للمراجعة لقرارات القبول.'
                )
              : data.mode === 'observe'
                ? t(
                    'Work continues as usual. Review the recorded decisions before choosing classes to enforce.',
                    'يستمر العمل كالمعتاد. راجع القرارات المسجلة قبل اختيار الفئات التي تريد تطبيق حدودها.'
                  )
                : t(
                    'Selected classes use capacity limits. Check delayed work and service health together.',
                    'تخضع الفئات المختارة لحدود السعة. راجع العمل المؤجل وصحة الخدمات معًا.'
                  );
  const metrics = [
    {
      label: t('Active reservations', 'الحجوزات النشطة'),
      value: data.summary.active_permits,
      action: () =>
        navigate('activity', {
          history: 'permits',
          class: '',
          verdict: '',
          state: '',
          permits_before: '',
        }),
    },
    {
      label: t('Would delay · 24h', 'تأجيل افتراضي · ٢٤ ساعة'),
      value: data.summary.would_defer_24h,
      action: () =>
        navigate('activity', {
          history: 'decisions',
          class: '',
          verdict: '',
          decisions_before: '',
        }),
    },
    {
      label: t('Unresolved executions', 'عمليات تنفيذ غير محسومة'),
      value: data.summary.uncertain_permits,
      action: reviewOwners,
    },
    {
      label: t('Evidence gaps · 24h', 'قرارات دون أدلة · ٢٤ ساعة'),
      value: data.summary.unavailable_24h,
      action: () => navigate('evidence'),
    },
  ];
  const allGroups = [
    ...groups,
    {
      key: 'other',
      en: 'Other resources',
      ar: 'موارد أخرى',
      icon: Layers3,
      resources: data.resources
        .filter((r) => !groups.some((g) => g.resources.includes(r.key)))
        .map((r) => r.key),
    },
  ];
  const columns: (typeof allGroups)[] = [[], []];
  const weights = [0, 0];
  for (const group of allGroups) {
    const count = group.resources.filter((key) =>
      data.resources.some(
        (r) => r.key === key && (!attentionOnly || needsAttention(r))
      )
    ).length;
    if (!count) continue;
    const column = weights[0] <= weights[1] ? 0 : 1;
    columns[column].push(group);
    weights[column] += count + 1;
  }
  return (
    <div className="space-y-5">
      <section
        aria-label={t('Capacity assessment', 'تقييم السعة')}
        className="overflow-hidden rounded-lg border bg-card"
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                unavailable || missingEvidence || attentionCount || needsOwner
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="max-w-2xl space-y-1.5">
              <h2 className="text-base font-semibold tracking-tight">
                {headline}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
              {!unavailable && data.summary.overdue_permits > 0 && (
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {data.summary.overdue_permits.toLocaleString(locale)}{' '}
                  {t(
                    'execution reservations are past their lease deadline. Verify them with the native owner.',
                    'من حجوزات التنفيذ تجاوزت نهاية مدة الحجز. تحقّق منها لدى الجهة المسؤولة.'
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {unavailable ||
            missingEvidence ||
            (!needsOwner && healthIssues.length > 0) ? (
              <Button asChild size="sm">
                <Link href="/platform/system-health">
                  {t('Check System Health', 'افحص صحة النظام')}
                  <ArrowUpRight
                    className="ms-2 h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={
                  needsOwner
                    ? reviewOwners
                    : () =>
                        navigate(
                          data.mode === 'off' || paused
                            ? 'settings'
                            : 'evidence'
                        )
                }
              >
                {needsOwner
                  ? t('Review reservations', 'راجع الحجوزات')
                  : data.mode === 'off' || paused
                    ? t('Review settings', 'مراجعة الإعدادات')
                    : t('Review readiness', 'مراجعة الجاهزية')}
                <ArrowRight
                  className="ms-2 h-3.5 w-3.5 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y border-t bg-muted/20 lg:grid-cols-4 lg:divide-y-0 rtl:divide-x-reverse">
          {metrics.map((metric) => (
            <button
              type="button"
              key={metric.label}
              onClick={metric.action}
              className="group min-w-0 px-5 py-4 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="block text-xs text-muted-foreground">
                {metric.label}
              </span>
              <span className="mt-1 flex items-center justify-between text-2xl font-semibold tabular-nums tracking-tight">
                {unavailable ? '—' : metric.value.toLocaleString(locale)}
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </button>
          ))}
        </div>
      </section>
      {!!data.unavailable_count && (
        <WorkloadNotice
          locale={locale}
          title={t(
            'Some governor evidence could not be recorded',
            'تعذر تسجيل بعض أدلة المنظّم'
          )}
        >
          {t(
            'Admission or lifecycle evidence was unavailable during this CMS process. Native controls still applied; database history may omit these operations.',
            'تعذرت أدلة القبول أو دورة التنفيذ خلال تشغيل نظام المحتوى الحالي. ظلت ضوابط الخدمات سارية؛ وقد لا يتضمن سجل قاعدة البيانات هذه العمليات.'
          )}{' '}
          {data.unavailable_count.toLocaleString(locale)}
        </WorkloadNotice>
      )}
      {!!data.disabled_journal_loss && (
        <WorkloadNotice
          locale={locale}
          title={t(
            'Off-mode journal is incomplete',
            'سجل وضع الإيقاف غير مكتمل'
          )}
        >
          {t(
            'Some Off-mode admission entries could not be saved. These counts cannot establish complete caller coverage.',
            'تعذر حفظ بعض قرارات القبول في وضع الإيقاف. لا تثبت هذه الأعداد اكتمال تغطية الجهات المستدعية.'
          )}
        </WorkloadNotice>
      )}
      <WorkloadPanel
        title={t('Shared capacity', 'السعة المشتركة')}
        description={t(
          'Usage and service health are separate. Zero means no reported queue load or reservations; Idle also requires a healthy service.',
          'الاستخدام وصحة الخدمة إشارتان منفصلتان. الصفر يعني عدم وجود ضغط أو حجوزات مُبلّغ عنها؛ وتظهر «دون عمل حاليًا» فقط عندما تكون الخدمة سليمة.'
        )}
        action={
          <div className="inline-flex flex-wrap items-center gap-1 rounded-md border p-1">
            <button
              type="button"
              aria-pressed={!attentionOnly}
              onClick={() => setAttentionOnly(false)}
              className={cn(
                'min-h-9 rounded px-3 text-xs font-medium transition-colors',
                !attentionOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {t('All resources', 'جميع الموارد')}{' '}
              <span className="ms-1 tabular-nums opacity-75">
                {data.resources.length}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly(true)}
              className={cn(
                'min-h-9 rounded px-3 text-xs font-medium transition-colors',
                attentionOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {t('Needs attention', 'تحتاج متابعة')}{' '}
              <span className="ms-1 tabular-nums opacity-75">
                {attentionCount}
              </span>
            </button>
          </div>
        }
      >
        {incidents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs">
            <p className="max-w-2xl leading-relaxed">
              <span className="font-semibold">
                {incidents.length.toLocaleString(locale)}{' '}
                {incidents.length === 1
                  ? t(
                      'resource affected by a health incident.',
                      'مورد متأثر بحادث في صحة النظام.'
                    )
                  : t(
                      'resources affected by health incidents.',
                      'موارد متأثرة بحوادث صحة النظام.'
                    )}
              </span>{' '}
              {t(
                'An empty queue does not clear an open or recovering incident.',
                'لا يعني خلو الطابور انتهاء حادث مفتوح أو قيد التعافي.'
              )}
            </p>
            <Link
              href="/platform/system-health"
              className="inline-flex min-h-9 items-center gap-1.5 font-medium underline underline-offset-4"
            >
              {t('Review health incidents', 'مراجعة حوادث صحة النظام')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {columns
            .filter((column) => column.length)
            .map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-4">
                {column.map((group) => {
                  const rows = group.resources
                    .map((key) => data.resources.find((r) => r.key === key))
                    .filter((r): r is WorkloadResource => !!r)
                    .filter((r) => !attentionOnly || needsAttention(r));
                  if (!rows.length) return null;
                  const Icon = group.icon;
                  return (
                    <section
                      key={group.key}
                      className="min-w-0 overflow-hidden rounded-md border"
                    >
                      <div className="flex items-center gap-2.5 bg-muted/35 px-4 py-3 sm:px-5">
                        <Icon
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <h3 className="text-xs font-semibold">
                          {t(group.en, group.ar)}
                        </h3>
                        <span className="ms-auto text-xs tabular-nums text-muted-foreground">
                          {rows.length.toLocaleString(locale)}{' '}
                          {rows.length === 1
                            ? t('resource', 'مورد')
                            : t('resources', 'موارد')}
                        </span>
                      </div>
                      <div>
                        {rows.map((resource) => (
                          <ResourceEvidence
                            key={resource.key}
                            resource={resource}
                            locale={locale}
                            now={now}
                            maxAgeSeconds={data.policy.snapshot_max_age_seconds}
                            unavailable={unavailable}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ))}
        </div>
        {!data.resources.length && (
          <EmptyWorkload
            locale={locale}
            description={t(
              'No resource observation has been recorded. Capacity is unknown.',
              'لم يُسجَّل رصد للموارد. السعة غير معروفة.'
            )}
          />
        )}
        {!!data.resources.length && attentionOnly && !attentionCount && (
          <EmptyWorkload
            locale={locale}
            title={t(
              'No resource needs attention',
              'لا يوجد مورد يحتاج متابعة'
            )}
            description={t(
              'All current resource readings are available and within their limits.',
              'جميع قراءات الموارد الحالية متاحة وضمن حدودها.'
            )}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span>
            {t(
              'Select a resource to inspect its reading and limits.',
              'اختر موردًا لمراجعة قراءته وحدوده.'
            )}
          </span>
          <Link
            href="/platform/system-health"
            className="inline-flex min-h-8 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('Open System Health', 'افتح صحة النظام')}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </WorkloadPanel>
      {!!data.attention.length && (
        <WorkloadPanel
          title={t('Work waiting too long', 'عمل ينتظر طويلًا')}
          description={t(
            'These owners have repeatedly been deferred. Review their activity before changing limits.',
            'تأجلت أعمال هذه الجهات مرارًا. راجع نشاطها قبل تغيير الحدود.'
          )}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('activity')}
            >
              {t('Review activity', 'مراجعة النشاط')}
            </Button>
          }
        >
          <div className="divide-y">
            {data.attention.map((item, i) => (
              <div
                key={`${item.system}-${item.class}-${i}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {name(item.system, locale)} · {name(item.class, locale)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <WorkloadTime value={item.since} locale={locale} /> ·{' '}
                    {item.count} {t('decisions', 'قرارات')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    navigate('activity', {
                      class: item.class,
                      history: 'decisions',
                      decisions_before: '',
                    })
                  }
                >
                  {t('Inspect work', 'راجع العمل')}
                  <ArrowRight
                    className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ))}
          </div>
        </WorkloadPanel>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="min-h-8 cursor-pointer">
          {t('How to read these numbers', 'كيف تقرأ هذه الأعداد')}
        </summary>
        <p className="mt-2 max-w-3xl leading-relaxed">
          {t(
            'Would-defer counts are decisions, not affected people or confirmed delivery failures.',
            'أعداد التأجيل الافتراضي تمثل قرارات، ولا تمثل أشخاصًا متأثرين أو إخفاقات تسليم مؤكدة.'
          )}{' '}
          {t(
            'Owners retry on their own cadence. The governor does not queue deferred work.',
            'تعيد الجهات المشغّلة المحاولة حسب جدولها. لا يضع المنظّم العمل المؤجل في طابور.'
          )}
        </p>
      </details>
    </div>
  );
}
