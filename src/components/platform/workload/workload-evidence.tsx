'use client';
import type {
  WorkloadCoverage,
  WorkloadPage,
  WorkloadQualification,
  WorkloadRegistry,
  WorkloadSnapshot,
} from '@/types/platform/workload';
import { ChevronDown, Circle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkloadCorrelations } from './workload-correlations';
import {
  copy,
  EmptyWorkload,
  errorMessage,
  inputClass,
  name,
  observedResourceState,
  WorkloadNotice,
  WorkloadPanel,
  WorkloadState,
  WorkloadTime,
  type WorkloadLocale,
} from './presentation';
export interface WorkloadQuery<T> {
  data?: T;
  isPending?: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => unknown;
}

export function QualificationEvidence({
  query,
  locale,
}: {
  query: WorkloadQuery<WorkloadQualification>;
  locale: WorkloadLocale;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const data = query.data;
  const ready = query.isError
    ? 0
    : (data?.classes.filter((item) => item.eligible).length ?? 0);
  return (
    <WorkloadPanel
      title={t('Before you enforce', 'قبل تطبيق الحدود')}
      description={t(
        'Review each work class separately. Nothing is enabled automatically.',
        'راجع كل فئة عمل على حدة. لا يُفعّل أي شيء تلقائيًا.'
      )}
      action={
        ready > 0 && !query.isError ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/platform/workload?tab=settings${locale === 'ar' ? '&locale=ar' : ''}`}
            >
              {t('Review settings', 'مراجعة الإعدادات')}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {query.isError && (
        <WorkloadNotice
          locale={locale}
          title={t('Qualification unavailable', 'جاهزية التطبيق غير متاحة')}
          retry={() => query.refetch()}
        >
          {errorMessage(query.error)}
        </WorkloadNotice>
      )}
      {query.isPending && !data ? (
        <Skeleton className="h-40" />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-5 rounded-md border bg-muted/20 p-4 sm:grid-cols-[minmax(11rem,1fr)_minmax(0,2fr)] sm:p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('Ready for your review', 'جاهزة لمراجعتك')}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {query.isError ? '—' : ready}
                <span className="ms-1.5 text-base font-normal text-muted-foreground">
                  / {data.classes.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'work classes meet the evidence gate',
                  'فئات تستوفي شروط الأدلة'
                )}
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium">
                {t(
                  'Minimum evidence for each class',
                  'الحد الأدنى من الأدلة لكل فئة'
                )}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="border-s-2 ps-3">
                  <p className="text-lg font-semibold tabular-nums">
                    {data.required_hours.toLocaleString(locale)}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {t('hours', 'ساعة')}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('in Observe', 'في وضع المراقبة')}
                  </p>
                </div>
                <div className="border-s-2 ps-3">
                  <p className="text-lg font-semibold tabular-nums">
                    {data.required_requests.toLocaleString(locale)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('requests', 'طلبًا')}
                  </p>
                </div>
                <div className="border-s-2 ps-3">
                  <p className="text-lg font-semibold tabular-nums">5</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('verified completions', 'عمليات مكتملة ومثبتة')}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  'Every caller must be exercised, resources must be current, and uncertain work must be resolved.',
                  'يجب أن تُستخدم جميع الجهات الطالبة، وأن تكون قراءات الموارد حديثة، وأن تُحسم الأعمال غير المؤكدة.'
                )}
              </p>
            </div>
          </div>
          {data.classes.length ? (
            <div className="overflow-hidden rounded-md border">
              <div className="hidden grid-cols-[minmax(12rem,1.4fr)_10rem_minmax(14rem,1fr)_1.5rem] items-center gap-4 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-medium text-muted-foreground lg:grid">
                <span>{t('Work class', 'فئة العمل')}</span>
                <span>{t('Readiness', 'الجاهزية')}</span>
                <span>
                  {t(
                    'Observed / Requests / Completed',
                    'المراقبة / الطلبات / الاكتمال'
                  )}
                </span>
                <span />
              </div>
              {data.classes.map((item) => {
                const observedHours = item.first_observed_at
                  ? Math.max(
                      0,
                      (Date.parse(data.window_end) -
                        Date.parse(item.first_observed_at)) /
                        3_600_000
                    )
                  : 0;
                return (
                  <details
                    key={item.class}
                    className="group/class border-b last:border-b-0"
                  >
                    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(12rem,1.4fr)_10rem_minmax(14rem,1fr)_1.5rem] lg:gap-4 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 text-sm font-medium">
                        {name(item.class, locale)}
                      </span>
                      <span className="flex items-center justify-end gap-2 lg:justify-start">
                        <WorkloadState
                          locale={locale}
                          value={
                            query.isError
                              ? 'unknown'
                              : item.eligible
                                ? 'ready'
                                : 'not_ready'
                          }
                        />
                        <ChevronDown
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/class:rotate-180 motion-reduce:transition-none lg:hidden"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="col-span-2 grid grid-cols-3 gap-3 text-xs lg:col-span-1">
                        <span>
                          <span className="font-semibold tabular-nums">
                            {Math.floor(observedHours).toLocaleString(locale)}
                          </span>
                          <span className="text-muted-foreground">
                            {' '}
                            / {data.required_hours} {t('h', 'س')}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground lg:sr-only">
                            {t('Observed', 'مدة المراقبة')}
                          </span>
                        </span>
                        <span>
                          <span className="font-semibold tabular-nums">
                            {item.requests.toLocaleString(locale)}
                          </span>
                          <span className="text-muted-foreground">
                            {' '}
                            / {data.required_requests}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground lg:sr-only">
                            {t('Requests', 'الطلبات')}
                          </span>
                        </span>
                        <span>
                          <span className="font-semibold tabular-nums">
                            {item.settled.toLocaleString(locale)}
                          </span>
                          <span className="text-muted-foreground"> / 5</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground lg:sr-only">
                            {t('Completed', 'المكتملة')}
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        className="hidden h-4 w-4 text-muted-foreground transition-transform group-open/class:rotate-180 motion-reduce:transition-none lg:block"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="space-y-4 border-t bg-muted/20 p-4">
                      {item.missing.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold">
                            {t('Still needed', 'المتبقي')}
                          </p>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {item.missing.map((reason) => (
                              <li
                                key={reason}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                              >
                                <Circle
                                  className="mt-0.5 h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{name(reason, locale)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs">
                          {t(
                            'Evidence requirements are met. Review service and delivery health before enabling this class in Settings.',
                            'استُوفيت متطلبات الأدلة. راجع صحة الخدمات والتسليم قبل تفعيل هذه الفئة من الإعدادات.'
                          )}
                        </p>
                      )}
                      {!!item.callers?.length && (
                        <div>
                          <p className="mb-2 text-xs font-semibold">
                            {t('Caller evidence', 'أدلة الجهات الطالبة')}
                          </p>
                          <ul className="space-y-2">
                            {item.callers.map((caller) => (
                              <li
                                key={caller.system}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <span>{name(caller.system, locale)}</span>
                                <span className="text-muted-foreground">
                                  {caller.requests.toLocaleString(locale)}{' '}
                                  {t('requests', 'طلبات')} ·{' '}
                                  {t(
                                    caller.observed
                                      ? 'Recorded'
                                      : 'Not exercised',
                                    caller.observed ? 'مسجلة' : 'لم يُستخدم'
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
                        <span>
                          {t('Would delay', 'تأجيل افتراضي')}:{' '}
                          {item.would_defer}
                        </span>
                        <span>
                          {t('Unresolved', 'غير محسومة')}: {item.unresolved}
                        </span>
                        <span>
                          {t('Unavailable decisions', 'قرارات دون أدلة')}:{' '}
                          {item.unavailable}
                        </span>
                        <span>
                          {t(
                            'Mean verified completion',
                            'متوسط الاكتمال المثبت'
                          )}
                          : {item.mean_completion_seconds?.toFixed(1) ?? '—'}{' '}
                          {t('s', 'ث')}
                        </span>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyWorkload locale={locale} />
          )}
          <details className="text-xs text-muted-foreground">
            <summary className="min-h-8 cursor-pointer">
              {t(
                'Review window and exact evidence',
                'فترة المراجعة والأدلة الدقيقة'
              )}
            </summary>
            <div className="mt-2 space-y-3">
              <p>
                {t('Observation window', 'فترة المراقبة')}:{' '}
                <WorkloadTime value={data.window_start} locale={locale} /> —{' '}
                <WorkloadTime value={data.window_end} locale={locale} />
              </p>
              <p>
                {t('Fresh resource observations', 'قراءات الموارد الحديثة')}:{' '}
                {data.fresh_resources}/{data.total_resources}
              </p>
              <ul className="list-inside list-disc space-y-1">
                {data.evidence.map((item, index) => (
                  <li key={index} dir="auto">
                    {name(item, locale)}
                  </li>
                ))}
              </ul>
              <code className="block break-all" dir="ltr">
                {data.digest}
              </code>
              <p>
                {t(
                  'Qualification authorizes a human review. It does not enable enforcement or establish consumer delivery health.',
                  'تتيح الجاهزية المراجعة البشرية. ولا تفعّل التطبيق أو تثبت سلامة التسليم للمستخدمين.'
                )}
              </p>
            </div>
          </details>
        </div>
      ) : null}
    </WorkloadPanel>
  );
}
export function WorkloadEvidence({
  locale,
  qualification,
  registry,
  snapshots,
  resource,
  selectResource,
  coverage,
}: {
  locale: WorkloadLocale;
  qualification: WorkloadQuery<WorkloadQualification>;
  registry: WorkloadQuery<WorkloadRegistry>;
  snapshots: WorkloadQuery<WorkloadPage<WorkloadSnapshot>>;
  resource: string;
  selectResource: (key: string) => void;
  coverage?: WorkloadCoverage[];
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  return (
    <div className="space-y-5">
      <QualificationEvidence query={qualification} locale={locale} />
      <details className="group/diagnostics rounded-lg border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {t('Coverage, history & diagnostics', 'التغطية والسجل والتشخيص')}
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform group-open/diagnostics:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-4 border-t p-3 sm:p-4">
          <WorkloadCorrelations query={qualification} locale={locale} />
          <WorkloadPanel
            title={t('Capacity history', 'سجل السعة')}
            description={t(
              'Recorded observations are historical evidence. Missing or failed readings are never zero load.',
              'القياسات المسجلة أدلة تاريخية. القراءات المفقودة أو الفاشلة لا تعني انعدام الحمل.'
            )}
          >
            <label className="block max-w-sm space-y-1 text-sm">
              <span>{t('Resource', 'المورد')}</span>
              <select
                className={inputClass}
                value={resource}
                onChange={(e) => selectResource(e.target.value)}
              >
                <option value="">{t('All resources', 'جميع الموارد')}</option>
                {registry.data?.resources.map((item) => (
                  <option key={item.key} value={item.key}>
                    {name(item.key, locale)}
                  </option>
                ))}
              </select>
            </label>
            {snapshots.isError && (
              <WorkloadNotice
                locale={locale}
                title={t('Capacity history unavailable', 'سجل السعة غير متاح')}
                retry={() => snapshots.refetch()}
              >
                {errorMessage(snapshots.error)}
              </WorkloadNotice>
            )}
            {snapshots.isPending && !snapshots.data ? (
              <Skeleton className="h-40" />
            ) : snapshots.data?.data.length ? (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    {t('Recent resource observations', 'أحدث قياسات الموارد')}
                  </caption>
                  <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground">
                    <tr>
                      {[
                        t('Observed', 'وقت الرصد'),
                        t('Resource', 'المورد'),
                        t('State', 'الحالة'),
                        t('Native pressure', 'الحمل المحلي'),
                      ].map((h) => (
                        <th
                          className="px-2 py-3 text-start font-medium"
                          scope="col"
                          key={h}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.data.data
                      .filter((item) => !resource || item.resource === resource)
                      .map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="whitespace-nowrap px-2 py-3 text-xs">
                            <WorkloadTime
                              value={item.observed_at}
                              locale={locale}
                            />
                          </td>
                          <th
                            scope="row"
                            className="px-2 py-3 text-start font-medium"
                          >
                            {name(item.resource, locale)}
                          </th>
                          <td className="px-2 py-3">
                            <WorkloadState
                              value={observedResourceState(item)}
                              locale={locale}
                            />
                          </td>
                          <td className="px-2 py-3 tabular-nums">
                            {item.available ? item.pressure : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !snapshots.isError && <EmptyWorkload locale={locale} />
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                'Showing up to 100 recent observations. Use the resource filter to inspect its latest history.',
                'تُعرض أحدث ١٠٠ ملاحظة كحد أقصى. استخدم مرشح المورد لمراجعة أحدث سجله.'
              )}
            </p>
          </WorkloadPanel>
          <WorkloadPanel
            title={t('Execution coverage', 'تغطية مسارات التنفيذ')}
            description={t(
              'Registration describes the intended boundary. Recorded caller requests show runtime use; they do not prove completion or consumer delivery.',
              'يصف التسجيل مسار التنفيذ المحدد. تثبت طلبات الجهات المسجلة الاستخدام الفعلي، ولا تثبت اكتمال التنفيذ أو التسليم للمستخدمين.'
            )}
          >
            {registry.isError && (
              <WorkloadNotice
                locale={locale}
                title={t(
                  'Coverage registry unavailable',
                  'سجل التغطية غير متاح'
                )}
                retry={() => registry.refetch()}
              >
                {errorMessage(registry.error)}
              </WorkloadNotice>
            )}
            {registry.isPending && !registry.data ? (
              <Skeleton className="h-32" />
            ) : registry.data ? (
              <div className="divide-y">
                {registry.data.coverage.map((item) => {
                  const runtime = coverage?.find(
                    (caller) => caller.system === item.system
                  );
                  return (
                    <details key={item.system} className="py-3">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {name(item.system, locale)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {name(item.relationship, locale)}
                        </span>
                        {['governed', 'delegated'].includes(
                          item.relationship
                        ) && (
                          <WorkloadState
                            locale={locale}
                            value={
                              !runtime
                                ? 'unknown'
                                : runtime.runtime_observed
                                  ? 'observed'
                                  : 'not_exercised'
                            }
                          />
                        )}
                      </summary>
                      <div className="mt-3 space-y-2 text-xs">
                        <p>
                          {item.classes.length
                            ? item.classes
                                .map((key) => name(key, locale))
                                .join(' · ')
                            : t('No admission class', 'دون فئة قبول')}
                        </p>
                        {['governed', 'delegated'].includes(
                          item.relationship
                        ) && (
                          <p className="text-muted-foreground">
                            {runtime ? (
                              <>
                                {runtime.requests_24h ?? 0}{' '}
                                {t(
                                  'requests in 24 hours',
                                  'طلبًا خلال ٢٤ ساعة'
                                )}{' '}
                                ·{' '}
                                <WorkloadTime
                                  value={runtime.last_requested_at}
                                  locale={locale}
                                />
                              </>
                            ) : (
                              t(
                                'Runtime coverage is unavailable.',
                                'تغطية التنفيذ الفعلية غير متاحة.'
                              )
                            )}
                          </p>
                        )}
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">
                            {t(
                              'Native execution boundary',
                              'مسار التنفيذ لدى الجهة المسؤولة'
                            )}
                          </summary>
                          <p className="text-muted-foreground" dir="auto">
                            {item.boundary}
                          </p>
                          <p className="text-muted-foreground" dir="auto">
                            {item.reason}
                          </p>
                        </details>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : null}
          </WorkloadPanel>
        </div>
      </details>
    </div>
  );
}
