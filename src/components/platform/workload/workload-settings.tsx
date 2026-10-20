'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  usePauseWorkload,
  useUpdateWorkloadPolicy,
} from '@/hooks/use-workload';
import type {
  WorkloadMode,
  WorkloadPolicy,
  WorkloadPolicyUpdate,
  WorkloadQualification,
  WorkloadRegistry,
} from '@/types/platform/workload';
import type { WorkloadQuery } from './workload-evidence';
import {
  copy,
  errorMessage,
  inputClass,
  name,
  WorkloadNotice,
  WorkloadPanel,
  WorkloadState,
  WorkloadTime,
  type WorkloadLocale,
} from './presentation';

type NumericKey =
  | 'snapshot_max_age_seconds'
  | 'recovery_seconds'
  | 'lease_seconds'
  | 'starvation_minutes';
const fields: [NumericKey, string, string, number, number][] = [
  [
    'snapshot_max_age_seconds',
    'Maximum signal age (seconds)',
    'أقصى عمر للإشارة (ثوانٍ)',
    10,
    300,
  ],
  [
    'recovery_seconds',
    'Recovery cooldown (seconds)',
    'فترة التعافي (ثوانٍ)',
    10,
    3600,
  ],
  [
    'lease_seconds',
    'Reservation lease (seconds)',
    'مدة الحجز (ثوانٍ)',
    30,
    3600,
  ],
  [
    'starvation_minutes',
    'Long wait attention (minutes)',
    'تنبيه الانتظار الطويل (دقائق)',
    5,
    1440,
  ],
];
interface Draft {
  revision: number;
  mode: WorkloadMode;
  classes: string[];
  numbers: Record<NumericKey, string>;
  limits: Record<string, { soft: string; hard: string; capacity: string }>;
}
function fromPolicy(policy: WorkloadPolicy): Draft {
  return {
    revision: policy.revision,
    mode: policy.mode,
    classes: [...policy.enforced_classes],
    numbers: {
      snapshot_max_age_seconds: String(policy.snapshot_max_age_seconds),
      recovery_seconds: String(policy.recovery_seconds),
      lease_seconds: String(policy.lease_seconds),
      starvation_minutes: String(policy.starvation_minutes),
    },
    limits: Object.fromEntries(
      Object.entries(policy.resource_limits).map(([key, value]) => [
        key,
        {
          soft: String(value.soft),
          hard: String(value.hard),
          capacity: String(value.capacity),
        },
      ])
    ),
  };
}
export function WorkloadSettings({
  policy,
  registry,
  qualification,
  locale,
  unavailable,
  refresh,
  onDraftChange,
}: {
  policy?: WorkloadPolicy;
  registry: WorkloadQuery<WorkloadRegistry>;
  qualification: WorkloadQuery<WorkloadQualification>;
  locale: WorkloadLocale;
  unavailable: boolean;
  refresh: () => unknown;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const save = useUpdateWorkloadPolicy();
  const pause = usePauseWorkload();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<WorkloadPolicyUpdate | null>(null);
  const [phrase, setPhrase] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseRevision, setPauseRevision] = useState<number | null>(null);
  const [pauseResume, setPauseResume] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseMinutes, setPauseMinutes] = useState('30');
  const current = draft || (policy ? fromPolicy(policy) : null);
  const conflict = !!draft && draft.revision !== policy?.revision;
  const locked = unavailable || !policy || save.isPending || pause.isPending;
  const paused =
    !!policy?.paused_until && Date.parse(policy.paused_until) > Date.now();
  useEffect(() => {
    if (!draft) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draft]);
  useEffect(() => {
    onDraftChange?.(!!draft);
  }, [draft, onDraftChange]);
  const edit = (fn: (draft: Draft) => Draft) => {
    if (!policy) return;
    setDraft((old) => fn(old || fromPolicy(policy)));
    setFailure('');
    setSaved(false);
  };
  const submit = async (input: WorkloadPolicyUpdate) => {
    setFailure('');
    try {
      await save.mutateAsync(input);
      setDraft(null);
      setNote('');
      setConfirm(null);
      setPhrase('');
      setSaved(true);
    } catch (error) {
      setFailure(
        errorMessage(error) || t('Policy was not saved.', 'لم تُحفَظ السياسة.')
      );
      refresh();
    }
  };
  const preservesClassApproval = (key: string) => {
    if (
      !policy ||
      policy.mode !== 'enforce' ||
      !policy.enforced_classes.includes(key) ||
      !current
    )
      return false;
    return Object.entries(policy.resource_limits).every(([resource, limit]) => {
      const candidate = current.limits[resource];
      return (
        candidate &&
        Number(candidate.soft) === limit.soft &&
        Number(candidate.hard) === limit.hard &&
        Number(candidate.capacity) === limit.capacity
      );
    });
  };
  const reviewSave = () => {
    if (!current || !draft || conflict || locked) return;
    if (!note.trim()) {
      setFailure(
        t('Add a reason for this policy change.', 'أضف سببًا لتغيير السياسة.')
      );
      return;
    }
    const numbers = {} as Record<NumericKey, number>;
    for (const [key, en, ar, min, max] of fields) {
      const raw = current.numbers[key];
      const value = Number(raw);
      if (
        !raw.trim() ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      ) {
        setFailure(
          `${t(en, ar)}: ${t('enter a whole number between', 'أدخل عددًا صحيحًا بين')} ${min}–${max}.`
        );
        return;
      }
      numbers[key] = value;
    }
    const limits: WorkloadPolicyUpdate['resource_limits'] = {};
    for (const [key, value] of Object.entries(current.limits)) {
      const kind = registry.data?.resources.find(
        (item) => item.key === key
      )?.kind;
      if (!kind) {
        setFailure(
          t(
            'Load the current resource registry before saving capacity limits.',
            'حمّل سجل الموارد الحالي قبل حفظ حدود السعة.'
          )
        );
        return;
      }
      const soft = Number(value.soft),
        hard = Number(value.hard),
        capacity = Number(value.capacity);
      if (
        kind === 'pressure' &&
        (!value.soft.trim() ||
          !value.hard.trim() ||
          !Number.isFinite(soft) ||
          !Number.isFinite(hard) ||
          soft < 0 ||
          hard <= soft ||
          hard > 1000000)
      ) {
        setFailure(
          `${name(key, locale)}: ${t('hard limit must exceed the pressure threshold and stay at or below 1,000,000.', 'يجب أن يتجاوز الحد الأقصى عتبة الضغط وألا يزيد عن ١٬٠٠٠٬٠٠٠.')}`
        );
        return;
      }
      if (
        kind === 'slots' &&
        (!value.capacity.trim() ||
          !Number.isInteger(capacity) ||
          capacity < 1 ||
          capacity > 1000)
      ) {
        setFailure(
          `${name(key, locale)}: ${t('enter a whole capacity between 1–1,000.', 'أدخل سعة صحيحة بين ١–١٬٠٠٠.')}`
        );
        return;
      }
      limits[key] =
        kind === 'slots'
          ? { soft: 0, hard: 0, capacity }
          : { soft, hard, capacity: 0 };
    }
    const input: WorkloadPolicyUpdate = {
      revision: current.revision,
      mode: current.mode,
      enforced_classes: current.classes,
      resource_limits: limits,
      ...numbers,
      review_note: note.trim(),
    };
    if (current.mode === 'enforce') {
      const evidence = qualification.data;
      if (
        qualification.isError ||
        !evidence ||
        !current.classes.length ||
        current.classes.some(
          (key) =>
            !evidence.classes.find((item) => item.class === key)?.eligible &&
            !preservesClassApproval(key)
        )
      ) {
        setFailure(
          t(
            'Every newly selected class or changed capacity limit needs current, eligible qualification evidence.',
            'تحتاج كل فئة تُضاف أو تُغيَّر حدود سعتها إلى أدلة جاهزية حديثة ومؤهلة.'
          )
        );
        return;
      }
      setPhrase('');
      setConfirm({ ...input, qualification_digest: evidence.digest });
    } else {
      void submit(input);
    }
  };
  const handlePause = async () => {
    if (
      !policy ||
      locked ||
      !pauseReason.trim() ||
      pauseRevision !== policy.revision
    )
      return;
    setFailure('');
    try {
      await pause.mutateAsync({
        revision: pauseRevision ?? policy.revision,
        minutes: pauseResume ? 0 : Number(pauseMinutes),
        reason: pauseReason.trim(),
      });
      setPauseOpen(false);
      setPauseReason('');
      setSaved(true);
    } catch (error) {
      setFailure(errorMessage(error));
      refresh();
    }
  };
  return (
    <div className="space-y-5">
      {unavailable && (
        <p className="text-sm text-muted-foreground">
          {t(
            'Settings are read-only until current governor evidence is available.',
            'الإعدادات للقراءة فقط حتى تتوفر أدلة المنظّم الحالية.'
          )}
        </p>
      )}
      {conflict && (
        <WorkloadNotice
          locale={locale}
          title={t(
            'The policy changed while you were editing',
            'تغيرت السياسة أثناء التعديل'
          )}
        >
          <p>
            {t(
              'Your draft is preserved. Discard it to load the latest revision, then review and reapply the intended change.',
              'احتُفظ بالمسودة. تجاهلها لتحميل أحدث إصدار، ثم راجع التغيير المطلوب وأعِد إدخاله.'
            )}
          </p>
        </WorkloadNotice>
      )}
      {failure && !pauseOpen && !confirm && (
        <WorkloadNotice
          locale={locale}
          title={t('Change not applied', 'لم يُطبَّق التغيير')}
        >
          {failure}
        </WorkloadNotice>
      )}
      {saved && (
        <p role="status" className="rounded-md border p-3 text-sm">
          {t(
            'Settings saved. Review the current policy below.',
            'حُفظت الإعدادات. راجع السياسة الحالية أدناه.'
          )}
        </p>
      )}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {t('Policy in force', 'السياسة السارية')}
        </p>
        {policy ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <WorkloadState value={policy.mode} locale={locale} />
            <span className="text-muted-foreground">
              {t('Revision', 'الإصدار')} {policy.revision}
            </span>
            <span className="text-xs text-muted-foreground">
              <WorkloadTime value={policy.updated_at} locale={locale} />
            </span>
            {paused && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {t('Bypass until', 'الاستثناء حتى')}{' '}
                <WorkloadTime value={policy.paused_until} locale={locale} />
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('Current policy unavailable.', 'السياسة الحالية غير متاحة.')}
          </p>
        )}
        {!!policy?.enforced_classes.length && (
          <div className="flex flex-wrap gap-2">
            {policy?.enforced_classes.map((key) => (
              <span className="rounded border px-2 py-1 text-xs" key={key}>
                {name(key, locale)}
              </span>
            ))}
          </div>
        )}
        <details className="border-t pt-3 text-xs">
          <summary className="min-h-8 cursor-pointer font-medium">
            {t('Temporary bypass', 'استثناء مؤقت')}
          </summary>
          <p className="my-2 max-w-2xl leading-relaxed text-muted-foreground">
            {t(
              'Temporarily stop capacity admission for an investigation. The saved mode returns when the timer ends; running work is not cancelled.',
              'أوقف ضبط السعة مؤقتًا للتحقيق. يعود الوضع المحفوظ عند انتهاء المدة، ولا يُلغى العمل الجاري.'
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={() => {
              setPauseReason('');
              setFailure('');
              setPauseRevision(policy?.revision ?? null);
              setPauseResume(paused);
              setPauseOpen(true);
            }}
          >
            {paused
              ? t('End temporary bypass', 'إنهاء الاستثناء المؤقت')
              : t('Temporarily bypass admission', 'استثناء مؤقت من ضبط القبول')}
          </Button>
        </details>
      </section>
      <WorkloadPanel
        title={t('Admission settings', 'إعدادات القبول')}
        description={t(
          'Choose how new work is admitted. Changes stay in this draft until you save.',
          'اختر طريقة قبول العمل الجديد. تبقى التغييرات في هذه المسودة حتى تحفظها.'
        )}
      >
        {current && (
          <div className="space-y-5">
            <fieldset disabled={locked || conflict} className="space-y-3">
              <legend className="text-sm font-medium">
                {t('Governor mode', 'وضع المنظّم')}
              </legend>
              <div className="grid gap-3 md:grid-cols-3">
                {(['off', 'observe', 'enforce'] as const).map((mode) => (
                  <label key={mode} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="workload-mode"
                      aria-label={name(mode, locale)}
                      value={mode}
                      checked={current.mode === mode}
                      onChange={() => edit((old) => ({ ...old, mode }))}
                      className="peer sr-only"
                    />
                    <span className="flex h-full min-h-28 flex-col gap-2 rounded-md border p-4 transition-colors hover:bg-muted/30 peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {name(mode, locale)}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 items-center justify-center rounded-full border ${current.mode === mode ? 'border-primary' : 'border-input'}`}
                        >
                          {current.mode === mode && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </span>
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {mode === 'off'
                          ? t(
                              'Let work proceed without capacity admission.',
                              'اسمح باستمرار العمل دون ضبط قبول السعة.'
                            )
                          : mode === 'observe'
                            ? t(
                                'Record decisions while work continues as usual.',
                                'سجّل القرارات مع استمرار العمل كالمعتاد.'
                              )
                            : t(
                                'Apply limits to the classes you review and select.',
                                'طبّق الحدود على الفئات التي تراجعها وتختارها.'
                              )}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {current.mode === 'enforce' && (
              <fieldset
                className="space-y-3 rounded-md border p-4"
                disabled={locked || conflict}
              >
                <legend className="px-1 text-sm font-medium">
                  {t(
                    'Classes selected for enforcement',
                    'الفئات المختارة للتطبيق'
                  )}
                </legend>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Only qualified classes can be added. Existing approvals carry forward while capacity limits stay unchanged. Saving requires an evidence-bound confirmation.',
                    'يمكن إضافة الفئات المؤهلة فقط. وتستمر الموافقات السابقة ما دامت حدود السعة دون تغيير. يتطلب الحفظ تأكيدًا مرتبطًا بالأدلة.'
                  )}
                </p>
                {qualification.isError && (
                  <WorkloadNotice
                    locale={locale}
                    title={t('Qualification unavailable', 'الجاهزية غير متاحة')}
                    retry={() => qualification.refetch()}
                  />
                )}
                {registry.data?.classes.map((item) => {
                  const checked = current.classes.includes(item.key);
                  const eligible =
                    (!!qualification.data?.classes.find(
                      (q) => q.class === item.key
                    )?.eligible ||
                      preservesClassApproval(item.key)) &&
                    !qualification.isError;
                  return (
                    <label
                      className="flex min-h-11 flex-wrap items-center gap-3 text-sm"
                      key={item.key}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={checked}
                        disabled={locked || conflict || (!eligible && !checked)}
                        onChange={(e) =>
                          edit((old) => ({
                            ...old,
                            classes: e.target.checked
                              ? [...old.classes, item.key]
                              : old.classes.filter((key) => key !== item.key),
                          }))
                        }
                      />
                      <span className="flex-1">{name(item.key, locale)}</span>
                      <WorkloadState
                        value={eligible ? 'ready' : 'not_ready'}
                        locale={locale}
                      />
                    </label>
                  );
                })}
              </fieldset>
            )}
            <div className="space-y-1 text-sm">
              <label htmlFor="workload-policy-reason" className="block">
                {t('Reason for policy change', 'سبب تغيير السياسة')}
              </label>
              <Textarea
                id="workload-policy-reason"
                className="scroll-mb-28"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setSaved(false);
                }}
                disabled={locked || conflict}
                maxLength={2000}
                required
              />
            </div>
            <details className="space-y-4 rounded-md border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t(
                  'Resource limits and admission timing',
                  'حدود الموارد وتوقيت القبول'
                )}
              </summary>
              {registry.isError && (
                <WorkloadNotice
                  locale={locale}
                  title={t(
                    'Resource registry unavailable',
                    'سجل الموارد غير متاح'
                  )}
                  retry={() => registry.refetch()}
                />
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fields.map(([key, en, ar, min, max]) => (
                  <label key={key} className="space-y-1 text-sm">
                    <span>{t(en, ar)}</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={min}
                      max={max}
                      step="1"
                      value={current.numbers[key]}
                      disabled={locked || conflict}
                      onChange={(e) =>
                        edit((old) => ({
                          ...old,
                          numbers: { ...old.numbers, [key]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="divide-y">
                {registry.data?.resources.map((item) => {
                  const limits = current.limits[item.key];
                  if (!limits) return null;
                  return (
                    <fieldset
                      className="grid items-start gap-3 py-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)]"
                      key={item.key}
                      disabled={locked || conflict}
                    >
                      <legend className="sr-only">
                        {name(item.key, locale)}
                      </legend>
                      <div className="pt-2 text-sm font-medium">
                        {name(item.key, locale)}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(item.kind === 'slots'
                          ? (['capacity'] as const)
                          : (['soft', 'hard'] as const)
                        ).map((key) => (
                          <label className="space-y-1 text-xs" key={key}>
                            <span>
                              {t(
                                key === 'soft'
                                  ? 'Pressure threshold'
                                  : key === 'hard'
                                    ? 'Hard limit'
                                    : 'Initiation slots',
                                key === 'soft'
                                  ? 'عتبة الضغط'
                                  : key === 'hard'
                                    ? 'الحد الأقصى'
                                    : 'حجوزات بدء المهام'
                              )}
                            </span>
                            <input
                              aria-label={`${name(item.key, locale)} · ${key === 'soft' ? t('Pressure threshold', 'عتبة الضغط') : key === 'hard' ? t('Hard limit', 'الحد الأقصى') : t('Initiation slots', 'حجوزات بدء المهام')}`}
                              className={inputClass}
                              type="number"
                              min={key === 'soft' ? 0 : 1}
                              max={key === 'capacity' ? 1000 : 1000000}
                              value={limits[key]}
                              onChange={(e) =>
                                edit((old) => ({
                                  ...old,
                                  limits: {
                                    ...old.limits,
                                    [item.key]: {
                                      ...old.limits[item.key],
                                      [key]: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'Qualification requires at least',
                  'تتطلب الجاهزية على الأقل'
                )}{' '}
                {policy?.observation_hours}{' '}
                {t('observation hours and', 'ساعة مراقبة و')}{' '}
                {policy?.min_class_requests}{' '}
                {t(
                  'requests per class. These release requirements cannot be lowered here.',
                  'طلبًا لكل فئة. لا يمكن تخفيض متطلبات الإطلاق هذه من هنا.'
                )}
              </p>
            </details>

            <div
              className={`${draft ? 'sticky bottom-0 z-10' : 'relative'} -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-3 border-t bg-card px-4 py-4 sm:-mx-5 sm:-mb-5 sm:px-5`}
            >
              <span className="me-auto text-xs text-muted-foreground">
                {draft
                  ? t('Unsaved draft', 'مسودة غير محفوظة')
                  : t('No pending changes', 'لا توجد تغييرات معلّقة')}
              </span>
              <Button
                variant="outline"
                disabled={!draft || save.isPending || pause.isPending}
                onClick={() => {
                  setDraft(null);
                  setNote('');
                  setFailure('');
                  setSaved(false);
                }}
              >
                {t('Discard draft', 'تجاهل المسودة')}
              </Button>
              <Button
                disabled={
                  !draft ||
                  locked ||
                  conflict ||
                  registry.isError ||
                  !registry.data ||
                  !note.trim()
                }
                onClick={reviewSave}
              >
                {save.isPending
                  ? t('Saving…', 'جارٍ الحفظ…')
                  : t('Save admission settings', 'حفظ إعدادات القبول')}
              </Button>
            </div>
          </div>
        )}
      </WorkloadPanel>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !save.isPending) {
            setConfirm(null);
            setPhrase('');
            setFailure('');
          }
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t('Close', 'إغلاق')}
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              {t('Confirm capacity enforcement', 'تأكيد تطبيق حدود السعة')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Selected classes may defer work. Confirm the reviewed observation record and monitor News/Pods delivery after saving.',
                'قد يُؤجَّل العمل في الفئات المختارة. أكد سجل المراقبة الذي راجعته، وتابع تسليم الأخبار وبودز بعد الحفظ.'
              )}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-inside list-disc text-sm">
            {confirm?.enforced_classes.map((key) => (
              <li key={key}>{name(key, locale)}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t(
              'This confirmation is bound to the displayed qualification digest. Changed evidence or policy must be reviewed again.',
              'يرتبط هذا التأكيد ببصمة أدلة الجاهزية المعروضة. يجب مراجعة الأدلة أو السياسة مجددًا إذا تغيرت.'
            )}
          </p>
          <code dir="ltr" className="break-all rounded bg-muted p-2 text-xs">
            {confirm?.qualification_digest}
          </code>
          <label className="space-y-1 text-sm">
            <span>
              {t(
                'Type ENFORCE CAPACITY to confirm',
                'اكتب ENFORCE CAPACITY للتأكيد'
              )}
            </span>
            <input
              className={inputClass}
              dir="ltr"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={save.isPending}
              autoComplete="off"
            />
          </label>
          {failure && (
            <WorkloadNotice
              locale={locale}
              title={t('Enforcement was not enabled', 'لم يُفعَّل التطبيق')}
            >
              {failure}
            </WorkloadNotice>
          )}
          <Button
            disabled={
              phrase !== 'ENFORCE CAPACITY' ||
              save.isPending ||
              unavailable ||
              conflict ||
              qualification.isError ||
              confirm?.qualification_digest !== qualification.data?.digest
            }
            onClick={() =>
              confirm && submit({ ...confirm, confirmation: phrase })
            }
          >
            {save.isPending
              ? t('Saving…', 'جارٍ الحفظ…')
              : t('Confirm and save enforcement', 'تأكيد وحفظ التطبيق')}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pauseOpen}
        onOpenChange={(open) => {
          if (!pause.isPending) {
            setPauseOpen(open);
            setFailure('');
          }
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          closeLabel={t('Close', 'إغلاق')}
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              {pauseResume
                ? t('End temporary bypass', 'إنهاء الاستثناء المؤقت')
                : t(
                    'Temporarily bypass admission',
                    'استثناء مؤقت من ضبط القبول'
                  )}
            </DialogTitle>
            <DialogDescription>
              {pauseResume
                ? t(
                    'Resume the saved governor mode. Native owner limits remain active throughout.',
                    'استأنف وضع المنظّم المحفوظ. تظل حدود الجهات المسؤولة سارية طوال الوقت.'
                  )
                : t(
                    'New requests bypass governor capacity decisions for a bounded period. Running work is unaffected; native and financial guards stay active.',
                    'تُستثنى الطلبات الجديدة من قرارات سعة المنظّم لفترة محدودة. يستمر العمل الجاري وتظل الضوابط المحلية والمالية سارية.'
                  )}
            </DialogDescription>
          </DialogHeader>
          {!pauseResume && (
            <label className="space-y-1 text-sm">
              <span>{t('Bypass duration', 'مدة الاستثناء')}</span>
              <select
                className={inputClass}
                value={pauseMinutes}
                onChange={(e) => setPauseMinutes(e.target.value)}
              >
                {[15, 30, 60, 120].map((value) => (
                  <option key={value} value={value}>
                    {value} {t('minutes', 'دقيقة')}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span>{t('Bypass reason', 'سبب الاستثناء')}</span>
            <Textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              disabled={pause.isPending}
              maxLength={2000}
            />
          </label>
          {pauseRevision !== policy?.revision && (
            <WorkloadNotice
              locale={locale}
              title={t(
                'Policy changed during review',
                'تغيرت السياسة أثناء المراجعة'
              )}
            >
              {t(
                'Close and reopen this review to use the current policy.',
                'أغلق هذه المراجعة وافتحها مجددًا لاستخدام السياسة الحالية.'
              )}
            </WorkloadNotice>
          )}
          {failure && (
            <WorkloadNotice
              locale={locale}
              title={t('Bypass was not changed', 'لم يتغير الاستثناء')}
            >
              {failure}
            </WorkloadNotice>
          )}
          <Button
            disabled={
              !pauseReason.trim() ||
              locked ||
              pauseRevision !== policy?.revision
            }
            onClick={handlePause}
          >
            {pause.isPending
              ? t('Saving…', 'جارٍ الحفظ…')
              : pauseResume
                ? t('Resume saved mode', 'استئناف الوضع المحفوظ')
                : t('Start temporary bypass', 'بدء الاستثناء المؤقت')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
