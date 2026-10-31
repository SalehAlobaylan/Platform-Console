'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pause, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsClock,
  useOpsRegistry,
  useOpsStatus,
} from '@/hooks/use-operations-command-center';
import type { OpsCommandScope } from '@/lib/api/cms/operations';
import { AttentionInbox } from '@/components/platform/operations/attention-inbox';
import { FleetStatus } from '@/components/platform/operations/fleet-status';
import { OpsCommandDialog } from '@/components/platform/operations/command-dialog';
import { CommandHistory } from '@/components/platform/operations/command-history';
import {
  RunCalendar,
  ShiftBriefing,
} from '@/components/platform/operations/shift-history';
import {
  OpsBadge,
  OpsNotice,
  OpsTime,
  opsSnapshotFresh,
  type OpsLocale,
} from '@/components/platform/operations/presentation';

function OperationsLoading() {
  return (
    <div role="status" aria-label="Loading operations" className="space-y-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-64" />
    </div>
  );
}
function OperationsWorkspace() {
  const search = useSearchParams();
  const router = useRouter();
  const locale: OpsLocale = search.get('locale') === 'ar' ? 'ar' : 'en';
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const status = useOpsStatus();
  const now = useOpsClock();
  const [scope, setScope] = useState<OpsCommandScope>();
  const [debugOpen, setDebugOpen] = useState(false);
  const registry = useOpsRegistry(debugOpen);
  const data = status.data;
  const fresh = !!data && !status.isError && opsSnapshotFresh(data.as_of, now);
  const fleetReady = fresh && data?.pause_targets_readable === true;
  const changeLocale = () => {
    const params = new URLSearchParams(search.toString());
    params.set('locale', locale === 'en' ? 'ar' : 'en');
    router.replace(`/platform/operations?${params}`, { scroll: false });
  };
  if (status.isLoading && !data) return <OperationsLoading />;
  if (!data)
    return (
      <OpsNotice t={t} retry={() => void status.refetch()}>
        {t(
          'Operations is unavailable. No fleet state can be confirmed.',
          'العمليات غير متاحة. لا يمكن تأكيد حالة الأنظمة.'
        )}
      </OpsNotice>
    );
  return (
    <div
      className="space-y-6"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-editorial text-3xl font-bold">
              {t('Operations Command Center', 'مركز قيادة العمليات')}
            </h1>
            <OpsBadge value={fresh ? data.headline : 'unknown'} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground" dir="auto">
            {data.summary}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('Snapshot', 'اللقطة')}{' '}
            <OpsTime value={data.as_of} locale={locale} /> ·{' '}
            {new Set(data.fleet.map((row) => row.member_key)).size}{' '}
            {t('systems', 'نظاماً')} · {data.fleet.length}{' '}
            {t('tenant lanes', 'مساراً للمستأجرين')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={changeLocale}>
            {locale === 'en' ? 'العربية' : 'English'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            <RefreshCw className="me-2 h-4 w-4" />
            {t('Refresh', 'تحديث')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!fleetReady}
            onClick={() => setScope({ command: 'pause_all' })}
          >
            <Pause className="me-2 h-4 w-4" />
            {t('Review fleet pause', 'راجع إيقاف الأسطول')}
          </Button>
        </div>
      </header>
      <nav
        aria-label={t('Operations sections', 'أقسام العمليات')}
        className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-4 text-sm"
      >
        {[
          ['attention', t('Inbox', 'التنبيهات')],
          ['fleet', t('Fleet', 'الأنظمة')],
          ['briefing', t('Briefing', 'الموجز')],
          ['calendar', t('Calendar', 'الجدول')],
          ['commands', t('Commands', 'الأوامر')],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#ops-${id}`}
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
          </a>
        ))}
      </nav>
      {!fresh && (
        <OpsNotice t={t} retry={() => void status.refetch()}>
          {t(
            'Live status is unavailable or stale. The last successful snapshot remains visible; commands are disabled.',
            'الحالة الحية غير متاحة أو قديمة. تبقى آخر لقطة ناجحة ظاهرة وتُعطّل الأوامر.'
          )}
        </OpsNotice>
      )}
      {!!data.adapter_errors.length && (
        <OpsNotice t={t}>
          {fleetReady
            ? t(
                'Some fleet evidence is unavailable. Pause targets remain readable and can be reviewed.',
                'بعض أدلة الأنظمة غير متاحة. لا تزال أهداف الإيقاف مقروءة ويمكن مراجعتها.'
              )
            : t(
                'Partial fleet evidence. Fleet-wide pause is disabled; readable members can be reviewed individually.',
                'أدلة الأنظمة جزئية. يُعطّل الإيقاف الشامل ويمكن مراجعة الأنظمة المقروءة منفردة.'
              )}{' '}
          {data.adapter_errors.join(' · ')}
        </OpsNotice>
      )}
      <section
        id="ops-attention"
        className="scroll-mt-4"
        aria-label={t('Attention inbox', 'صندوق التنبيهات')}
      >
        <AttentionInbox fleet={data.fleet} locale={locale} t={t} />
      </section>
      <section
        id="ops-fleet"
        className="scroll-mt-4"
        aria-label={t('Fleet status', 'حالة الأنظمة')}
      >
        <FleetStatus
          fleet={data.fleet}
          fresh={fresh}
          review={setScope}
          locale={locale}
          t={t}
        />
      </section>
      <section
        id="ops-briefing"
        className="scroll-mt-4"
        aria-label={t('Shift briefing', 'موجز الوردية')}
      >
        <ShiftBriefing locale={locale} t={t} />
      </section>
      <section
        id="ops-calendar"
        className="scroll-mt-4"
        aria-label={t('Run calendar', 'جدول التشغيل')}
      >
        <RunCalendar locale={locale} t={t} />
      </section>
      <section
        id="ops-commands"
        className="scroll-mt-4"
        aria-label={t('Command history', 'سجل الأوامر')}
      >
        <CommandHistory fresh={fresh} review={setScope} locale={locale} t={t} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            <button
              className="w-full text-start"
              aria-expanded={debugOpen}
              onClick={() => setDebugOpen((value) => !value)}
            >
              {t('Diagnostics', 'التشخيص')} {debugOpen ? '−' : '+'}
            </button>
          </CardTitle>
        </CardHeader>
        {debugOpen && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'Owner evidence and the static fleet registry. These reads do not change policy.',
                'أدلة الأنظمة وسجلها الثابت. لا تغيّر هذه القراءات السياسات.'
              )}
            </p>
            {registry.isError && (
              <OpsNotice t={t} retry={() => void registry.refetch()}>
                {t('Registry unavailable.', 'السجل غير متاح.')}
              </OpsNotice>
            )}
            <details>
              <summary className="cursor-pointer text-sm">
                {t('Raw snapshot', 'اللقطة الخام')}
              </summary>
              <pre
                className="mt-2 max-h-96 overflow-auto border p-3 text-xs"
                dir="ltr"
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer text-sm">
                {t('Registry and lanes', 'الأنظمة والمسارات')}
              </summary>
              <pre
                className="mt-2 max-h-96 overflow-auto border p-3 text-xs"
                dir="ltr"
              >
                {JSON.stringify(
                  registry.data?.members ?? registry.data,
                  null,
                  2
                )}
              </pre>
            </details>
          </CardContent>
        )}
      </Card>
      {scope && (
        <OpsCommandDialog
          key={JSON.stringify(scope)}
          scope={scope}
          close={() => setScope(undefined)}
          t={t}
          locale={locale}
          snapshotFresh={fresh}
        />
      )}
    </div>
  );
}
export default function OperationsPage() {
  return (
    <Suspense fallback={<OperationsLoading />}>
      <OperationsWorkspace />
    </Suspense>
  );
}
