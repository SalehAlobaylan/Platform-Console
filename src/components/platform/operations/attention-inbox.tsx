'use client';
import Link from '@/lib/console-link';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { queueViewFilters, queueViewHref } from '@/lib/saved-console-views';
import { SaveQueueView } from '@/components/shared/save-queue-view';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/stores/auth';
import { updateOpsHandoff, type OpsAttentionItem, type OpsHandoff } from '@/lib/api/cms/operations';
import {
  opsKeys,
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
  const params = useSearchParams();
  const router = useRouter();
  const applied = queueViewFilters('operations', params);
  const offset = Number(params.get('ops_offset') ?? '0');
  const filters: OpsFilters = {
    state: '', limit: 10, offset: Number.isSafeInteger(offset) && offset >= 0 && offset <= 100000 ? offset : 0,
    include_acked: true,
    ...applied,
    ...(applied.state ? { include_snoozed: ['all', 'snoozed'].includes(applied.state) } : {}),
  };
  const query = useOpsAttention(filters);
  const tenant = useAuthStore(state => state.user?.tenant_id);
  const now = useOpsClock();
  const fresh =
    !!query.data && !query.isError && opsSnapshotFresh(query.data.as_of, now);
  const ack = useAckOpsAttention();
  const snooze = useSnoozeOpsAttention();
  const clear = useClearOpsAttention();
  const pending = ack.isPending || snooze.isPending || clear.isPending;
  const setFilter = (field: keyof OpsFilters, value: string) =>
    router.push(queueViewHref('operations', { ...applied, [field]: value }, locale), { scroll: false });
  const setOffset = (next: number) => {
    const url = new URL(queueViewHref('operations', applied, locale), window.location.origin);
    if (next > 0) url.searchParams.set('ops_offset', String(next));
    router.push(url.pathname + url.search + url.hash, { scroll: false });
  };
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
        <div className="flex flex-wrap gap-2">
          <SaveQueueView surface="operations" filters={applied} locale={locale} />
          {Object.keys(applied).length > 0 && <Button size="sm" variant="ghost" onClick={() => router.push(queueViewHref('operations', {}, locale), { scroll: false })}>{t('Reset filters', 'مسح عوامل التصفية')}</Button>}
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
                href={item.issue_href ?? item.href}
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
                <Button size="sm" variant="ghost" render={<Link href={item.issue_href ?? item.href}>{item.issue_href ? t('Open issue', 'افتح المشكلة') : t('Open system', 'افتح النظام')}</Link>} />
              </div>
              {query.data?.handoffs_available && tenant === item.tenant_id && item.system === 'feed_integrity' && item.kind === 'episode' && (() => {
                const id = item.key.split(':').at(-1) ?? '';
                return <HandoffControl item={item} id={id} fresh={fresh} row={query.data.handoffs?.find(value => value.episode_id === id)} onRefresh={() => void query.refetch()} />;
              })()}

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
            onChange={setOffset}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}

function HandoffControl({ item, id, fresh, row, onRefresh }: {
  item: OpsAttentionItem; id: string; fresh: boolean; row?: OpsHandoff; onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState('');
  const [check, setCheck] = useState('');
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: updateOpsHandoff,
    onSuccess: () => { setEditing(false); void client.invalidateQueries({ queryKey: opsKeys.all }); onRefresh(); },
    onError: onRefresh,
  });
  const save = (action: 'claim' | 'update' | 'release') => {
    if (!fresh || update.isPending) return;
    const date = new Date(check);
    if (action !== 'release' && (!step.trim() || !Number.isFinite(date.getTime()))) return;
    update.mutate({
      episode_id: id, fingerprint: item.fingerprint, severity: item.severity,
      revision: row?.revision ?? 0, action,
      ...(action === 'release' ? {} : { next_step: step.trim(), next_check: date.toISOString() }),
    });
  };
  return <section className="space-y-2 border-t pt-2 text-sm" aria-label="Issue handoff">
    {row?.owner ? <p><strong>{row.owner}</strong> · {row.next_step} · {row.next_check ? new Date(row.next_check).toLocaleString() : 'No check time'}</p> : <p>Unclaimed</p>}
    {(!row?.owner || row.mine) && <Button size="sm" variant="outline" disabled={!fresh || update.isPending} onClick={() => { setStep(row?.next_step ?? ''); setCheck(''); setEditing(value => !value); }}>{row?.owner ? 'Edit handoff' : 'Claim issue'}</Button>}
    {row?.mine && <Button size="sm" variant="ghost" disabled={!fresh || update.isPending} onClick={() => save('release')}>Release issue</Button>}
    {editing && (!row?.owner || row.mine) && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); save(row?.mine ? 'update' : 'claim'); }}>
      <label className="space-y-1">Next step<Input value={step} required maxLength={500} onChange={event => setStep(event.target.value)} /></label>
      <label className="space-y-1">Next check<Input type="datetime-local" required value={check} onChange={event => setCheck(event.target.value)} /></label>
      <Button type="submit" size="sm" disabled={!fresh || update.isPending}>Save handoff</Button>
    </form>}
    {update.isError && <p role="alert">{update.error.message}</p>}
  </section>;
}
