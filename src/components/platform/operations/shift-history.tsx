'use client';
import Link from '@/lib/console-link';
import { useState } from 'react';
import {
  useMarkOpsBriefingSeen,
  useOpsBriefing,
  useOpsCalendar,
} from '@/hooks/use-operations-command-center';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  OpsBadge,
  OpsNotice,
  OpsTime,
  type OpsCopy,
  type OpsLocale,
} from './presentation';

export function ShiftBriefing({
  locale,
  t,
}: {
  locale: OpsLocale;
  t: OpsCopy;
}) {
  const query = useOpsBriefing();
  const seen = useMarkOpsBriefingSeen();
  const data = query.data;
  const families = Array.from(
    new Set(data?.items.map((item) => item.family) ?? [])
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('Since your last visit', 'منذ زيارتك الأخيرة')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && (
          <p role="status">
            {t('Preparing the shift briefing…', 'جارٍ إعداد موجز الوردية…')}
          </p>
        )}
        {query.isError && (
          <OpsNotice retry={() => void query.refetch()} t={t}>
            {t(
              'Briefing is unavailable. Your read cursor has not advanced.',
              'الموجز غير متاح. لم يتقدّم مؤشر القراءة.'
            )}
          </OpsNotice>
        )}
        {data && (
          <>
            <p className="text-xs text-muted-foreground">
              <OpsTime value={data.since} locale={locale} /> —{' '}
              <OpsTime value={data.through} locale={locale} />
            </p>
            {!data.complete && (
              <OpsNotice t={t}>
                {t(
                  'Some fleet history is unavailable. Mark as read is disabled.',
                  'بعض سجل الأنظمة غير متاح. تم تعطيل وضع علامة مقروء.'
                )}{' '}
                {data.adapter_errors.join(' · ')}
              </OpsNotice>
            )}
            {families.map((family) => (
              <section key={family} className="space-y-2">
                <h3 className="text-sm font-medium capitalize">{family}</h3>
                <ul className="divide-y border">
                  {data.items
                    .filter((item) => item.family === family)
                    .map((item) => (
                      <li
                        key={item.key}
                        className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
                      >
                        <Link
                          href={item.href}
                          className="hover:underline"
                          dir="auto"
                        >
                          {item.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {item.system} · {item.count} ·{' '}
                          <OpsTime value={item.last_seen} locale={locale} />
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
            {!data.items.length && data.complete && !query.isError && (
              <p className="text-sm text-muted-foreground">
                {t(
                  'No fleet activity in this briefing window.',
                  'لا يوجد نشاط للأنظمة في فترة هذا الموجز.'
                )}
              </p>
            )}
            <Button
              variant="outline"
              disabled={
                !data.complete ||
                !data.read_token ||
                query.isError ||
                query.isFetching ||
                seen.isPending
              }
              onClick={() =>
                seen.mutate({
                  since: data.since,
                  through: data.through,
                  read_token: data.read_token,
                })
              }
            >
              {t('Mark briefing read', 'وضع علامة مقروء')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
export function RunCalendar({ locale, t }: { locale: OpsLocale; t: OpsCopy }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(30);
  const query = useOpsCalendar(open);
  const data = query.data;
  const end = data ? Date.parse(data.as_of) : Date.now();
  const start = end - 86_400_000;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <button
            className="w-full text-start"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {t('Run calendar · last 24 hours', 'تقويم التشغيل · آخر ٢٤ ساعة')}{' '}
            <span aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'Recorded runs and overlapping work. This view does not schedule or throttle work.',
              'عمليات التشغيل المسجّلة والعمل المتزامن. لا تجدول هذه الواجهة العمل ولا تقيّده.'
            )}
          </p>
          {query.isLoading && (
            <p role="status">
              {t('Loading run history…', 'جارٍ تحميل سجل التشغيل…')}
            </p>
          )}
          {query.isError && (
            <OpsNotice t={t} retry={() => void query.refetch()}>
              {t('Run history is unavailable.', 'سجل التشغيل غير متاح.')}
            </OpsNotice>
          )}
          {data && (
            <>
              {!data.complete && data.adapter_errors.length > 0 && (
                <OpsNotice t={t}>
                  {t('Partial history:', 'سجل جزئي:')}{' '}
                  {data.adapter_errors.join(' · ')}
                </OpsNotice>
              )}
              {data.truncated && (
                <p className="text-sm">
                  {t(
                    'This window reached its detail limit. Open an owner cockpit for its full history.',
                    'بلغت هذه الفترة حد التفاصيل. افتح نظامها للاطلاع على السجل الكامل.'
                  )}
                </p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <OpsTime
                  value={new Date(start).toISOString()}
                  locale={locale}
                />
                <OpsTime value={data.as_of} locale={locale} />
              </div>
              <div className="space-y-3">
                {data.runs.slice(0, shown).map((run) => {
                  const from = Math.max(start, Date.parse(run.started_at));
                  const through = Math.min(
                    end,
                    run.finished_at ? Date.parse(run.finished_at) : end
                  );
                  const left = Math.max(
                    0,
                    Math.min(100, (from - start) / 864_000)
                  );
                  const width = Math.max(
                    0.5,
                    Math.min(100 - left, (through - from) / 864_000)
                  );
                  return (
                    <div key={run.key} className="border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Link
                          href={run.href}
                          className="font-medium hover:underline"
                        >
                          {run.system} · {run.lane_key}
                        </Link>
                        <OpsBadge value={run.status} />
                      </div>
                      <p className="my-1 text-xs text-muted-foreground">
                        {run.tenant_id || 'platform'} ·{' '}
                        <OpsTime value={run.started_at} locale={locale} /> ·{' '}
                        {Math.round(run.duration_ms / 60_000)}{' '}
                        {t('min', 'دقيقة')}
                      </p>
                      <div
                        className="relative h-2 bg-muted"
                        dir="ltr"
                        aria-hidden="true"
                      >
                        <div
                          className="absolute h-2 min-w-px bg-primary"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {shown < data.runs.length && (
                <Button
                  variant="outline"
                  onClick={() => setShown((value) => value + 30)}
                >
                  {t('Show more runs', 'عرض المزيد من التشغيلات')}
                </Button>
              )}
              {!data.runs.length && data.complete && !query.isError && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'No recorded runs in this window.',
                    'لا توجد تشغيلات مسجّلة في هذه الفترة.'
                  )}
                </p>
              )}
              {!!data.overlaps.length && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    {t('Overlapping work', 'العمل المتزامن')} ·{' '}
                    {data.overlaps.length}
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm">
                    {data.overlaps.map((overlap, index) => (
                      <li
                        key={`${overlap.started_at}:${index}`}
                        className="border p-2"
                      >
                        {overlap.systems.join(' · ')} ·{' '}
                        <OpsTime value={overlap.started_at} locale={locale} /> —{' '}
                        <OpsTime value={overlap.finished_at} locale={locale} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!!data.events.length && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    {t('Workload decisions', 'قرارات أحمال العمل')} ·{' '}
                    {data.events.length}
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm">
                    {data.events.map((event, index) => (
                      <li className="border p-2" key={event.key || index}>
                        <Link
                          href={event.href || '/platform/workload?tab=activity'}
                        >
                          {event.system} · {event.kind} ·{' '}
                          {event.status || event.verdict}{' '}
                          {event.count != null ? `(${event.count})` : ''}
                        </Link>{' '}
                        ·{' '}
                        <OpsTime
                          value={
                            event.at || event.started_at || event.created_at
                          }
                          locale={locale}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  {t('Projected next runs', 'التشغيلات القادمة المتوقعة')}
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.fleet
                    .filter(
                      (row) =>
                        row.next_due_at &&
                        row.enabled &&
                        !['paused', 'disabled'].includes(row.state)
                    )
                    .sort(
                      (a, b) =>
                        Date.parse(a.next_due_at!) - Date.parse(b.next_due_at!)
                    )
                    .map((row) => (
                      <li
                        key={`${row.member_key}:${row.lane_key}:${row.tenant_id}`}
                      >
                        <Link href={row.cockpit_path}>
                          {row.member_label} · {row.lane_label}
                        </Link>{' '}
                        · <OpsTime value={row.next_due_at} locale={locale} />
                      </li>
                    ))}
                </ul>
              </details>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
