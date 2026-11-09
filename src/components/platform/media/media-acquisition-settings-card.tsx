'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/lib/console-link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useMediaAcquisitionConfig,
  useUpdateMediaAcquisitionConfig,
} from '@/hooks/use-media-acquisition';
import { useSystemControlLocale } from '@/hooks/use-system-control-locale';
import { pipelineText } from '@/lib/systems/pods-pipeline';
import type { MediaAcquisitionConfig } from '@/lib/api/cms/media-acquisition';
import type { MediaAcquisitionMode } from '@/types/platform/source';

type Draft = { mode: MediaAcquisitionMode; limit: string };
const draftFrom = (value: MediaAcquisitionConfig): Draft => ({
  mode: value.default_mode,
  limit: String(value.pods_source_run_item_limit),
});

export function MediaAcquisitionSettingsCard() {
  const config = useMediaAcquisitionConfig();
  const update = useUpdateMediaAcquisitionConfig();
  const locale = useSystemControlLocale();
  const t = pipelineText(locale);
  const [baseline, setBaseline] = useState<MediaAcquisitionConfig | null>(null);
  const [draft, setDraft] = useState<Draft>({ mode: 'manual', limit: '10' });
  const [review, setReview] = useState<{
    saved: MediaAcquisitionConfig;
    draft: Draft;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const saveRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const dirty = Boolean(
    baseline &&
    (draft.mode !== baseline.default_mode ||
      draft.limit !== String(baseline.pods_source_run_item_limit))
  );
  const changed = Boolean(
    baseline && config.data && baseline.updated_at !== config.data.updated_at
  );
  const valid =
    Number.isInteger(Number(draft.limit)) &&
    Number(draft.limit) >= 1 &&
    Number(draft.limit) <= 50;
  const canManage = config.data?.can_manage === true;
  const busy = checking || update.isPending;
  const unavailable = config.isPending || config.isError || !baseline;

  useEffect(() => {
    // Background refreshes must not replace an operator's draft.
    if (config.data && !dirty) {
      setBaseline(config.data);
      setDraft(draftFrom(config.data));
    }
  }, [config.data, dirty]);

  const save = async (saved: MediaAcquisitionConfig, next: Draft) => {
    const changes = {
      ...(next.mode !== saved.default_mode ? { default_mode: next.mode } : {}),
      ...(Number(next.limit) !== saved.pods_source_run_item_limit
        ? { pods_source_run_item_limit: Number(next.limit) }
        : {}),
    };
    const result = Object.keys(changes).length
      ? await update.mutateAsync({
          ...changes,
          expected_updated_at: saved.updated_at,
        })
      : saved;
    setBaseline(result);
    setDraft(draftFrom(result));
    setReview(null);
  };

  const beginSave = async () => {
    if (
      pending.current ||
      busy ||
      !dirty ||
      !valid ||
      !canManage ||
      unavailable
    )
      return;
    pending.current = true;
    setChecking(true);
    setReviewError('');
    update.reset();
    try {
      const latest = await config.refetch();
      if (latest.isError || !latest.data) return;
      if (!latest.data.can_manage) return;
      if (
        draft.mode !== latest.data.default_mode ||
        baseline?.updated_at !== latest.data.updated_at
      ) {
        setReview({ saved: latest.data, draft: { ...draft } });
      } else {
        await save(latest.data, draft);
      }
    } catch {
      void config.refetch();
    } finally {
      pending.current = false;
      setChecking(false);
    }
  };

  const confirmSave = async () => {
    if (!review || pending.current || busy) return;
    pending.current = true;
    setChecking(true);
    setReviewError('');
    try {
      const latest = await config.refetch();
      if (latest.isError || !latest.data) {
        setReviewError(
          t(
            'Saved settings could not be checked. Your draft is preserved.',
            'تعذّر التحقق من الإعدادات المحفوظة. مسودتك محفوظة.'
          )
        );
      } else if (
        latest.data.updated_at !== review.saved.updated_at ||
        !latest.data.can_manage
      ) {
        setReviewError(
          t(
            'Saved settings or your access changed. Close this review and review the latest values.',
            'تغيّرت الإعدادات المحفوظة أو صلاحياتك. أغلق المراجعة ثم راجع أحدث القيم.'
          )
        );
      } else {
        await save(review.saved, review.draft);
      }
    } catch {
      void config.refetch();
    } finally {
      pending.current = false;
      setChecking(false);
    }
  };

  const discard = () => {
    if (config.data) {
      setBaseline(config.data);
      setDraft(draftFrom(config.data));
      update.reset();
    }
  };
  const modeName = (mode: MediaAcquisitionMode) =>
    mode === 'automatic'
      ? t('Automatic', 'تلقائية')
      : t('By request', 'عند الطلب');

  return (
    <Card dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle>
          {t('Episode processing default', 'المعالجة الافتراضية للحلقات')}
        </CardTitle>
        <CardDescription>
          {t(
            'Source checks save episode previews. Choose how sources without an exception process those episodes.',
            'يحفظ فحص المصادر معاينات الحلقات. اختر طريقة معالجتها للمصادر التي ليس لها استثناء.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {config.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('Loading processing settings…', 'جارٍ تحميل إعدادات المعالجة…')}
          </p>
        ) : (
          <>
            {config.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t(
                  'Current settings could not be checked. Your draft is preserved.',
                  'تعذّر التحقق من الإعدادات الحالية. مسودتك محفوظة.'
                )}{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => config.refetch()}
                >
                  {t('Try again', 'حاول مجدداً')}
                </button>
              </p>
            )}
            {baseline && (
              <>
                <fieldset
                  disabled={unavailable || busy || !canManage}
                  className="space-y-3"
                >
                  <legend className="mb-2 text-sm font-medium">
                    {t('Process new episodes', 'معالجة الحلقات الجديدة')}
                  </legend>
                  {(['manual', 'automatic'] as const).map((mode) => (
                    <label
                      key={mode}
                      className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="pods-processing-default"
                        value={mode}
                        checked={draft.mode === mode}
                        onChange={() => {
                          setDraft({ ...draft, mode });
                          update.reset();
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary [color-scheme:light] dark:[color-scheme:dark]"
                      />
                      <span>
                        <span className="font-medium">{modeName(mode)}</span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {mode === 'manual'
                            ? t(
                                'Keep previews until someone requests download and processing.',
                                'احتفظ بالمعاينات حتى يطلب أحد تنزيلها ومعالجتها.'
                              )
                            : t(
                                'Download and process eligible episodes after a source check.',
                                'تنزيل الحلقات المستوفية للشروط ومعالجتها بعد فحص المصدر.'
                              )}
                        </span>
                      </span>
                    </label>
                  ))}
                  <div className="border-t pt-4">
                    <label
                      className="block text-sm font-medium"
                      htmlFor="pods-source-run-item-limit"
                    >
                      {t(
                        'Max previews per source run',
                        'الحد الأقصى للمعاينات لكل فحص مصدر'
                      )}
                    </label>
                    <Input
                      id="pods-source-run-item-limit"
                      aria-describedby="pods-limit-help"
                      aria-invalid={!valid}
                      type="number"
                      min={1}
                      max={50}
                      value={draft.limit}
                      onChange={(event) => {
                        setDraft({ ...draft, limit: event.target.value });
                        update.reset();
                      }}
                      className="mt-2 w-28"
                    />
                    <p
                      id="pods-limit-help"
                      className="mt-2 text-xs text-muted-foreground"
                    >
                      {t(
                        '1–50 previews. Applies to new source runs; active runs keep their limit.',
                        'من ١ إلى ٥٠ معاينة. يُطبّق على عمليات الفحص الجديدة؛ تحتفظ العمليات الجارية بحدودها.'
                      )}
                    </p>
                  </div>
                </fieldset>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Source exceptions are preserved. The Pods pipeline pause holds automatic and manual processing.',
                    'تُحفظ استثناءات المصادر. إيقاف مسار بودز يوقف المعالجة التلقائية واليدوية.'
                  )}{' '}
                  <Link
                    href="/platform/media/sources#pods-pipeline"
                    className="underline underline-offset-4"
                  >
                    {t('Pipeline controls', 'التحكم بالمسار')}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Chapter publication has its own policy.',
                    'لنشر الفصول سياسة مستقلة.'
                  )}{' '}
                  <Link
                    href="/platform/media/atomization?tab=policy"
                    className="underline underline-offset-4"
                  >
                    {t('Publishing settings', 'إعدادات النشر')}
                  </Link>
                </p>
                {!canManage && (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'View only. Your role cannot change processing settings.',
                      'للعرض فقط. دورك لا يتيح تعديل إعدادات المعالجة.'
                    )}
                  </p>
                )}
                {changed && dirty && (
                  <p role="status" className="text-sm text-warning">
                    {t(
                      'Saved settings changed while you were editing. Review the latest values before saving; your draft is preserved.',
                      'تغيّرت الإعدادات المحفوظة أثناء التحرير. راجع أحدث القيم قبل الحفظ؛ مسودتك محفوظة.'
                    )}
                  </p>
                )}
                {update.isError && !review && (
                  <p role="alert" className="text-sm text-destructive">
                    {update.error.message}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button
                    ref={saveRef}
                    size="sm"
                    disabled={
                      !dirty || !valid || !canManage || unavailable || busy
                    }
                    onClick={() => void beginSave()}
                  >
                    {busy && (
                      <Loader2
                        aria-hidden="true"
                        className="me-2 h-4 w-4 animate-spin"
                      />
                    )}
                    {t('Save changes', 'حفظ التغييرات')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!dirty || busy}
                    onClick={discard}
                  >
                    {t('Discard changes', 'تجاهل التغييرات')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {dirty
                      ? t('Unsaved changes', 'تغييرات غير محفوظة')
                      : `${t('Saved default', 'الإعداد الافتراضي المحفوظ')}: ${modeName(baseline.default_mode)}`}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto [&>button:last-child]:rtl:left-4 [&>button:last-child]:rtl:right-auto"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t('Close settings review', 'إغلاق مراجعة الإعدادات')}
          finalFocus={saveRef}
        >
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>
              {t('Save processing settings?', 'حفظ إعدادات المعالجة؟')}
            </DialogTitle>
            <DialogDescription>
              <span className="capitalize">
                {review?.saved.environment ||
                  t('Environment not reported', 'البيئة غير مسجّلة')}
              </span>{' '}
              · {t('Tenant', 'المستأجر')}: <bdi>{review?.saved.tenant_id}</bdi>
              <br />
              {t(
                'Applies to sources using the tenant default. Source exceptions remain in place.',
                'تُطبّق على المصادر التي تستخدم الإعداد الافتراضي للمستأجر. تبقى استثناءات المصادر محفوظة.'
              )}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-3 text-sm">
              {review.saved.default_mode !== review.draft.mode && (
                <p>
                  {t('Processing', 'المعالجة')}:{' '}
                  {modeName(review.saved.default_mode)} →{' '}
                  {modeName(review.draft.mode)}
                </p>
              )}
              {review.saved.pods_source_run_item_limit !==
                Number(review.draft.limit) && (
                <p>
                  {t('Previews per source run', 'المعاينات لكل فحص مصدر')}:{' '}
                  {review.saved.pods_source_run_item_limit} →{' '}
                  {review.draft.limit}
                </p>
              )}
              {review.saved.default_mode === review.draft.mode &&
                review.saved.pods_source_run_item_limit ===
                  Number(review.draft.limit) && (
                  <p>
                    {t(
                      'The latest saved settings already match your draft.',
                      'أحدث الإعدادات المحفوظة تطابق مسودتك بالفعل.'
                    )}
                  </p>
                )}
              <p
                className="text-muted-foreground"
                hidden={review.draft.mode === review.saved.default_mode}
              >
                {review.draft.mode === 'automatic'
                  ? t(
                      'Eligible episodes that have not started can enter automatic processing. Chapters may publish under the existing publishing policy.',
                      'قد تصبح الحلقات المستوفية للشروط التي لم تبدأ بعد مؤهلة للمعالجة التلقائية. وقد تُنشر الفصول وفق سياسة النشر الحالية.'
                    )
                  : t(
                      'Unstarted inherited requests can be held for a manual processing request. Work already started can finish.',
                      'قد تُعلّق الطلبات الموروثة التي لم تبدأ بعد حتى طلب المعالجة يدوياً. يمكن أن يكتمل العمل الذي بدأ بالفعل.'
                    )}
              </p>
              <p className="text-muted-foreground">
                {t(
                  'Saving preserves the pipeline pause. Processing can continue only when the pipeline is resumed and other restrictions allow it.',
                  'يحافظ الحفظ على إيقاف المسار. لا يمكن استمرار المعالجة إلا بعد استئناف المسار وسماح القيود الأخرى.'
                )}
              </p>
              {reviewError && (
                <p role="alert" className="text-destructive">
                  {reviewError}
                </p>
              )}
              {update.isError && (
                <p role="alert" className="text-destructive">
                  {update.error.message}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              disabled={busy || Boolean(reviewError)}
              onClick={() => void confirmSave()}
            >
              {busy && (
                <Loader2
                  aria-hidden="true"
                  className="me-2 h-4 w-4 animate-spin"
                />
              )}
              {t('Save changes', 'حفظ التغييرات')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
