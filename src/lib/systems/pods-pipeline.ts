import type { PodsAutomationStatus } from '@/lib/api/cms/pods-automation';

export type SystemControlLocale = 'en' | 'ar';
export const pipelineText =
  (locale: SystemControlLocale) => (en: string, ar: string) =>
    locale === 'ar' ? ar : en;
export const pipelineNumber = (value: number, locale: SystemControlLocale) =>
  new Intl.NumberFormat(locale).format(value);
export function pipelineActivity(
  data: PodsAutomationStatus,
  locale: SystemControlLocale
): string {
  const t = pipelineText(locale);
  const activity = data.activity;
  if (!activity) return t('Activity not reported', 'حالة العمل غير متاحة');
  const parts: string[] = [];
  const add = (value: number, en: string, ar: string) => {
    if (value > 0) parts.push(`${t(en, ar)}: ${pipelineNumber(value, locale)}`);
  };
  add(
    activity.running_steps,
    'Processing steps running',
    'خطوات معالجة قيد التنفيذ'
  );
  add(
    activity.running_source_runs,
    'Source runs in progress',
    'عمليات جمع قيد التنفيذ'
  );
  add(
    activity.claimed_steps + activity.admitted_source_runs,
    'Admitted work waiting to start',
    'أعمال مقبولة تنتظر البدء'
  );
  add(
    activity.verifying_steps + activity.verifying_source_runs,
    'Results being verified',
    'نتائج قيد التحقق'
  );
  add(
    activity.unresolved_steps,
    'Work outcomes need checking',
    'نتائج عمل تحتاج إلى مراجعة'
  );
  return parts.length
    ? parts.join(' · ')
    : t('No active processing', 'لا توجد معالجة نشطة');
}

export function pipelineState(
  data: PodsAutomationStatus,
  locale: SystemControlLocale
): string {
  const t = pipelineText(locale);
  if (data.paused) return t('Paused', 'متوقف مؤقتاً');
  if (!data.ready) return t('Enabled · Needs setup', 'مفعّل · يحتاج إلى إعداد');
  const a = data.activity;
  if (!a)
    return t('Enabled · Activity unavailable', 'مفعّل · حالة العمل غير متاحة');
  if (a.unresolved_steps)
    return t(
      'Enabled · Outcomes need checking',
      'مفعّل · نتائج تحتاج إلى مراجعة'
    );
  if (a.running_steps + a.running_source_runs > 0)
    return t('Enabled · Processing', 'مفعّل · قيد المعالجة');
  if (
    a.claimed_steps +
      a.admitted_source_runs +
      a.verifying_steps +
      a.verifying_source_runs >
    0
  )
    return t('Enabled · Work pending', 'مفعّل · يوجد عمل قيد الانتظار');
  return t('Enabled · Idle', 'مفعّل · لا يوجد عمل نشط');
}

// Freeze the facts an operator reviews. Moving activity counts do not make a
// review stale, but scope, authority and processing/publication settings do.
export function pipelineReviewKey(data: PodsAutomationStatus): string {
  return JSON.stringify([
    data.version,
    data.environment,
    data.tenant_id,
    data.can_manage,
    data.ready,
    data.active_sources,
    data.processing_mode,
    data.source_override_count,
    data.automatic_source_overrides,
    data.auto_publish,
    data.chaptering_enabled,
  ]);
}

export function pipelineTrigger(
  trigger: string,
  locale: SystemControlLocale
): string {
  const t = pipelineText(locale);
  const labels: Record<string, string> = {
    schedule: t(
      'Requested automatically · Source schedule',
      'طُلب تلقائياً · جدول المصدر'
    ),
    manual: t('Requested manually', 'طُلب يدوياً'),
    approval_handoff: t(
      'Requested after source approval',
      'طُلب بعد اعتماد المصدر'
    ),
    system: t('Requested by the system', 'طُلب من النظام'),
  };
  return labels[trigger] ?? t('Origin not recorded', 'سبب البدء غير مسجّل');
}
