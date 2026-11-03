'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useExecuteOpsCommand,
  useOpsClock,
  useOpsCommandPreview,
} from '@/hooks/use-operations-command-center';
import type {
  OpsCommandRequest,
  OpsCommandScope,
} from '@/lib/api/cms/operations';
import {
  OpsNotice,
  OpsTime,
  opsLabel,
  opsSnapshotFresh,
  type OpsCopy,
  type OpsLocale,
} from './presentation';

export function OpsCommandDialog({
  scope,
  close,
  t,
  locale,
  snapshotFresh,
}: {
  scope: OpsCommandScope;
  close: () => void;
  t: OpsCopy;
  locale: OpsLocale;
  snapshotFresh: boolean;
}) {
  const preview = useOpsCommandPreview(scope);
  const execute = useExecuteOpsCommand();
  const now = useOpsClock();
  // A network retry must retain this key. A newly opened review is a new intent.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [submitted, setSubmitted] = useState<OpsCommandRequest>();
  const data = preview.data;
  const resume = scope.command === 'resume';
  const fresh =
    snapshotFresh &&
    !!data &&
    opsSnapshotFresh(data.snapshot_at, now) &&
    Date.parse(data.expires_at) > now;
  const valid =
    resume ||
    (!!reason.trim() &&
      reason.length <= 1000 &&
      Number.isInteger(minutes) &&
      minutes >= 1 &&
      minutes <= 1440);
  const submit = () => {
    if (!submitted && (!data || !fresh || !valid)) return;
    const request = submitted ?? {
      ...scope,
      snapshot_at: data!.snapshot_at,
      target_digest: data!.target_digest,
      idempotency_key: idempotencyKey,
      ...(resume ? {} : { reason, ttl_minutes: minutes }),
    };
    setSubmitted(request);
    execute.mutate(request, { onSuccess: close });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !execute.isPending) close();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle>
            {resume
              ? t('Review source-command resume', 'راجع استئناف الأمر الأصلي')
              : t('Review automation pause', 'راجع إيقاف الأتمتة المؤقت')}
          </DialogTitle>
          <DialogDescription>
            {resume
              ? t(
                  'Only pause values still owned by this source command can be restored. Human or containment changes remain in place.',
                  'تُستعاد فقط القيم التي ما زال الأمر الأصلي يملكها. تبقى تغييرات المشغّل أو الاحتواء كما هي.'
                )
              : t(
                  'Pauses new automation work for the listed systems and tenants. Work already running continues.',
                  'يوقف أعمال الأتمتة الجديدة للأنظمة والمستأجرين المدرجين. يستمر العمل الجاري.'
                )}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">
          {scope.command === 'pause_all'
            ? t(
                'Deployment-wide: every configured tenant',
                'على مستوى النشر: كل المستأجرين المهيّئين'
              )
            : scope.command === 'pause_member'
              ? `${scope.member_key} / ${scope.lane_key} · ${scope.tenant_id || t('All tenants', 'كل المستأجرين')}`
              : scope.source_command_id}
        </p>
        {preview.isLoading && (
          <p role="status">
            {t('Reading current targets…', 'جارٍ قراءة الأهداف الحالية…')}
          </p>
        )}
        {preview.isError && (
          <OpsNotice t={t} retry={() => void preview.refetch()}>
            {t(
              'A complete target review is unavailable.',
              'مراجعة الأهداف الكاملة غير متاحة.'
            )}{' '}
            {preview.error.message}
          </OpsNotice>
        )}
        {data && (
          <>
            <p className="text-sm">
              {data.target_count}{' '}
              {t(
                'configured targets. Review expires',
                'هدفاً مهيّئاً. تنتهي المراجعة'
              )}{' '}
              <OpsTime value={data.expires_at} locale={locale} />
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto border p-3 text-xs">
              {data.targets.map((target) => (
                <li
                  key={`${target.member_key}:${target.lane_key}:${target.tenant_id}`}
                >
                  <span dir="ltr">
                    {target.member_key} / {target.lane_key} ·{' '}
                    {target.tenant_id || 'platform'}
                  </span>{' '}
                  · {opsLabel(target.state)}
                  {target.prior_paused_until && (
                    <>
                      {' '}
                      ·{' '}
                      <OpsTime
                        value={target.prior_paused_until}
                        locale={locale}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-s-2 border-destructive ps-3 text-sm">
              <p className="font-medium">
                {t(
                  'Not changed by this command',
                  'لا يغيّره هذا الأمر'
                )}
              </p>
              <p>
                {t(
                  'This command does not stop services, queues, in-flight work, Ranking Intelligence, Storage, Atomization execution or workload protection. The Pods pipeline keeps its own Pause/Resume control. System Health keeps observing; only its containment authority pauses.',
                  'لا يوقف هذا الأمر الخدمات أو الطوابير أو العمل الجاري أو الترتيب أو التخزين أو تنفيذ التجزئة أو حماية أحمال العمل. يحتفظ مسار بودز بضابط الإيقاف والاستئناف الخاص به. تواصل صحة النظام الرصد؛ وتتوقف صلاحية الاحتواء فقط.'
                )}
              </p>
            </div>
          </>
        )}
        {!resume && (
          <>
            <label className="grid gap-1 text-sm">
              {t('Reason (required)', 'السبب (مطلوب)')}
              <Input
                aria-label={t('Pause reason', 'سبب الإيقاف')}
                maxLength={1000}
                disabled={!!submitted}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t(
                'Pause duration in minutes (1–1440)',
                'مدة الإيقاف بالدقائق (١–١٤٤٠)'
              )}
              <Input
                aria-label={t(
                  'Pause duration in minutes',
                  'مدة الإيقاف بالدقائق'
                )}
                disabled={!!submitted}
                type="number"
                min={1}
                max={1440}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
              />
            </label>
          </>
        )}
        {data && !fresh && !submitted && (
          <OpsNotice t={t} retry={() => void preview.refetch()}>
            {t(
              'Evidence is stale. Refresh the page and this review before applying.',
              'الأدلة قديمة. حدّث الصفحة وهذه المراجعة قبل التنفيذ.'
            )}
          </OpsNotice>
        )}
        {execute.isError && (
          <OpsNotice t={t}>
            {execute.error.message}{' '}
            {t(
              'Retry submits the exact original command. Close and start a new review to change the intent.',
              'تعيد المحاولة إرسال الأمر الأصلي نفسه. أغلق المراجعة وابدأ مراجعة جديدة لتغيير الطلب.'
            )}
          </OpsNotice>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={execute.isPending}
            onClick={close}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            variant={resume ? 'default' : 'destructive'}
            disabled={
              execute.isPending ||
              (!submitted &&
                (!fresh ||
                  !valid ||
                  preview.isFetching ||
                  preview.isError ||
                  !data?.target_count))
            }
            onClick={submit}
          >
            {execute.isPending
              ? t('Applying…', 'جارٍ التنفيذ…')
              : submitted
                ? t('Retry original command', 'أعد محاولة الأمر الأصلي')
                : resume
                  ? t('Confirm resume', 'تأكيد الاستئناف')
                  : t('Confirm pause', 'تأكيد الإيقاف')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
