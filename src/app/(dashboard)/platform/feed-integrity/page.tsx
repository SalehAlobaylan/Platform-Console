'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  feedIntegrityKeys,
  useFeedIntegrityStatus,
  useRunFeedIntegrity,
} from '@/hooks/use-feed-integrity';
import { FeedIntegrityAutopilotPanel } from '@/components/platform/feed-integrity/feed-integrity-autopilot-panel';
import { FeedIntegrityActivity } from '@/components/platform/feed-integrity/feed-integrity-activity';
import {
  FeedIntegrityIssues,
  type IntegrityParams,
} from '@/components/platform/feed-integrity/feed-integrity-issues';
import {
  AttentionSummary,
  CoverageSummary,
  FeedSummary,
  IntegrityTime,
} from '@/components/platform/feed-integrity/feed-integrity-overview';
import { FeedIntegritySettings } from '@/components/platform/feed-integrity/feed-integrity-settings';
import { translate } from '@/components/platform/feed-integrity/presentation';

function LoadingOverview() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

function FeedIntegrityWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const requestedTab = params.get('tab') || 'overview';
  const tab = ['overview', 'issues', 'activity', 'settings'].includes(
    requestedTab
  )
    ? requestedTab
    : requestedTab === 'attention'
      ? 'issues'
      : requestedTab === 'history'
        ? 'activity'
        : 'overview';
  const locale = params.get('locale') === 'ar' ? 'ar' : 'en';
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const status = useFeedIntegrityStatus();
  const run = useRunFeedIntegrity(locale);
  const qc = useQueryClient();
  const data = status.data;
  const checking = run.isPending || data?.latest_run?.status === 'running';
  const unavailable = status.isError || !data;
  const setParams = (changes: IntegrityParams) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (
        !value ||
        value === 'all' ||
        (key === 'tab' && value === 'overview') ||
        (key === 'locale' && value === 'en')
      )
        next.delete(key);
      else next.set(key, value);
    });
    const query = next.toString();
    router.replace(`/platform/feed-integrity${query ? `?${query}` : ''}`, {
      scroll: false,
    });
  };
  const clearSelection = {
    selected: undefined,
    inspect: undefined,
    inspectFeed: undefined,
    repair: undefined,
  };
  const reviewFeed = (feed: string) =>
    setParams({
      tab: 'issues',
      feed,
      check: undefined,
      state: undefined,
      q: undefined,
      page: undefined,
      ...clearSelection,
    });
  const inspect = (check: string, feed: string) =>
    setParams({
      tab: 'issues',
      check,
      feed,
      state: undefined,
      q: undefined,
      page: undefined,
      selected: undefined,
      inspect: check,
      inspectFeed: feed,
    });
  const repairPanel = (
    <FeedIntegrityAutopilotPanel
      view={tab === 'activity' ? 'history' : 'pending'}
      locale={locale}
      selectedId={params.get('repair') || ''}
      onSelect={(id) => setParams({ repair: id })}
    />
  );
  return (
    <div
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`min-w-0 space-y-5 ${locale === 'ar' ? 'font-sans' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('Feed Integrity', 'سلامة الخلاصات')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'Check feed delivery, inspect problems, and verify recovery.',
              'افحص وصول الخلاصات، وتحقق من المشكلات، وأثبت التعافي.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams({ locale: locale === 'en' ? 'ar' : 'en' })}
          >
            {locale === 'en' ? 'العربية' : 'English'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(
              'Reload recorded evidence',
              'إعادة تحميل الأدلة المسجلة'
            )}
            title={t(
              'Reload recorded evidence; does not run a new check',
              'إعادة تحميل الأدلة المسجلة دون تشغيل فحص جديد'
            )}
            disabled={status.isFetching}
            onClick={() =>
              qc.invalidateQueries({ queryKey: feedIntegrityKeys.all })
            }
          >
            <RefreshCw
              className={`h-4 w-4 ${status.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
          </Button>
          <div className="flex">
            <Button
              className="rounded-e-none"
              disabled={unavailable || checking}
              onClick={() => run.mutate('light')}
            >
              {checking ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : null}
              {checking
                ? t('Checking feeds…', 'جارٍ فحص الخلاصات…')
                : t('Check feeds', 'فحص الخلاصات')}
            </Button>
            <DropdownMenu dir={locale === 'ar' ? 'rtl' : 'ltr'}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="rounded-s-none border-s border-primary-foreground/20 px-2"
                  disabled={unavailable || checking}
                  aria-label={t('Check options', 'خيارات الفحص')}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                lang={locale}
                align="end"
                className={`max-w-[calc(100vw-2rem)] ${locale === 'ar' ? 'font-sans' : ''}`}
              >
                <DropdownMenuItem
                  className="block py-3"
                  onSelect={() => run.mutate('light')}
                >
                  <span className="block font-medium">
                    {t('Quick feed check', 'فحص الخلاصة السريع')}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(
                      'Inventory and CMS feed responses',
                      'المخزون واستجابات خلاصة CMS'
                    )}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="block py-3"
                  onSelect={() => run.mutate('deep')}
                >
                  <span className="block font-medium">
                    {t('Include media URL checks', 'تضمين فحص روابط الوسائط')}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(
                      'Also samples playback, fallback and artwork URLs',
                      'يفحص أيضًا عينات من روابط التشغيل والبدائل والصور'
                    )}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {status.isError ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p role="alert" className="text-sm font-medium">
              {t('Status unavailable', 'الحالة غير متاحة')}.{' '}
              {data
                ? t(
                    'Showing last loaded evidence. Current decisions and new checks are disabled.',
                    'تُعرض آخر أدلة محملة. القرارات الحالية والفحوصات الجديدة معطلة.'
                  )
                : t(
                    'Feed health could not be read.',
                    'تعذرت قراءة سلامة الخلاصات.'
                  )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => status.refetch()}
            >
              {t('Retry status', 'إعادة تحميل الحالة')}
            </Button>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                {t('Error details', 'تفاصيل الخطأ')}
              </summary>
              <p className="mt-2 break-words" dir="auto">
                {status.error.message}
              </p>
            </details>
          </CardContent>
        </Card>
      ) : null}
      {run.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t('Check could not finish', 'تعذر إكمال الفحص')}: {run.error.message}
        </p>
      ) : null}
      {checking ? (
        <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">
          {t(
            'A check is running. Previously recorded evidence stays visible until new results arrive.',
            'فحص قيد التنفيذ. تبقى الأدلة المسجلة سابقًا ظاهرة حتى وصول النتائج الجديدة.'
          )}
        </p>
      ) : null}
      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: value, ...clearSelection })}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          <TabsTrigger value="overview">
            {t('Overview', 'نظرة عامة')}
          </TabsTrigger>
          <TabsTrigger value="issues">{t('Issues', 'المشكلات')}</TabsTrigger>
          <TabsTrigger value="activity">{t('Activity', 'النشاط')}</TabsTrigger>
          <TabsTrigger value="settings">
            {t('Settings', 'الإعدادات')}
          </TabsTrigger>
        </TabsList>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            {t('Latest check started', 'بدأ آخر فحص')}:{' '}
            <IntegrityTime
              value={data?.latest_run?.started_at}
              locale={locale}
            />
            {data?.latest_run?.finished_at ? (
              <>
                {' '}
                · {t('Finished', 'انتهى')}{' '}
                <IntegrityTime
                  value={data.latest_run.finished_at}
                  locale={locale}
                />
              </>
            ) : null}
          </p>
          <Badge variant="outline">
            {data?.posture === 'paused'
              ? t('Scheduling paused', 'الجدولة متوقفة')
              : data?.posture === 'scheduled'
                ? t('Scheduled checks', 'فحوصات مجدولة')
                : data
                  ? t('Manual checks', 'فحوصات يدوية')
                  : t('Schedule unavailable', 'الجدولة غير متاحة')}
          </Badge>
        </div>
        <TabsContent value="overview" className="space-y-4">
          {status.isLoading ? (
            <LoadingOverview />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <FeedSummary
                  feed="pods"
                  data={data}
                  locale={locale}
                  onReview={() => reviewFeed('pods')}
                  unavailable={unavailable}
                />
                <FeedSummary
                  feed="news"
                  data={data}
                  locale={locale}
                  onReview={() => reviewFeed('news')}
                  unavailable={unavailable}
                />
              </div>
              {repairPanel}
              {data ? (
                <>
                  <AttentionSummary
                    data={data}
                    locale={locale}
                    onInspect={inspect}
                    onAll={() =>
                      setParams({
                        tab: 'issues',
                        feed: undefined,
                        check: undefined,
                        state: undefined,
                        q: undefined,
                        page: undefined,
                        ...clearSelection,
                      })
                    }
                  />
                  <CoverageSummary data={data} locale={locale} />
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t(
                  'These checks cover CMS delivery and sampled assets.',
                  'تغطي هذه الفحوصات عرض CMS وعينات من الملفات.'
                )}{' '}
                <Link
                  className="text-primary underline underline-offset-4"
                  href="/platform/real-experience"
                >
                  {t(
                    'View consumer experience monitoring',
                    'عرض مراقبة تجربة المستخدم'
                  )}
                </Link>
              </p>
            </>
          )}
        </TabsContent>
        <TabsContent value="issues" className="space-y-4">
          <FeedIntegrityIssues
            data={data}
            locale={locale}
            params={params}
            setParams={setParams}
            unavailable={unavailable}
            loading={status.isLoading}
            checking={checking}
            onCheck={() => run.mutate('deep')}
          />
          {repairPanel}
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <FeedIntegrityActivity
            locale={locale}
            params={params}
            setParams={setParams}
          />
          {repairPanel}
        </TabsContent>
        <TabsContent value="settings">
          <FeedIntegritySettings
            policy={data?.policy}
            locale={locale}
            unavailable={unavailable}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FeedIntegrityPage() {
  return (
    <Suspense fallback={<LoadingOverview />}>
      <FeedIntegrityWorkspace />
    </Suspense>
  );
}
