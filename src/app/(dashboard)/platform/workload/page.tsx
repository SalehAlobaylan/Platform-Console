'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Gauge,
  Globe2,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import * as hooks from '@/hooks/use-workload';
import {
  copy,
  errorMessage,
  WorkloadNotice,
  WorkloadState,
  WorkloadTime,
  type WorkloadLocale,
} from '@/components/platform/workload/presentation';
import { WorkloadOverview } from '@/components/platform/workload/workload-overview';
import { WorkloadEvidence } from '@/components/platform/workload/workload-evidence';
import { WorkloadActivity } from '@/components/platform/workload/workload-activity';
import { WorkloadSettings } from '@/components/platform/workload/workload-settings';

const views = ['overview', 'evidence', 'activity', 'settings'] as const;
function WorkloadLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workload evidence"
      className="space-y-4"
    >
      <Skeleton className="h-40" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
function WorkloadWorkspace() {
  const search = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const admin = user?.role?.toLowerCase() === 'admin';
  const view = views.find((item) => item === search.get('tab')) || 'overview';
  const locale: WorkloadLocale = search.get('locale') === 'ar' ? 'ar' : 'en';
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [, setClockTick] = useState(0);
  // Polling can deliver newer evidence between timer ticks. Compare it with
  // the current render time, not the timestamp retained by the last tick.
  const now = Date.now();
  useEffect(() => {
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 15_000);
    return () => clearInterval(timer);
  }, []);
  const navigate = (patch: Record<string, string>) => {
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (
        value &&
        !(key === 'tab' && value === 'overview') &&
        !(key === 'locale' && value === 'en')
      )
        params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(`/platform/workload${query ? `?${query}` : ''}`, {
      scroll: false,
    });
  };
  const status = hooks.useWorkloadStatus(admin);
  const registry = hooks.useWorkloadRegistry(admin && view !== 'overview');
  const qualification = hooks.useWorkloadQualification(
    admin && ['evidence', 'settings'].includes(view)
  );
  const classFilter = search.get('class') || '';
  const verdictFilter = search.get('verdict') || '';
  const stateFilter = search.get('state') || '';
  const resource = search.get('resource') || '';
  const history = search.get('history') === 'permits' ? 'permits' : 'decisions';
  const decisions = hooks.useWorkloadDecisions(
    {
      class: classFilter || undefined,
      verdict: verdictFilter || undefined,
      before: search.get('decisions_before') || undefined,
      limit: 50,
    },
    admin && view === 'activity' && history === 'decisions'
  );
  const permits = hooks.useWorkloadPermits(
    {
      class: classFilter || undefined,
      state: stateFilter || undefined,
      before: search.get('permits_before') || undefined,
      limit: 50,
    },
    admin && view === 'activity' && history === 'permits'
  );
  const snapshots = hooks.useWorkloadSnapshots(
    { resource: resource || undefined, limit: 100 },
    admin && view === 'evidence'
  );
  const qc = useQueryClient();
  const refresh = () =>
    qc.invalidateQueries({ queryKey: hooks.workloadKeys.all });
  const data = status.data;
  const heartbeat = data?.heartbeat_at;
  const stale =
    !!data &&
    (!heartbeat ||
      !Number.isFinite(Date.parse(heartbeat)) ||
      Date.parse(heartbeat) > now + 1000 ||
      now - Date.parse(heartbeat) >
        data.policy.snapshot_max_age_seconds * 1000);
  const unavailable = status.isError || !data?.available || stale;
  const filters = (patch: Record<string, string>) =>
    navigate({ ...patch, decisions_before: '', permits_before: '' });
  if (authLoading) return <WorkloadLoading />;
  if (!admin)
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
        <h1 className="text-2xl font-semibold">
          {t('Workload & Capacity', 'العمل والسعة')}
        </h1>
        <WorkloadNotice
          locale={locale}
          title={t('Administrator access required', 'يلزم وصول مسؤول المنصة')}
        >
          {t(
            'This governor controls capacity across the deployment. Ask a platform administrator to review it.',
            'يضبط هذا المنظّم السعة على مستوى المنصة. اطلب من مسؤول المنصة مراجعته.'
          )}
        </WorkloadNotice>
      </div>
    );
  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      className="mx-auto min-w-0 max-w-[1480px] space-y-5 pb-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              {t('Workload & Capacity', 'العمل والسعة')}
            </h1>
            {data && (
              <WorkloadState
                value={
                  unavailable
                    ? 'unknown'
                    : data.effective_mode && data.effective_mode !== data.mode
                      ? 'paused'
                      : data.mode
                }
                locale={locale}
              />
            )}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t(
              'Keep new work within shared capacity.',
              'نظّم العمل الجديد ضمن السعة المشتركة.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ locale: locale === 'en' ? 'ar' : 'en' })}
            aria-label={
              locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'
            }
          >
            <Globe2 className="me-1.5 h-4 w-4" aria-hidden="true" />
            {locale === 'en' ? 'العربية' : 'English'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={status.isFetching}
            onClick={() => refresh()}
          >
            <RefreshCw
              className={`me-2 h-4 w-4 ${status.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('Refresh', 'تحديث')}
          </Button>
        </div>
      </header>
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border bg-card px-4 py-3 text-xs">
          <p className="text-muted-foreground">
            {unavailable
              ? t('Last loaded policy', 'آخر سياسة محمّلة')
              : t('Admission mode', 'وضع القبول')}{' '}
            <span className="mx-2 text-border" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-foreground">
              {data.effective_mode === 'off' && data.mode !== 'off'
                ? t('Temporary bypass is active', 'الاستثناء المؤقت مفعّل')
                : data.mode === 'off'
                  ? t(
                      'Capacity limits are not enforced',
                      'لا تُطبّق حدود السعة'
                    )
                  : data.mode === 'observe'
                    ? t(
                        'Recording decisions. Work continues as usual.',
                        'تُسجّل القرارات ويستمر العمل كالمعتاد.'
                      )
                    : t(
                        'Capacity limits apply to selected classes',
                        'تُطبق حدود السعة على الفئات المختارة'
                      )}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span
              className={
                unavailable ? 'text-amber-700 dark:text-amber-400' : ''
              }
            >
              {t('Capacity snapshot', 'لقطة السعة')}
            </span>
            <WorkloadTime value={heartbeat} locale={locale} />
          </p>
        </div>
      )}
      {status.isError ? (
        <WorkloadNotice
          locale={locale}
          title={
            data
              ? t('Showing last loaded evidence', 'تُعرض آخر أدلة محمّلة')
              : t('Governor status unavailable', 'حالة المنظّم غير متاحة')
          }
          retry={() => status.refetch()}
        >
          <p>
            {t(
              'Current capacity is unknown. Changes are disabled until status recovers.',
              'السعة الحالية غير معروفة. التغييرات معطلة حتى استعادة الحالة.'
            )}
          </p>
          {errorMessage(status.error)}
        </WorkloadNotice>
      ) : data && (!data.available || stale) ? (
        <WorkloadNotice
          locale={locale}
          title={
            stale
              ? t(
                  'Heartbeat is missing or out of date',
                  'النبضة مفقودة أو قديمة'
                )
              : t('Governor evidence is incomplete', 'أدلة المنظّم غير مكتملة')
          }
          retry={() => status.refetch()}
        >
          {t(
            'Current capacity cannot be verified. Review service health before changing admission.',
            'لا يمكن التحقق من السعة الحالية. راجع صحة الخدمات قبل تعديل القبول.'
          )}
          {data.reasons.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">
                {t('Evidence details', 'تفاصيل الأدلة')}
              </summary>
              <ul className="mt-2 list-inside list-disc">
                {data.reasons.map((reason, i) => (
                  <li key={i} dir="auto">
                    {reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </WorkloadNotice>
      ) : null}
      <Tabs
        value={view}
        onValueChange={(tab) => navigate({ tab })}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <TabsList
          aria-label={t('Workload views', 'عروض العمل')}
          className="grid h-auto w-full grid-cols-4 gap-0 rounded-none border-b bg-transparent p-0 sm:flex sm:justify-start sm:gap-5"
        >
          <TabsTrigger
            value="overview"
            className="min-h-12 gap-2 rounded-none border-b-2 border-transparent px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-3 sm:text-sm"
          >
            <Gauge className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            {t('Overview', 'نظرة عامة')}
          </TabsTrigger>
          <TabsTrigger
            value="evidence"
            className="min-h-12 gap-2 rounded-none border-b-2 border-transparent px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-3 sm:text-sm"
          >
            <BarChart3 className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            {t('Readiness', 'الجاهزية')}
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="min-h-12 gap-2 rounded-none border-b-2 border-transparent px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-3 sm:text-sm"
          >
            <Activity className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            {t('Activity', 'النشاط')}
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="min-h-12 gap-2 rounded-none border-b-2 border-transparent px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-3 sm:text-sm"
          >
            <Settings2 className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            {t('Settings', 'الإعدادات')}
            {settingsDirty && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                role="img"
                aria-label={t('Unsaved settings', 'إعدادات غير محفوظة')}
              />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          {data ? (
            <WorkloadOverview
              data={data}
              locale={locale}
              now={now}
              unavailable={unavailable}
              navigate={(tab, patch) => navigate({ tab, ...patch })}
            />
          ) : status.isPending ? (
            <WorkloadLoading />
          ) : null}
        </TabsContent>
        <TabsContent value="evidence" className="mt-5">
          <WorkloadEvidence
            locale={locale}
            qualification={qualification}
            registry={registry}
            snapshots={snapshots}
            resource={resource}
            selectResource={(resource) => navigate({ resource })}
            coverage={unavailable ? undefined : data?.coverage}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-5">
          <WorkloadActivity
            locale={locale}
            decisions={decisions}
            permits={permits}
            registry={registry.data}
            history={history}
            selectHistory={(history) => navigate({ history })}
            classFilter={classFilter}
            verdictFilter={verdictFilter}
            stateFilter={stateFilter}
            unavailable={unavailable}
            setFilters={filters}
            next={(kind, cursor) => navigate({ [`${kind}_before`]: cursor })}
          />
          {search.has(`${history}_before`) && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() =>
                navigate({ decisions_before: '', permits_before: '' })
              }
            >
              {t('Return to latest activity', 'العودة لأحدث نشاط')}
            </Button>
          )}
        </TabsContent>
        <TabsContent
          value="settings"
          forceMount
          className="mt-5 data-[state=inactive]:hidden"
        >
          <WorkloadSettings
            policy={data?.policy}
            registry={registry}
            qualification={qualification}
            locale={locale}
            unavailable={unavailable}
            refresh={refresh}
            onDraftChange={setSettingsDirty}
          />
        </TabsContent>
      </Tabs>
      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
        <Link
          className="underline underline-offset-4"
          href="/platform/system-health"
        >
          {t('System Health', 'صحة النظام')}
        </Link>
        <Link
          className="underline underline-offset-4"
          href="/platform/feed-integrity"
        >
          {t('Feed Integrity', 'سلامة الخلاصات')}
        </Link>
        <Link
          className="underline underline-offset-4"
          href="/platform/real-experience"
        >
          {t('Real Experience', 'تجربة المستخدم الفعلية')}
        </Link>
      </footer>
    </div>
  );
}
export default function WorkloadPage() {
  return (
    <Suspense fallback={<WorkloadLoading />}>
      <WorkloadWorkspace />
    </Suspense>
  );
}
