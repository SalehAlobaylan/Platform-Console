'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useRevokeWorkloadPermit } from '@/hooks/use-workload';
import type {
  WorkloadDecision,
  WorkloadPage,
  WorkloadPermit,
  WorkloadRegistry,
} from '@/types/platform/workload';
import type { WorkloadQuery } from './workload-evidence';
import {
  copy,
  EmptyWorkload,
  errorMessage,
  inputClass,
  name,
  WorkloadNotice,
  WorkloadPanel,
  WorkloadState,
  WorkloadTime,
  type WorkloadLocale,
} from './presentation';

export function WorkloadActivity({
  locale,
  decisions,
  permits,
  registry,
  history,
  selectHistory,
  classFilter,
  verdictFilter,
  stateFilter,
  unavailable,
  setFilters,
  next,
}: {
  locale: WorkloadLocale;
  decisions: WorkloadQuery<WorkloadPage<WorkloadDecision>>;
  permits: WorkloadQuery<WorkloadPage<WorkloadPermit>>;
  registry?: WorkloadRegistry;
  history: 'decisions' | 'permits';
  selectHistory: (history: 'decisions' | 'permits') => void;
  classFilter: string;
  verdictFilter: string;
  stateFilter: string;
  unavailable: boolean;
  setFilters: (patch: Record<string, string>) => void;
  next: (kind: 'decisions' | 'permits', cursor: string) => void;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const [selected, setSelected] = useState<WorkloadPermit | null>(null);
  const [reason, setReason] = useState('');
  const revoke = useRevokeWorkloadPermit();
  const [failure, setFailure] = useState('');
  const currentCanRevoke =
    !!selected &&
    !!permits.data?.data.find((item) => item.id === selected.id)?.can_revoke;
  const submit = async () => {
    if (
      !selected ||
      !selected.can_revoke ||
      !currentCanRevoke ||
      permits.isError ||
      unavailable ||
      !reason.trim()
    )
      return;
    setFailure('');
    try {
      await revoke.mutateAsync({ id: selected.id, reason: reason.trim() });
      setSelected(null);
      setReason('');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-md border bg-card p-1"
          role="group"
          aria-label={t('Activity history', 'سجل النشاط')}
        >
          <Button
            variant={history === 'decisions' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={history === 'decisions'}
            onClick={() => selectHistory('decisions')}
          >
            {t('Decisions', 'القرارات')}
          </Button>
          <Button
            variant={history === 'permits' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={history === 'permits'}
            onClick={() => selectHistory('permits')}
          >
            {t('Reservations', 'الحجوزات')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            'Latest first · up to 50 per page',
            'الأحدث أولًا · حتى ٥٠ في الصفحة'
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="min-w-48 flex-1 space-y-1 text-sm">
          <span>{t('Work class', 'فئة العمل')}</span>
          <select
            className={inputClass}
            value={classFilter}
            onChange={(e) => setFilters({ class: e.target.value })}
          >
            <option value="">{t('All classes', 'جميع الفئات')}</option>
            {registry?.classes.map((item) => (
              <option key={item.key} value={item.key}>
                {name(item.key, locale)}
              </option>
            ))}
          </select>
        </label>
        {history === 'decisions' && (
          <label className="min-w-40 flex-1 space-y-1 text-sm">
            <span>{t('Decision', 'القرار')}</span>
            <select
              className={inputClass}
              value={verdictFilter}
              onChange={(e) => setFilters({ verdict: e.target.value })}
            >
              <option value="">{t('All decisions', 'جميع القرارات')}</option>
              {['admit', 'admit_reduced', 'defer'].map((key) => (
                <option key={key} value={key}>
                  {name(key, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        {history === 'permits' && (
          <label className="min-w-40 flex-1 space-y-1 text-sm">
            <span>{t('Reservation state', 'حالة الحجز')}</span>
            <select
              className={inputClass}
              value={stateFilter}
              onChange={(e) => setFilters({ state: e.target.value })}
            >
              <option value="">{t('All states', 'جميع الحالات')}</option>
              {[
                'acquired',
                'running',
                'handed_off',
                'uncertain',
                'expired',
                'released',
                'revoked',
              ].map((key) => (
                <option key={key} value={key}>
                  {name(key, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        {(classFilter || verdictFilter || stateFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ class: '', verdict: '', state: '' })}
          >
            {t('Clear filters', 'مسح المرشحات')}
          </Button>
        )}
      </div>
      {history === 'decisions' && (
        <WorkloadPanel
          title={t('Admission decisions', 'قرارات القبول')}
          description={t(
            'In Observe, work is admitted. “Would delay” shows what enforcement would have deferred.',
            'في وضع المراقبة يُقبل العمل. ويوضح «تأجيل افتراضي» ما كان سيؤجَّل عند تطبيق الحدود.'
          )}
        >
          {decisions.isError && (
            <WorkloadNotice
              locale={locale}
              title={t('Decision history unavailable', 'سجل القرارات غير متاح')}
              retry={() => decisions.refetch()}
            >
              {errorMessage(decisions.error)}
            </WorkloadNotice>
          )}
          {decisions.isPending && !decisions.data ? (
            <Skeleton className="h-48" />
          ) : decisions.data?.data.length ? (
            <div className="divide-y">
              {decisions.data.data.map((item) => (
                <details key={item.id} className="py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {item.event === 'request' ? (
                          <>
                            {name(item.system, locale)} ·{' '}
                            {name(item.class, locale)}
                          </>
                        ) : (
                          <>
                            {name(item.event, locale)} ·{' '}
                            {name(item.system, locale)}
                          </>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        <WorkloadTime value={item.created_at} locale={locale} />{' '}
                        · {name(item.event, locale)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <WorkloadState
                        value={
                          item.event === 'request' ? item.verdict : item.event
                        }
                        locale={locale}
                      />
                      {item.event === 'request' &&
                        item.mode === 'observe' &&
                        item.would_verdict !== item.verdict && (
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {item.would_verdict === 'defer'
                              ? t('Would delay', 'تأجيل افتراضي')
                              : `${t('Would:', 'افتراضيًا:')} ${name(item.would_verdict, locale)}`}
                          </span>
                        )}
                      {item.event === 'request' && (
                        <span className="text-xs tabular-nums">
                          {item.granted_units}/{item.requested_units}{' '}
                          {t('units', 'وحدة')}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-3 text-xs">
                    <p>
                      {t('Mode', 'الوضع')}: {name(item.mode, locale)} ·{' '}
                      {t('Policy revision', 'إصدار السياسة')}:{' '}
                      {item.policy_revision}
                    </p>
                    <p className="break-all" dir="auto">
                      {t('Tenant', 'المستأجر')}: {item.tenant_id}{' '}
                      {item.actor ? `· ${item.actor}` : ''}
                    </p>
                    {item.reasons.length > 0 && (
                      <ul className="list-inside list-disc space-y-1">
                        {item.reasons.map((item, i) => (
                          <li key={i} dir="auto">
                            {name(item, locale)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">
                        {t('Exact decision evidence', 'أدلة القرار الدقيقة')}
                      </summary>
                      <pre
                        dir="ltr"
                        className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words"
                      >
                        {JSON.stringify(
                          {
                            decision_id: item.id,
                            permit_id: item.permit_id,
                            evidence: item.evidence,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            !decisions.isError && (
              <EmptyWorkload
                locale={locale}
                title={t(
                  'No decisions match these filters',
                  'لا توجد قرارات تطابق المرشحات'
                )}
                description={t(
                  'No recorded decisions does not prove all callers are covered.',
                  'عدم وجود قرارات مسجلة لا يثبت تغطية جميع الجهات.'
                )}
              />
            )
          )}
          {decisions.data?.next_cursor && (
            <Button
              variant="outline"
              onClick={() => next('decisions', decisions.data!.next_cursor!)}
            >
              {t('Older decisions', 'قرارات أقدم')}
            </Button>
          )}
        </WorkloadPanel>
      )}
      {history === 'permits' && (
        <WorkloadPanel
          title={t('Execution reservations', 'حجوزات التنفيذ')}
          description={t(
            'Review work still holding capacity. Only unstarted reservations can be revoked; other work must settle through its native owner.',
            'راجع العمل الذي لا يزال يحجز السعة. يمكن إلغاء الحجوزات التي لم تبدأ فقط؛ ويجب حسم البقية عبر الجهة المسؤولة.'
          )}
        >
          {permits.isError && (
            <WorkloadNotice
              locale={locale}
              title={t('Reservations unavailable', 'الحجوزات غير متاحة')}
              retry={() => permits.refetch()}
            >
              {errorMessage(permits.error)}
            </WorkloadNotice>
          )}
          {permits.isPending && !permits.data ? (
            <Skeleton className="h-48" />
          ) : permits.data?.data.length ? (
            <div className="divide-y">
              {permits.data.data.map((item) => (
                <article className="space-y-3 py-4" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">
                        {name(item.system, locale)} · {name(item.class, locale)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('Lease deadline', 'نهاية مدة الحجز')}:{' '}
                        <WorkloadTime value={item.expires_at} locale={locale} />
                      </p>
                    </div>
                    <WorkloadState value={item.state} locale={locale} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span>
                      {item.granted_units}/{item.requested_units}{' '}
                      {t('units granted', 'وحدة مُصرّح بها')}
                    </span>
                    {item.actual_units !== undefined && (
                      <span>
                        {t('Actual', 'الفعلي')}: {item.actual_units}
                      </span>
                    )}
                    {item.can_revoke && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          unavailable || permits.isError || revoke.isPending
                        }
                        onClick={() => {
                          setSelected(item);
                          setReason('');
                          setFailure('');
                          revoke.reset();
                        }}
                      >
                        {t('Revoke before start', 'إلغاء قبل البدء')}
                      </Button>
                    )}
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      {t(
                        'Owner and settlement evidence',
                        'الجهة المسؤولة وأدلة الحسم'
                      )}
                    </summary>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          {t('Reservation', 'الحجز')}
                        </dt>
                        <dd className="break-all" dir="ltr">
                          {item.id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t('Native owner', 'الجهة المسؤولة')}
                        </dt>
                        <dd className="break-all" dir="auto">
                          {item.owner_kind}: {item.owner_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t('Tenant', 'المستأجر')}
                        </dt>
                        <dd className="break-all" dir="auto">
                          {item.tenant_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t('Settlement proof', 'إثبات الحسم')}
                        </dt>
                        <dd className="break-words" dir="auto">
                          {item.settlement_proof ||
                            t(
                              'No terminal proof recorded',
                              'لم يُسجَّل إثبات نهائي'
                            )}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            !permits.isError && (
              <EmptyWorkload
                locale={locale}
                title={t(
                  'No reservations match these filters',
                  'لا توجد حجوزات تطابق المرشحات'
                )}
              />
            )
          )}
          {permits.data?.next_cursor && (
            <Button
              variant="outline"
              onClick={() => next('permits', permits.data!.next_cursor!)}
            >
              {t('Older reservations', 'حجوزات أقدم')}
            </Button>
          )}
        </WorkloadPanel>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setSelected(null);
        }}
      >
        <DialogContent
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t('Close', 'إغلاق')}
          className="max-h-[90dvh] overflow-y-auto"
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              {t('Revoke an unstarted reservation', 'إلغاء حجز لم يبدأ')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'This releases only this CMS initiation reservation. The server rejects the action if work has already started.',
                'يحرر هذا الإجراء حجز بدء المهمة في نظام المحتوى فقط. يرفض الخادم الإجراء إذا كان التنفيذ قد بدأ.'
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-xs" dir="ltr">
            {selected?.id}
          </p>
          <label className="space-y-1 text-sm">
            <span>{t('Revocation reason', 'سبب الإلغاء')}</span>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={revoke.isPending}
            />
          </label>
          {failure && (
            <WorkloadNotice
              locale={locale}
              title={t('Reservation was not revoked', 'لم يُلغَ الحجز')}
            >
              {failure}
            </WorkloadNotice>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => setSelected(null)}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              disabled={
                !currentCanRevoke ||
                !reason.trim() ||
                revoke.isPending ||
                unavailable ||
                permits.isError
              }
              onClick={submit}
            >
              {revoke.isPending
                ? t('Revoking…', 'جارٍ الإلغاء…')
                : t('Revoke reservation', 'إلغاء الحجز')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
