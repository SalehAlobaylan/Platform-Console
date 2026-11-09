'use client';
import Link from '@/lib/console-link';
import { useState } from 'react';
import {
  useAckOpsAttention,
  useClearOpsAttention,
  useOpsAttention,
  useOpsClock,
  useSnoozeOpsAttention,
} from '@/hooks/use-operations-command-center';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  OpsBadge,
  OpsNotice,
  OpsPager,
  OpsTime,
  opsLabel,
  opsSnapshotFresh,
  type OpsCopy,
  type OpsLocale,
} from './presentation';
import type { OpsFilters, OpsFleetStatus } from '@/lib/api/cms/operations';

export function AttentionInbox({
  fleet,
  locale,
  t,
}: {
  fleet: OpsFleetStatus[];
  locale: OpsLocale;
  t: OpsCopy;
}) {
  const [filters, setFilters] = useState<OpsFilters>({
    state: '',
    limit: 10,
    offset: 0,
    include_acked: true,
  });
  const query = useOpsAttention(filters);
  const now = useOpsClock();
  const fresh =
    !!query.data && !query.isError && opsSnapshotFresh(query.data.as_of, now);
  const ack = useAckOpsAttention();
  const snooze = useSnoozeOpsAttention();
  const clear = useClearOpsAttention();
  const pending = ack.isPending || snooze.isPending || clear.isPending;
  const setFilter = (field: keyof OpsFilters, value: string) =>
    setFilters((old) => ({
      ...old,
      [field]: value,
      offset: 0,
      include_snoozed:
        field === 'state'
          ? ['all', 'snoozed'].includes(value)
          : old.include_snoozed,
    }));
  const systems = Array.from(
    new Map(fleet.map((row) => [row.member_key, row.member_label])).entries()
  );
  const controls = [
    {
      field: 'system' as const,
      label: t('System', 'النظام'),
      options: systems,
    },
    {
      field: 'kind' as const,
      label: t('Kind', 'النوع'),
      options: [
        'approval',
        'episode',
        'stalled',
        'budget',
        'exception',
        'attention',
      ].map((value) => [value, opsLabel(value)]),
    },
    {
      field: 'severity' as const,
      label: t('Severity', 'الخطورة'),
      options: ['critical', 'major', 'minor', 'info'].map((value) => [
        value,
        value,
      ]),
    },
    {
      field: 'state' as const,
      label: t('State', 'الحالة'),
      options: [
        ['', t('Active', 'نشط')],
        ['acked', t('Acknowledged', 'تم الاطلاع')],
        ['snoozed', t('Snoozed', 'مؤجل')],
        ['all', t('All states', 'كل الحالات')],
      ],
    },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{t('Attention inbox', 'صندوق التنبيهات')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(
              'Resolve each item in its owning cockpit. Acknowledge and snooze only change this inbox.',
              'عالج كل حالة في مساحة نظامها. الاطلاع والتأجيل يغيّران هذا الصندوق فقط.'
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching || pending}
          onClick={() => void query.refetch()}
        >
          {t('Refresh inbox', 'تحديث التنبيهات')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {controls.map((control) => (
            <label key={control.field} className="grid gap-1 text-xs">
              <span>{control.label}</span>
              <select
                className="h-9 rounded-sm border bg-background px-2 text-sm"
                value={String(filters[control.field] || '')}
                onChange={(event) =>
                  setFilter(control.field, event.target.value)
                }
              >
                {control.field !== 'state' && (
                  <option value="">{t('All', 'الكل')}</option>
                )}
                {control.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {query.isLoading && (
          <p role="status">
            {t('Loading attention…', 'جارٍ تحميل التنبيهات…')}
          </p>
        )}
        {query.isError && (
          <OpsNotice retry={() => void query.refetch()} t={t}>
            {t(
              'Attention is unavailable. The last successful result, if any, remains below.',
              'التنبيهات غير متاحة. تظهر أدناه آخر نتيجة ناجحة إن وُجدت.'
            )}
          </OpsNotice>
        )}
        {query.data && !query.isError && !fresh && (
          <OpsNotice retry={() => void query.refetch()} t={t}>
            {t(
              'These attention items are from an older snapshot. Refresh before acknowledging or snoozing.',
              'هذه التنبيهات من لقطة قديمة. حدّثها قبل الاطلاع أو التأجيل.'
            )}
          </OpsNotice>
        )}
        {!!query.data?.adapter_errors.length && (
          <OpsNotice t={t}>
            {t(
              'Some attention sources could not be read:',
              'تعذّرت قراءة بعض مصادر التنبيهات:'
            )}{' '}
            {query.data.adapter_errors.join(' · ')}
          </OpsNotice>
        )}
        {query.data && (
          <p className="text-xs text-muted-foreground">
            {t('Observed', 'تم الرصد')}{' '}
            <OpsTime value={query.data.as_of} locale={locale} />
          </p>
        )}
        {query.data?.items.map((item) => {
          const review = {
            key: item.key,
            fingerprint: item.fingerprint,
            severity: item.severity,
            count: item.count,
          };
          return (
            <article
              key={item.key}
              className={`space-y-2 border p-4 ${item.state === 'acked' ? 'border-dashed bg-muted/40' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <OpsBadge value={item.severity} />
                <span className="text-xs">
                  {item.system} · {item.tenant_id || 'platform'} ·{' '}
                  {opsLabel(item.kind)}
                </span>
                {item.state && (
                  <OpsBadge value={item.snoozed ? 'snoozed' : item.state} />
                )}
              </div>
              <Link
                href={item.href}
                className="block font-medium underline-offset-4 hover:underline"
                dir="auto"
              >
                {item.title}
              </Link>
              <p className="text-sm text-muted-foreground" dir="auto">
                {item.detail}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('Affected', 'المتأثر')} {item.count} · {t('Since', 'منذ')}{' '}
                <OpsTime value={item.first_seen} locale={locale} />
                {item.snoozed && (
                  <>
                    {' '}
                    · {t('Snoozed until', 'مؤجل حتى')}{' '}
                    <OpsTime value={item.snoozed_until} locale={locale} />
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.state !== 'acked' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!fresh || pending}
                    onClick={() => ack.mutate(review)}
                  >
                    {t('Acknowledge', 'اطلعت')}
                  </Button>
                )}
                {!item.snoozed && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!fresh || pending}
                    onClick={() => snooze.mutate({ review, minutes: 120 })}
                  >
                    {t('Snooze 2h', 'تأجيل ساعتين')}
                  </Button>
                )}
                {item.state && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => clear.mutate(item.key)}
                  >
                    {t('Restore to active', 'إعادة إلى النشط')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link href={item.href}>{t('Open owner', 'افتح النظام')}</Link>
                </Button>
              </div>
            </article>
          );
        })}
        {query.data &&
          !query.data.items.length &&
          !query.isError &&
          !query.data.adapter_errors.length && (
            <p className="py-5 text-sm text-muted-foreground">
              {t('No matching attention items.', 'لا توجد تنبيهات مطابقة.')}
            </p>
          )}
        {query.data && (
          <OpsPager
            offset={filters.offset || 0}
            limit={10}
            total={query.data.total}
            more={query.data.has_more}
            onChange={(offset) => setFilters((old) => ({ ...old, offset }))}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}
