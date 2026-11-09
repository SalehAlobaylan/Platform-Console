'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/lib/console-link';
import { ArrowRight, ChevronDown, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActivityRail } from '@/components/platform/shared/activity-rail';
import { SystemControlStrip } from '@/components/platform/shared/system-control-strip';
import { PodsPipelineActivity } from './pods-pipeline-activity';
import {
  usePodsAutomation,
  useSetPodsAutomation,
} from '@/hooks/use-pods-automation';
import { useSystemControlLocale } from '@/hooks/use-system-control-locale';
import type { PodsAutomationStatus } from '@/lib/api/cms/pods-automation';
import {
  pipelineActivity,
  pipelineNumber,
  pipelineReviewKey,
  pipelineState,
  pipelineText,
  type SystemControlLocale,
} from '@/lib/systems/pods-pipeline';

const controlsHref = '/platform/media/sources#pods-pipeline';
const evidenceFreshnessMs = 60_000;

export function PodsPipelineControl({
  compact = false,
  locale: requestedLocale,
}: {
  compact?: boolean;
  locale?: SystemControlLocale;
}) {
  const query = usePodsAutomation();
  const update = useSetPodsAutomation();
  const locale = useSystemControlLocale(requestedLocale);
  const t = pipelineText(locale);
  const n = (value: number) => pipelineNumber(value, locale);
  const [now, setNow] = useState(Date.now);
  const [review, setReview] = useState<PodsAutomationStatus | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewChanged, setReviewChanged] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const actionPending = useRef(false);
  const data = query.data;
  const stale = Boolean(
    data && now - query.dataUpdatedAt > evidenceFreshnessMs
  );
  const unavailable = !data || query.isError || stale;
  const busy = update.isPending || reviewing;
  const staleReview =
    reviewChanged ||
    Boolean(
      review && data && pipelineReviewKey(review) !== pipelineReviewKey(data)
    );

  useEffect(() => {
    const refreshClock = () => setNow(Date.now());
    const timer = setInterval(refreshClock, 15_000);
    document.addEventListener('visibilitychange', refreshClock);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshClock);
    };
  }, []);

  const state = unavailable
    ? query.isPending
      ? t('Checking status…', 'جارٍ التحقق من الحالة…')
      : t('Status unavailable', 'الحالة غير متاحة')
    : pipelineState(data, locale);
  const scope = (
    <>
      <span className="capitalize">
        {data?.environment ||
          t('Environment not reported', 'البيئة غير مسجّلة')}
      </span>
      {data && (
        <>
          {' '}
          · {t('Tenant', 'المستأجر')}:{' '}
          <bdi className="break-all">{data.tenant_id}</bdi>
        </>
      )}{' '}
      · {t('All Pods in this tenant', 'جميع بودز لهذا المستأجر')}
    </>
  );
  const refresh = () => {
    update.reset();
    void query.refetch();
  };

  const openReview = async () => {
    if (actionPending.current || busy) return;
    actionPending.current = true;
    setReviewing(true);
    update.reset();
    try {
      const current = await query.refetch();
      if (
        !current.isError &&
        current.data?.paused &&
        current.data.can_manage &&
        current.data.ready
      ) {
        setReview(current.data);
        setReviewChanged(false);
      }
    } finally {
      actionPending.current = false;
      setReviewing(false);
    }
  };

  const apply = async (paused: boolean) => {
    if (
      actionPending.current ||
      busy ||
      unavailable ||
      !data?.can_manage ||
      (!paused && !review)
    )
      return;
    actionPending.current = true;
    try {
      if (!paused) {
        setReviewing(true);
        const latest = await query.refetch();
        if (
          latest.isError ||
          !latest.data ||
          pipelineReviewKey(latest.data) !== pipelineReviewKey(review!)
        ) {
          setReviewChanged(true);
          return;
        }
      }
      await update.mutateAsync({
        paused,
        version: paused ? data.version : review!.version,
      });
      setReview(null);
    } catch {
      /* The mutation retains its error and the last confirmed owner state. */
    } finally {
      actionPending.current = false;
      setReviewing(false);
    }
  };

  const errorText =
    update.error &&
    typeof update.error === 'object' &&
    'message' in update.error
      ? String(update.error.message)
      : t(
          'The change could not be confirmed. Refresh status before trying again.',
          'تعذّر تأكيد التغيير. حدّث الحالة قبل المحاولة مجدداً.'
        );
  const primary = compact ? (
    <Link
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline sm:min-h-9"
      href={controlsHref}
    >
      {t('Pipeline controls', 'التحكم بالمسار')}
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
    </Link>
  ) : unavailable && !query.isPending ? (
    <Button ref={actionRef} size="sm" variant="outline" onClick={refresh}>
      {t('Refresh status', 'تحديث الحالة')}
    </Button>
  ) : data?.paused && !data.ready ? (
    <Button size="sm" variant="outline" render={<Link href="/platform/system-health">
        {t('Review setup', 'مراجعة الإعداد')}
      </Link>} />
  ) : (
    <Button
      ref={actionRef}
      size="sm"
      variant={data?.paused ? 'default' : 'outline'}
      aria-describedby="pods-pipeline-scope"
      className="min-h-11 sm:min-h-9"
      disabled={unavailable || busy || !data?.can_manage}
      onClick={() => (data?.paused ? void openReview() : void apply(true))}
    >
      {busy || query.isPending ? (
        <Loader2 aria-hidden="true" className="me-2 h-3.5 w-3.5 animate-spin" />
      ) : data?.paused ? (
        <Play aria-hidden="true" className="me-2 h-3.5 w-3.5" />
      ) : (
        <Pause aria-hidden="true" className="me-2 h-3.5 w-3.5" />
      )}
      {query.isPending
        ? t('Checking status…', 'جارٍ التحقق من الحالة…')
        : busy
          ? reviewing && !review
            ? t('Checking review…', 'جارٍ إعداد المراجعة…')
            : data?.paused
              ? t('Resuming…', 'جارٍ الاستئناف…')
              : t('Pausing…', 'جارٍ الإيقاف…')
          : data?.paused
            ? t('Resume pipeline', 'استئناف المسار')
            : t('Pause pipeline', 'إيقاف المسار مؤقتاً')}
    </Button>
  );

  return (
    <>
      {!compact && (
        <span id="pods-automation" className="sr-only" aria-hidden="true" />
      )}
      <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className={
          compact ? undefined : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_3rem]'
        }
      >
        {!compact && (
          <ActivityRail
            title={t('Pods pipeline activity', 'نشاط مسار بودز')}
            description={
              data
                ? [
                    data.environment,
                    `${t('Tenant', 'المستأجر')}: ${data.tenant_id}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t(
                    'Source requests and chapter publications',
                    'طلبات المصادر ونشر الفصول'
                  )
            }
            closeLabel={t('Close pipeline activity', 'إغلاق نشاط المسار')}
            triggerLabel={t('View activity', 'عرض النشاط')}
            toolsLabel={t('Pods tools', 'أدوات بودز')}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            <PodsPipelineActivity locale={locale} />
          </ActivityRail>
        )}
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <SystemControlStrip
            id={compact ? 'pods-pipeline-summary' : 'pods-pipeline'}
            compact={compact}
            name={t('Pods pipeline', 'مسار بودز')}
            state={state}
            scope={scope}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            tone={
              unavailable
                ? 'unavailable'
                : !data.ready
                  ? 'attention'
                  : !data.paused &&
                      (data.activity?.running_steps ||
                        data.activity?.running_source_runs)
                    ? 'active'
                    : 'neutral'
            }
            action={primary}
            summary={
              <>
                <p>
                  {unavailable
                    ? t(
                        'Confirm the current pipeline state before making a change.',
                        'تحقّق من حالة المسار الحالية قبل إجراء تغيير.'
                      )
                    : data.paused
                      ? t(
                          'New source runs, processing, and publication are held until resumed. Manual processing also waits.',
                          'طلبات المصادر الجديدة والمعالجة والنشر متوقفة حتى الاستئناف. المعالجة اليدوية تنتظر أيضاً.'
                        )
                      : t(
                          'Enabled sources can check for episodes. Processing and publication follow your saved policies.',
                          'يمكن للمصادر المفعّلة فحص الحلقات. تتبع المعالجة والنشر السياسات المحفوظة.'
                        )}
                </p>
                <p className="mt-1">
                  {t(
                    'Published Pods stay available. A step already executing may finish.',
                    'تبقى بودز المنشورة متاحة. قد تكتمل الخطوة الجاري تنفيذها.'
                  )}
                </p>
              </>
            }
            activity={
              unavailable ? (
                data ? (
                  `${t('Last confirmed', 'آخر حالة مؤكدة')}: ${pipelineState(data, locale)} · ${new Date(query.dataUpdatedAt).toLocaleTimeString(locale)}`
                ) : (
                  t('Activity not yet confirmed', 'حالة العمل غير مؤكدة بعد')
                )
              ) : (
                <>
                  {pipelineActivity(data, locale)}
                  <span className="ms-2 text-muted-foreground">
                    · {t('Sources enabled', 'المصادر المفعّلة')}:{' '}
                    {n(data.active_sources)} ·{' '}
                    {t('Queued steps', 'الخطوات المنتظرة')}:{' '}
                    {n(data.queued_steps)}
                  </span>
                </>
              )
            }
            links={
              <>
                <Link
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-9"
                  href="/platform/media/sources?tab=policy"
                >
                  {t('Settings', 'الإعدادات')}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {query.isFetching
                    ? t('Refreshing status…', 'جارٍ تحديث الحالة…')
                    : data
                      ? `${t('Last checked', 'آخر تحقق')}: ${new Date(query.dataUpdatedAt).toLocaleTimeString(locale)}`
                      : null}
                </span>
              </>
            }
          >
            {data && !data.can_manage && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  'View only. Your role cannot change this pipeline.',
                  'للعرض فقط. دورك لا يتيح تعديل هذا المسار.'
                )}
              </p>
            )}
            {data && !unavailable && !data.ready && (
              <p className="mt-2 text-sm text-warning">
                {t(
                  'Processing needs setup before this pipeline can resume.',
                  'تحتاج المعالجة إلى إعداد قبل استئناف المسار.'
                )}{' '}
                {!data.paused && (
                  <Link className="underline" href="/platform/system-health">
                    {t('Review setup', 'مراجعة الإعداد')}
                  </Link>
                )}
              </p>
            )}
            {update.isError && !review && (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-center gap-3 text-sm text-destructive"
              >
                <p>{errorText}</p>
                <Button variant="outline" size="sm" onClick={refresh}>
                  {t('Refresh status', 'تحديث الحالة')}
                </Button>
              </div>
            )}
            {data && (
              <details className="group mt-3 text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground sm:min-h-9">
                  {t('Policies and last change', 'السياسات وآخر تغيير')}
                  <ChevronDown
                    aria-hidden="true"
                    className="h-3.5 w-3.5 group-open:rotate-180"
                  />
                </summary>
                {unavailable && (
                  <p className="mt-2 text-xs text-warning">
                    {t(
                      'Last recorded settings; current values could not be confirmed.',
                      'آخر إعدادات مسجّلة؛ تعذّر تأكيد القيم الحالية.'
                    )}
                  </p>
                )}
                <dl className="mt-2 grid gap-4 border-t pt-4 sm:grid-cols-3">
                  <div>
                    <dt className="font-medium">
                      {t('Source checks', 'فحص المصادر')}
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      {t(
                        'Enabled sources follow their own schedules when this pipeline is resumed.',
                        'تتبع المصادر المفعّلة جداولها عند استئناف هذا المسار.'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t('Processing default', 'المعالجة الافتراضية')}
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      {data.processing_mode === 'automatic'
                        ? t('Automatic', 'تلقائية')
                        : t('By request', 'عند الطلب')}
                      {data.source_override_count != null &&
                        data.source_override_count > 0 &&
                        ` · ${t('Source exceptions', 'استثناءات المصادر')}: ${n(data.source_override_count)}`}
                    </dd>
                    <dd className="mt-1">
                      <Link
                        className="underline underline-offset-4"
                        href="/platform/media/sources?tab=policy"
                      >
                        {t('Processing settings', 'إعدادات المعالجة')}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t('Chapter publication default', 'نشر الفصول الافتراضي')}
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      {data.auto_publish
                        ? t(
                            'Automatic when eligible',
                            'تلقائي عند استيفاء الشروط'
                          )
                        : t('Review required', 'تتطلب المراجعة')}
                      .{' '}
                      {t(
                        'Source and episode overrides apply.',
                        'تُطبّق استثناءات المصدر والحلقة.'
                      )}
                    </dd>
                    <dd className="mt-1">
                      <Link
                        className="underline underline-offset-4"
                        href="/platform/media/atomization?tab=policy"
                      >
                        {t('Publishing settings', 'إعدادات النشر')}
                      </Link>
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t(
                    'This pipeline pause takes precedence over source settings. News and source discovery are controlled separately. Other budget, readiness, and safety restrictions still apply after resume.',
                    'يتقدم إيقاف المسار على إعدادات المصادر. للأخبار واكتشاف المصادر ضوابط مستقلة. تبقى قيود الميزانية والجاهزية والسلامة سارية بعد الاستئناف.'
                  )}
                </p>
                {data.updated_by ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('Last saved by', 'آخر حفظ بواسطة')}{' '}
                    <bdi>{data.updated_by}</bdi> ·{' '}
                    <time dateTime={data.updated_at}>
                      {new Date(data.updated_at).toLocaleString(locale)}
                    </time>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(
                      'No control change has been recorded.',
                      'لم يُسجّل تغيير لضابط المسار.'
                    )}
                  </p>
                )}
                {data.paused && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      'Pause duration: Until resumed',
                      'مدة الإيقاف: حتى الاستئناف'
                    )}
                  </p>
                )}
              </details>
            )}
          </SystemControlStrip>
        </div>
      </div>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setReview(null);
            update.reset();
          }
        }}
      >
        <DialogContent
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t('Close pipeline review', 'إغلاق مراجعة المسار')}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-[460px] [&>button:last-child]:rtl:left-4 [&>button:last-child]:rtl:right-auto"
          finalFocus={actionRef}
        >
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>
              {t('Resume Pods pipeline?', 'استئناف مسار بودز؟')}
            </DialogTitle>
            <DialogDescription>
              <span className="capitalize">{review?.environment}</span> ·{' '}
              {t('Tenant', 'المستأجر')}: <bdi>{review?.tenant_id}</bdi> ·{' '}
              {t('All Pods', 'جميع بودز')}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-3 text-sm">
              <p>
                {n(review.active_sources)}{' '}
                {t(
                  'enabled sources can run again.',
                  'مصادر مفعّلة يمكنها العمل مجدداً.'
                )}{' '}
                {n(review.queued_steps)}{' '}
                {t(
                  'queued processing steps can continue. Manual processing becomes available.',
                  'خطوات معالجة منتظرة يمكنها الاستمرار. تصبح المعالجة اليدوية متاحة.'
                )}
              </p>
              <p className="text-muted-foreground">
                {review.processing_mode === 'automatic'
                  ? t(
                      'Episodes can download and process automatically.',
                      'يمكن تنزيل الحلقات ومعالجتها تلقائياً.'
                    )
                  : t(
                      'Episodes follow the By request default and any source exceptions.',
                      'تتبع الحلقات الإعداد الافتراضي عند الطلب واستثناءات المصادر.'
                    )}{' '}
                {review.auto_publish
                  ? t(
                      'Eligible chapters may publish without another confirmation.',
                      'قد تُنشر الفصول المستوفية للشروط دون تأكيد آخر.'
                    )
                  : t(
                      'Publication follows the review default and any source or episode exceptions.',
                      'يتبع النشر إعداد المراجعة الافتراضي واستثناءات المصادر أو الحلقات.'
                    )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  'Source selections and saved policies are preserved. Independent restrictions remain in force.',
                  'تُحفظ اختيارات المصادر والسياسات. تبقى القيود المستقلة سارية.'
                )}
              </p>
              {staleReview && (
                <p role="alert" className="text-sm text-destructive">
                  {t(
                    'Scope or settings changed. Refresh this review before resuming.',
                    'تغيّر النطاق أو الإعدادات. حدّث المراجعة قبل الاستئناف.'
                  )}
                </p>
              )}
              {data && !data.can_manage && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Your role now allows viewing only. This review cannot resume the pipeline.',
                    'أصبح دورك يتيح العرض فقط. لا يمكن استئناف المسار من هذه المراجعة.'
                  )}
                </p>
              )}
              {data && !data.ready && (
                <p className="text-sm text-warning">
                  {t(
                    'Processing needs setup before this pipeline can resume.',
                    'تحتاج المعالجة إلى إعداد قبل استئناف المسار.'
                  )}
                </p>
              )}
              {data && !data.paused && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'The pipeline is already resumed. Close this review to see its current state.',
                    'المسار مستأنف بالفعل. أغلق المراجعة لرؤية حالته الحالية.'
                  )}
                </p>
              )}
              {update.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorText}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setReview(null);
                update.reset();
              }}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            {data && !unavailable && !data.ready ? (
              <Button variant="outline" render={<Link href="/platform/system-health">
                  {t('Review setup', 'مراجعة الإعداد')}
                </Link>} />
            ) : staleReview || unavailable ? (
              <Button
                disabled={
                  busy || Boolean(data && (!data.can_manage || !data.paused))
                }
                onClick={() => void openReview()}
              >
                {t('Refresh review', 'تحديث المراجعة')}
              </Button>
            ) : (
              <Button
                disabled={
                  busy || !data?.ready || !data.can_manage || !data.paused
                }
                onClick={() => void apply(false)}
              >
                {busy && (
                  <Loader2
                    aria-hidden="true"
                    className="me-2 h-4 w-4 animate-spin"
                  />
                )}
                {t('Resume pipeline', 'استئناف المسار')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
