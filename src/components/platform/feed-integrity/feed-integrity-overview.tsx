'use client';

import { ArrowRight, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  FeedIntegrityObservation,
  FeedIntegrityStatus,
} from '@/types/platform/feed-integrity';
import {
  checkTitle,
  checkName,
  reasonLabel,
  feedName,
  groupObservations,
  incomplete,
  problem,
  stateLabel,
  tone,
  translate,
  variantLabel,
  type IntegrityLocale,
} from './presentation';

export function IntegrityTime({
  value,
  locale,
}: {
  value?: string | null;
  locale: IntegrityLocale;
}) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return <span>{translate(locale, 'Not recorded', 'غير مسجل')}</span>;
  const date = new Date(value);
  const age = (date.getTime() - Date.now()) / 1000;
  const unit =
    Math.abs(age) < 3600 ? 'minute' : Math.abs(age) < 86400 ? 'hour' : 'day';
  const amount = Math.round(
    age / (unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400)
  );
  return (
    <time dateTime={value} title={date.toLocaleString(locale)}>
      <bdi>
        {new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
          amount,
          unit
        )}
      </bdi>
    </time>
  );
}

export function ObservationRows({
  observations,
  locale,
}: {
  observations: FeedIntegrityObservation[];
  locale: IntegrityLocale;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  return (
    <div className="divide-y">
      {observations.map((o) => (
        <div
          key={`${o.check_key}:${o.feed}:${o.variant}`}
          className="space-y-1.5 py-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {feedName(o.feed, locale)} ·{' '}
              <bdi>{variantLabel(o.variant, locale)}</bdi>
            </span>
            <Badge variant={o.stale ? 'secondary' : tone(o.outcome)}>
              {o.stale
                ? t('Older evidence', 'أدلة سابقة')
                : stateLabel(o.outcome, locale)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <bdi className="tabular-nums">
              {o.sample_count} / {o.candidate_count}
            </bdi>{' '}
            {t('targets checked', 'هدف مفحوص')} ·{' '}
            {o.coverage === 'exhaustive'
              ? t('All eligible targets', 'جميع الأهداف المؤهلة')
              : t('Sampled', 'عينة')}
            {o.affected_count > 0 ? (
              <>
                {' '}
                · <bdi className="tabular-nums">{o.affected_count}</bdi>{' '}
                {t('failed this check', 'لم يجتز هذا الفحص')}
              </>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('Observed', 'رُصد')}{' '}
            <IntegrityTime value={o.observed_at} locale={locale} />
            {o.reason ? ` · ${reasonLabel(o.reason, locale)}` : null}
          </p>
          {o.last_known ? (
            <p className="text-xs text-muted-foreground">
              {t('Previous result', 'النتيجة السابقة')}:{' '}
              {stateLabel(o.last_known.outcome, locale)} ·{' '}
              <IntegrityTime value={o.last_known.observed_at} locale={locale} />
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function FeedSummary({
  feed,
  data,
  locale,
  onReview,
  unavailable,
}: {
  feed: 'pods' | 'news';
  data?: FeedIntegrityStatus;
  locale: IntegrityLocale;
  onReview: () => void;
  unavailable: boolean;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const all = (data?.current_observations || []).filter((o) => o.feed === feed);
  const fresh = all.filter((o) => !o.stale);
  const failures = groupObservations(fresh.filter(problem));
  const gaps = all.filter(incomplete);
  const timedOut = fresh.some(
    (o) => o.reason === 'response_timeout' && o.outcome === 'check_error'
  );
  const inventory = fresh.filter((o) => o.check_key.startsWith('inv_'));
  const inventoryPassed =
    inventory.length > 0 &&
    inventory.every(
      (o) => o.outcome === 'pass' || o.outcome === 'skipped:not_applicable'
    );
  const previous = (data?.open_episodes || []).filter((ep) => ep.feed === feed);
  const healthy =
    data?.current_feed_results?.[feed]?.consumer_verdict === 'healthy' &&
    !gaps.length &&
    all.length > 0;
  const label = unavailable
    ? t('Status unavailable', 'الحالة غير متاحة')
    : failures.length
      ? t('Problems found', 'مشكلات مرصودة')
      : healthy
        ? t('Checks passed', 'اجتازت الفحوصات')
        : t('Not fully verified', 'لم يُتحقق بالكامل');
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          {feedName(feed, locale)}
          <Badge
            variant={
              unavailable
                ? 'secondary'
                : failures.length
                  ? 'warning'
                  : healthy
                    ? 'success'
                    : 'secondary'
            }
          >
            {label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-0">
        <div className="space-y-1 text-sm">
          {failures.length ? (
            failures.slice(0, 2).map((rows) => (
              <p key={rows[0].check_key} className="font-medium">
                {checkTitle(rows[0].check_key, locale)}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">
              {!all.length
                ? t(
                    'Run a check to collect evidence.',
                    'شغّل فحصًا لجمع الأدلة.'
                  )
                : healthy
                  ? t('The recorded checks passed.', 'اجتازت الفحوصات المسجلة.')
                  : t(
                      'Available evidence does not establish feed health.',
                      'الأدلة المتاحة لا تثبت سلامة الخلاصة.'
                    )}
            </p>
          )}
          {failures.length > 2 ? (
            <p className="text-xs text-muted-foreground">
              +{failures.length - 2}{' '}
              {t(
                'other check types with problems',
                'أنواع فحوصات أخرى رصدت مشكلات'
              )}
            </p>
          ) : null}
          {previous.length ? (
            <p className="text-xs text-muted-foreground">
              {previous.length}{' '}
              {t('unresolved issue scopes', 'نطاقات مشكلات غير مغلقة')}
            </p>
          ) : null}
        </div>
        {gaps.length ? (
          <div className="flex items-start gap-2 border-t pt-3 text-sm">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {t('Check incomplete', 'الفحص غير مكتمل')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {timedOut
                  ? t(
                      'Feed responses timed out. Checks that depend on those responses could not finish.',
                      'انتهت مهلة استجابات الخلاصة. تعذر إكمال الفحوصات المعتمدة على تلك الاستجابات.'
                    )
                  : t(
                      'Some checks were skipped, could not verify their targets, or have older evidence.',
                      'بعض الفحوصات لم تُنفذ أو تعذر التحقق من أهدافها أو تستند إلى أدلة سابقة.'
                    )}
              </p>
            </div>
          </div>
        ) : null}
        {inventoryPassed && !unavailable ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            {t('Inventory rules passed', 'اجتازت قواعد المخزون')}
          </p>
        ) : null}
        <div className="mt-auto flex justify-end">
          <Button variant="outline" size="sm" onClick={onReview}>
            {t('Review issues', 'مراجعة المشكلات')}
            <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AttentionSummary({
  data,
  locale,
  onInspect,
  onAll,
}: {
  data?: FeedIntegrityStatus;
  locale: IntegrityLocale;
  onInspect: (key: string, feed: string) => void;
  onAll: () => void;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const groups = groupObservations(
    (data?.current_observations || []).filter(problem)
  );
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-5 pb-3">
        <CardTitle className="text-base">
          {t('Needs attention', 'يحتاج إلى متابعة')}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onAll}>
          {t('View all issues', 'عرض جميع المشكلات')}
          <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {groups.slice(0, 5).map((rows) => (
            <button
              key={`${rows[0].check_key}:${rows[0].feed}`}
              className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onInspect(rows[0].check_key, rows[0].feed)}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {checkTitle(rows[0].check_key, locale)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {feedName(rows[0].feed, locale)} · {rows.length}{' '}
                  {t('feed variants with evidence', 'متغيرات خلاصة لها أدلة')}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </button>
          ))}
        </div>
        {!groups.length ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            {data?.current_observations?.length
              ? t(
                  'No fresh problem observations. Review unresolved issues and coverage before drawing a conclusion.',
                  'لا توجد مشكلات في الأدلة الحديثة. راجع المشكلات غير المغلقة والتغطية قبل الاستنتاج.'
                )
              : t('No observations recorded yet.', 'لا توجد نتائج مسجلة بعد.')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CoverageSummary({
  data,
  locale,
}: {
  data?: FeedIntegrityStatus;
  locale: IntegrityLocale;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const observations = data?.current_observations || [];
  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base">
          {t('Check coverage', 'تغطية الفحوصات')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t(
            'Counts describe check variants and targets, not users affected. Targets may appear in several checks.',
            'الأعداد تخص متغيرات الفحوصات والأهداف، ولا تمثل المستخدمين المتأثرين. قد يظهر الهدف في عدة فحوصات.'
          )}
        </p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              prefix: 'inv_',
              title: t('Inventory', 'المخزون'),
              description: t(
                'Eligibility and metadata rules',
                'قواعد الأهلية والبيانات'
              ),
            },
            {
              prefix: 'edge_',
              title: t('Feed responses', 'استجابات الخلاصة'),
              description: t(
                'Responses, pages and pagination',
                'الاستجابات والصفحات والتنقل'
              ),
            },
            {
              prefix: 'probe_',
              title: t('Media URLs', 'روابط الوسائط'),
              description: t(
                'Sampled playback and artwork',
                'عينات التشغيل وصور الغلاف'
              ),
            },
          ].map((area) => {
            const rows = observations.filter((o) =>
              o.check_key.startsWith(area.prefix)
            );
            const gaps = rows.filter(incomplete).length;
            const notApplicable = rows.filter(
              (o) => !o.stale && o.outcome === 'skipped:not_applicable'
            ).length;
            const completed = rows.filter(
              (o) => !incomplete(o) && o.outcome !== 'skipped:not_applicable'
            ).length;
            return (
              <div key={area.prefix} className="min-w-0 space-y-1 text-sm">
                <p className="font-medium">{area.title}</p>
                <p className="text-xs text-muted-foreground">
                  {area.description}
                </p>
                <p className="pt-1 tabular-nums">
                  {rows.length ? (
                    <>
                      {completed} / {rows.length}{' '}
                      {t('check variants completed', 'متغير فحص مكتمل')}
                    </>
                  ) : (
                    t('Not checked', 'لم يُفحص')
                  )}
                </p>
                {notApplicable > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {notApplicable} {t('not applicable', 'غير منطبق')}
                  </p>
                ) : null}
                {gaps > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {gaps}{' '}
                    {t(
                      'incomplete or older results',
                      'نتائج غير مكتملة أو سابقة'
                    )}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {observations.length ? (
          <details className="mt-4 border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t('Inspect all check results', 'فحص جميع النتائج')}
            </summary>
            <div className="mt-3 space-y-1">
              {groupObservations(observations).map((rows) => (
                <details
                  key={`${rows[0].check_key}:${rows[0].feed}`}
                  className="border-b py-2 text-sm"
                >
                  <summary className="cursor-pointer">
                    {checkName(rows[0].check_key, locale)} ·{' '}
                    {feedName(rows[0].feed, locale)}{' '}
                    <span className="text-muted-foreground">
                      ({rows.length})
                    </span>
                  </summary>
                  <ObservationRows observations={rows} locale={locale} />
                </details>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
