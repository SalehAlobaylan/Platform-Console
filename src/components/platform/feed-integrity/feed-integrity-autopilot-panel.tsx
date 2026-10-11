'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveFeedIntegrityAction,
  useFeedIntegrityAutopilotActions,
  useFeedIntegrityAutopilotStatus,
  usePauseFeedIntegrityAutopilot,
  useRejectFeedIntegrityAction,
  useReviewFeedIntegrityUnknownAction,
  useUpdateFeedIntegrityAutopilotPolicy,
} from '@/hooks/use-feed-integrity';
import {
  actionNeedsReview,
  actionTitle,
  evidenceRecord,
  ownerLabel,
  reasonLabel,
  safeOwnerLink,
  stateLabel,
  tone,
  translate,
  variantLabel,
  type IntegrityLocale,
} from './presentation';
import { IntegrityTime } from './feed-integrity-overview';

export function IntegrityEvidence({ value }: { value: unknown }) {
  return (
    <pre
      dir="ltr"
      className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs"
    >
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

export function FeedIntegrityAutopilotPanel({
  settings = false,
  view = 'history',
  locale = 'en',
  selectedId,
  onSelect,
}: {
  settings?: boolean;
  view?: 'pending' | 'history';
  locale?: IntegrityLocale;
  selectedId?: string;
  onSelect?: (id?: string) => void;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const status = useFeedIntegrityAutopilotStatus();
  const actions = useFeedIntegrityAutopilotActions(!settings);
  const update = useUpdateFeedIntegrityAutopilotPolicy(locale);
  const pause = usePauseFeedIntegrityAutopilot(locale);
  const approve = useApproveFeedIntegrityAction(locale);
  const reject = useRejectFeedIntegrityAction(locale);
  const review = useReviewFeedIntegrityUnknownAction(locale);
  const [localId, setLocalId] = useState('');
  const [note, setNote] = useState('');
  const [disposition, setDisposition] = useState<
    'keep_blocked' | 'allow_fresh_approval'
  >('keep_blocked');
  const [page, setPage] = useState(1);
  const id = selectedId ?? localId;
  // Use the polled ledger row; a previously selected proposal can change.
  const selected = actions.data?.items.find(
    (action) => String(action.id) === id
  );
  const select = (value?: string) => {
    setLocalId(value || '');
    onSelect?.(value);
    setNote('');
    setDisposition('keep_blocked');
    approve.reset();
    reject.reset();
    review.reset();
  };
  const policy = status.data?.policy;
  const paused =
    !!policy?.autopilot_paused_until &&
    Date.parse(policy.autopilot_paused_until) > Date.now();
  const pending = approve.isPending || reject.isPending || review.isPending;
  const executable = selected?.action_class === 'news_snapshot.refresh_window';
  const uncertain =
    executable &&
    selected?.outcome === 'tool_failed' &&
    selected?.error_class === 'effect_unknown';
  const error = approve.error || reject.error || review.error;
  const finished = () => select();
  const rows = (actions.data?.items || []).filter(
    (action) => view === 'history' || actionNeedsReview(action)
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  const input = evidenceRecord(selected?.input?.evidence);
  const output = evidenceRecord(selected?.output);
  const verification = evidenceRecord(selected?.verification);
  const ownerLink = safeOwnerLink(selected?.input?.deep_link);
  const reviewBlocked = actions.isError || status.isError || !policy;
  if (settings)
    return (
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">
            {t('Reviewed News repair', 'إصلاح الأخبار بمراجعة بشرية')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(
              'Refresh one News snapshot window after reviewing its evidence. Every repair requires approval.',
              'تحديث لقطة أخبار لفترة واحدة بعد مراجعة الأدلة. كل إصلاح يتطلب موافقة.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {status.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('Repair settings unavailable', 'إعدادات الإصلاح غير متاحة')}:{' '}
              {status.error.message}
            </p>
          ) : null}
          {update.error || pause.error ? (
            <p role="alert" className="text-sm text-destructive">
              {update.error?.message || pause.error?.message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              aria-label={t('Repairs enabled', 'تفعيل الإصلاح')}
              checked={policy?.autopilot_enabled ?? false}
              disabled={!policy || status.isError || update.isPending}
              onCheckedChange={(autopilot_enabled) =>
                update.mutate({ autopilot_enabled })
              }
            />
            <span className="text-sm">
              {policy?.autopilot_enabled
                ? t('Repair recommendations enabled', 'توصيات الإصلاح مفعلة')
                : t('Repair recommendations disabled', 'توصيات الإصلاح معطلة')}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['observe', 'assist'] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-md border p-3 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${policy?.autopilot_mode === mode ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
                aria-pressed={policy?.autopilot_mode === mode}
                disabled={!policy || status.isError || update.isPending}
                onClick={() =>
                  update.mutate({
                    autopilot_mode: mode,
                    autopilot_action_modes: {},
                  })
                }
              >
                <span className="block font-medium">
                  {mode === 'observe'
                    ? t('Record recommendations', 'تسجيل التوصيات')
                    : t('Allow reviewed repairs', 'السماح بالإصلاحات المعتمدة')}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {mode === 'observe'
                    ? t(
                        'Observe · Records proposals for investigation.',
                        'مراقبة · يسجل المقترحات للتحقق.'
                      )
                    : t(
                        'Assist · An admin must approve each exact window.',
                        'مساعدة · يوافق المسؤول على كل فترة محددة.'
                      )}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={
                !policy ||
                status.isError ||
                pause.isPending ||
                !policy.autopilot_enabled
              }
              onClick={() => pause.mutate(paused ? 0 : 120)}
            >
              {paused
                ? t('Resume repairs', 'استئناف الإصلاح')
                : t('Pause repairs 2h', 'إيقاف الإصلاح لساعتين')}
            </Button>
            {paused ? (
              <p className="text-xs text-muted-foreground">
                {t('Paused until', 'متوقف حتى')}{' '}
                <bdi>
                  {new Date(
                    policy?.autopilot_paused_until || ''
                  ).toLocaleString(locale)}
                </bdi>
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'Check scheduling is independent. Changing the repair mode does not approve existing proposals. Settings apply immediately.',
              'جدولة الفحوصات مستقلة. تغيير وضع الإصلاح لا يوافق على المقترحات القائمة. تُطبق الإعدادات مباشرة.'
            )}
          </p>
        </CardContent>
      </Card>
    );
  if (
    view === 'pending' &&
    !actions.isError &&
    !actions.isLoading &&
    !rows.length &&
    !id
  )
    return null;
  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base">
          {view === 'pending'
            ? t('Repair reviews', 'مراجعات الإصلاح')
            : t('Repair activity', 'نشاط الإصلاح')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {view === 'pending'
            ? t(
                'Snapshot proposals and uncertain effects that need an admin decision.',
                'مقترحات اللقطات والآثار غير المؤكدة التي تتطلب قرار المسؤول.'
              )
            : t(
                'Latest 100 recorded decisions and attempts. A successful tool call still requires recovery verification.',
                'آخر ١٠٠ قرار ومحاولة مسجلة. نجاح تنفيذ الأداة يتطلب التحقق من التعافي.'
              )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {actions.isError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>
              {t('Repair activity unavailable', 'نشاط الإصلاح غير متاح')}:{' '}
              {actions.error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.refetch()}
            >
              {t('Retry', 'إعادة المحاولة')}
            </Button>
          </div>
        ) : null}
        {actions.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('Loading repair activity…', 'جارٍ تحميل نشاط الإصلاح…')}
          </p>
        ) : null}
        <div className="divide-y">
          {rows
            .slice((currentPage - 1) * 10, currentPage * 10)
            .map((action) => (
              <button
                key={action.id}
                onClick={() => select(String(action.id))}
                className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-start hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block text-sm font-medium">
                    {actionTitle(action, locale)} ·{' '}
                    <bdi>{variantLabel(action.target_scope, locale)}</bdi>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {action.guardrail
                      ? `${reasonLabel(action.guardrail, locale)} · `
                      : ''}
                    <IntegrityTime value={action.created_at} locale={locale} />
                  </span>
                </span>
                <Badge
                  variant={tone(
                    action.error_class === 'effect_unknown'
                      ? 'effect_unknown'
                      : action.outcome
                  )}
                >
                  {stateLabel(
                    action.error_class === 'effect_unknown' &&
                      actionNeedsReview(action)
                      ? 'effect_unknown'
                      : action.outcome,
                    locale
                  )}
                </Badge>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </button>
            ))}
        </div>
        {!actions.isLoading && !actions.isError && !rows.length ? (
          <p className="text-sm text-muted-foreground">
            {t('No repair decisions recorded.', 'لا توجد قرارات إصلاح مسجلة.')}
          </p>
        ) : null}
        {rows.length > 10 ? (
          <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
            <bdi>
              {currentPage} / {Math.ceil(rows.length / 10)}
            </bdi>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('Previous', 'السابق')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage * 10 >= rows.length}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('Next', 'التالي')}
              </Button>
            </div>
          </div>
        ) : null}
        <Dialog
          open={!!id}
          onOpenChange={(open) => {
            if (!open) finished();
          }}
        >
          <DialogContent
            lang={locale}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            closeLabel={t('Close review', 'إغلاق المراجعة')}
            className={`max-h-[90vh] max-w-2xl overflow-y-auto ${locale === 'ar' ? 'font-sans' : ''}`}
          >
            <DialogHeader className="text-start">
              <DialogTitle>
                {executable
                  ? t('Review snapshot repair', 'مراجعة إصلاح لقطة الأخبار')
                  : t('Owner referral', 'إحالة إلى النظام المسؤول')}
              </DialogTitle>
              <DialogDescription>
                {t(
                  'Review the exact target, expected effect and recorded evidence.',
                  'راجع الهدف الدقيق والأثر المتوقع والأدلة المسجلة.'
                )}
              </DialogDescription>
            </DialogHeader>
            {!selected ? (
              <p role="status" className="text-sm">
                {actions.isLoading
                  ? t(
                      'Loading the selected record…',
                      'جارٍ تحميل السجل المحدد…'
                    )
                  : t(
                      'This record is not in the latest loaded activity. Refresh or select another record.',
                      'هذا السجل غير موجود في آخر نشاط محمل. حدّث البيانات أو اختر سجلًا آخر.'
                    )}
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {ownerLabel(selected.owner_system, locale)} ·{' '}
                    <bdi>{variantLabel(selected.target_scope, locale)}</bdi>
                  </p>
                  <Badge
                    variant={tone(
                      uncertain ? 'effect_unknown' : selected.outcome
                    )}
                  >
                    {stateLabel(
                      uncertain ? 'effect_unknown' : selected.outcome,
                      locale
                    )}
                  </Badge>
                </div>
                <p>
                  {executable
                    ? t(
                        'Expected effect: rebuild this single News snapshot through CMS. It does not restore missing media files or fix feed response latency. Recovery requires subsequent clean checks.',
                        'الأثر المتوقع: إعادة بناء لقطة أخبار واحدة عبر CMS. لا يعيد ملفات الوسائط المفقودة ولا يصلح بطء استجابة الخلاصة. يتطلب التعافي فحوصات سليمة لاحقة.'
                      )
                    : t(
                        'Investigate this referral in the responsible system. This record has no executable snapshot repair.',
                        'تحقق من هذه الإحالة في النظام المسؤول. لا يتضمن هذا السجل إصلاح لقطة قابلًا للتنفيذ.'
                      )}
                </p>
                {ownerLink ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={ownerLink}>
                      {t('Open', 'فتح')}{' '}
                      {ownerLabel(selected.owner_system, locale)}
                    </Link>
                  </Button>
                ) : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-xs">
                  <dt className="text-muted-foreground">
                    {t('Proposal recorded', 'سُجل المقترح')}
                  </dt>
                  <dd>
                    <IntegrityTime
                      value={selected.created_at}
                      locale={locale}
                    />
                  </dd>
                  {typeof input.built_at === 'string' ? (
                    <>
                      <dt className="text-muted-foreground">
                        {t('Input snapshot built', 'بُنيت لقطة الإدخال')}
                      </dt>
                      <dd>
                        <IntegrityTime value={input.built_at} locale={locale} />
                      </dd>
                    </>
                  ) : null}
                  {typeof output.built_at === 'string' ? (
                    <>
                      <dt className="text-muted-foreground">
                        {t('Rebuilt snapshot', 'اللقطة المعاد بناؤها')}
                      </dt>
                      <dd>
                        <IntegrityTime
                          value={output.built_at}
                          locale={locale}
                        />
                      </dd>
                    </>
                  ) : null}
                  {typeof output.slide_count === 'number' ? (
                    <>
                      <dt className="text-muted-foreground">
                        {t('Recorded slides', 'الشرائح المسجلة')}
                      </dt>
                      <dd>
                        <bdi>{output.slide_count}</bdi>
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">
                    {t('Recovery verification', 'التحقق من التعافي')}
                  </dt>
                  <dd>
                    {typeof verification.passed === 'boolean'
                      ? verification.passed
                        ? t('Passed', 'اجتاز الفحص')
                        : t('Not verified', 'لم يُثبت')
                      : t(
                          'No verification result recorded',
                          'لا توجد نتيجة تحقق مسجلة'
                        )}
                  </dd>
                </dl>
                <details className="space-y-3 border-t pt-4">
                  <summary className="cursor-pointer font-medium">
                    {t('Technical evidence', 'الأدلة التقنية')}
                  </summary>
                  <p className="text-xs text-muted-foreground" dir="auto">
                    {selected.reason || selected.guardrail}
                  </p>
                  <p>{t('Input evidence', 'أدلة الإدخال')}</p>
                  <IntegrityEvidence value={selected.input} />
                  <p>{t('Recorded effect', 'الأثر المسجل')}</p>
                  <IntegrityEvidence value={selected.output} />
                  <p>{t('Verification', 'التحقق')}</p>
                  <IntegrityEvidence value={selected.verification} />
                  <IntegrityEvidence
                    value={{
                      action_class: selected.action_class,
                      outcome: selected.outcome,
                      guardrail: selected.guardrail,
                      error_class: selected.error_class,
                    }}
                  />
                </details>
                {error ? (
                  <p role="alert" className="text-destructive">
                    {error.message}
                  </p>
                ) : null}
                {(executable && selected.outcome === 'approval_required') ||
                uncertain ? (
                  <div className="space-y-3 border-t pt-4">
                    {reviewBlocked ? (
                      <p className="text-xs text-destructive">
                        {t(
                          'Review is disabled while current repair settings or activity are unavailable.',
                          'المراجعة معطلة ما دامت إعدادات الإصلاح أو نشاطه الحالي غير متاح.'
                        )}
                      </p>
                    ) : null}
                    {uncertain ? (
                      <p>
                        {t(
                          'The previous attempt may have changed the snapshot. This review records a decision and never replays that attempt. Any later repair requires fresh evidence and a new approval.',
                          'قد تكون المحاولة السابقة غيّرت اللقطة. تسجل هذه المراجعة قرارًا ولا تعيد تنفيذ المحاولة. أي إصلاح لاحق يتطلب أدلة وموافقة جديدين.'
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'CMS rechecks freshness, policy and the exact target before admitting this repair.',
                          'يعيد CMS التحقق من حداثة الأدلة والسياسة والهدف الدقيق قبل قبول الإصلاح.'
                        )}
                      </p>
                    )}
                    <label className="block">
                      {t('Review note', 'ملاحظة المراجعة')}
                      <Textarea
                        aria-label={t(
                          'Repair review note',
                          'ملاحظة مراجعة الإصلاح'
                        )}
                        value={note}
                        maxLength={2000}
                        disabled={pending || reviewBlocked}
                        onChange={(e) => setNote(e.target.value)}
                        className="mt-2"
                      />
                    </label>
                    {uncertain ? (
                      <>
                        <select
                          aria-label={t(
                            'Unknown effect disposition',
                            'قرار الأثر غير المؤكد'
                          )}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          disabled={pending || reviewBlocked}
                          value={disposition}
                          onChange={(e) =>
                            setDisposition(e.target.value as typeof disposition)
                          }
                        >
                          <option value="keep_blocked">
                            {t('Keep blocked', 'إبقاء الحظر')}
                          </option>
                          <option value="allow_fresh_approval">
                            {t(
                              'Allow a fresh approval',
                              'السماح بموافقة جديدة'
                            )}
                          </option>
                        </select>
                        <Button
                          disabled={!note.trim() || pending || reviewBlocked}
                          onClick={() =>
                            review.mutate(
                              { id: selected.id, reason: note, disposition },
                              { onSuccess: finished }
                            )
                          }
                        >
                          {t('Record review', 'تسجيل المراجعة')}
                        </Button>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={!note.trim() || pending || reviewBlocked}
                          onClick={() =>
                            approve.mutate(
                              { id: selected.id, reason: note },
                              { onSuccess: finished }
                            )
                          }
                        >
                          {t('Approve this repair', 'الموافقة على هذا الإصلاح')}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!note.trim() || pending || reviewBlocked}
                          onClick={() =>
                            reject.mutate(
                              { id: selected.id, reason: note },
                              { onSuccess: finished }
                            )
                          }
                        >
                          {t('Reject', 'رفض')}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
