import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WorkloadLocale = 'en' | 'ar';
export const copy = (locale: WorkloadLocale, en: string, ar: string) =>
  locale === 'ar' ? ar : en;

export function observedResourceState(reading: {
  available: boolean;
  healthy: boolean;
  reason: string;
  state: string;
}) {
  if (!reading.available) return 'unavailable';
  if (!reading.healthy)
    return reading.reason ===
      'Confirmed System Health incident affects this resource'
      ? 'incident'
      : 'unhealthy';
  return reading.state;
}

const names: Record<string, [string, string]> = {
  admit: ['Admitted', 'مقبول'],
  admit_reduced: ['Reduced grant', 'قبول مخفّض'],
  acquired: ['Reserved, not started', 'محجوز ولم يبدأ'],
  handed_off: ['With native owner', 'لدى الجهة المسؤولة'],
  grandfathered: ['Existing work', 'عمل قائم'],
  recovering: ['Recovering', 'قيد التعافي'],
  observed: ['Requests recorded', 'طلبات مسجلة'],
  not_exercised: ['Not exercised', 'لم يُستخدم'],
  request: ['Admission request', 'طلب قبول'],
  began: ['Execution began', 'بدأ التنفيذ'],
  renewed: ['Lease renewed', 'جُدد الحجز'],
  policy_changed: ['Policy reviewed', 'رُوجعت السياسة'],
  paused: ['Temporary bypass', 'استثناء مؤقت'],
  governed: ['Governor boundary', 'مسار يضبطه المنظّم'],
  human: ['Direct human action', 'إجراء بشري مباشر'],
  source_supply: ['Source supply', 'إمداد المصادر'],
  content_stages: ['Content stages', 'مراحل المحتوى'],
  enrichment_campaign: ['Enrichment campaigns', 'حملات الإثراء'],
  studio_autopilot: ['Studio automation', 'أتمتة الاستوديو'],
  preferences_autopilot: ['Preferences automation', 'أتمتة التفضيلات'],
  source_intelligence: ['Source intelligence', 'تحليل المصادر'],
  transcription_owner: ['Direct transcription jobs', 'مهام التفريغ المباشر'],
  discovery: ['Discovery scoring', 'تقييم الاكتشاف'],
  manual_content: ['Manual content', 'محتوى يدوي'],
  manual_transcript_edit: ['Manual transcript edit', 'تعديل التفريغ يدويًا'],
  manual_topic: ['Manual topic edit', 'تعديل الموضوع يدويًا'],
  transcript_writeback: [
    'Transcript refresh continuation',
    'استكمال تحديث التفريغ',
  ],
  serving_requests: ['Interactive retrieval', 'الاسترجاع التفاعلي'],
  delegated: ['Via native owner', 'عبر الجهة المسؤولة'],
  diagnostic: ['Diagnostics only', 'تشخيص فقط'],
  input: ['Evidence input', 'مصدر أدلة'],
  exempt: ['Explicitly exempt', 'مستثنى صراحةً'],
  self: ['Governor maintenance', 'صيانة المنظّم'],
  atomize: ['Media atomization', 'تجزئة الوسائط'],
  news_stage: ['News processing', 'معالجة الأخبار'],
  pods_stage: ['Pods processing', 'معالجة بودز'],
  agg_fetch_queue: ['Source collection queue', 'طابور جمع المصادر'],
  agg_media_queue: ['Media processing queue', 'طابور معالجة الوسائط'],
  agg_news_queue: ['News processing queues', 'طوابير معالجة الأخبار'],
  agg_pods_queue: ['Pods processing queues', 'طوابير معالجة بودز'],
  aggregation_svc: ['Aggregation initiation slots', 'حجوزات بدء التجميع'],
  stt_slots: ['Transcription initiation slots', 'حجوزات بدء التفريغ الصوتي'],
  llm_slots: [
    'Language model initiation slots',
    'حجوزات بدء مهام النماذج اللغوية',
  ],
  source_run: ['Source runs', 'تشغيل المصادر'],
  content_stage: ['Content processing', 'معالجة المحتوى'],
  artifact_coverage: ['Artifact coverage', 'تغطية مخرجات المعالجة'],
  pipeline_repair: ['Pipeline repair', 'إصلاح خط المعالجة'],
  enrichment_autopilot: ['Enrichment automation', 'أتمتة الإثراء'],
  media_circulation: ['Media Circulation', 'تداول الوسائط'],
  media_studio: ['Media Studio', 'استوديو الوسائط'],
  preferences: ['Preferences', 'التفضيلات'],
  embedding_campaign: ['Embedding campaigns', 'حملات التضمين'],
  redundancy_hygiene: ['Redundancy Hygiene', 'تنظيم التكرار'],
  feed_integrity_deep: [
    'Feed Integrity deep checks',
    'فحوصات سلامة الخلاصات المتعمقة',
  ],
  embedding_lifecycle: ['Embedding lifecycle', 'دورة حياة التضمين'],
  classification_backfill: ['Classification backfill', 'استكمال التصنيف'],
  operator: ['Operator', 'المشغّل'],
  pipeline_autopilot: ['Pipeline diagnostics', 'تشخيص خط المعالجة'],
  system_health: ['System Health', 'صحة النظام'],
  ai_spend: ['AI Spend', 'إنفاق الذكاء الاصطناعي'],
  intelligence_refresh: ['Ranking refresh', 'تحديث الترتيب'],
  related_backfill: ['Related content backfill', 'استكمال المحتوى المرتبط'],
  experience_retention_rollups: [
    'Experience and retention rollups',
    'تجميعات التجربة والاحتفاظ',
  ],
  supply_projection_recovery: [
    'Supply verification and recovery',
    'التحقق من الإمداد واستعادته',
  ],
  workload_governor: ['Workload Governor', 'منظّم العمل والسعة'],
  insufficient_observed_requests: [
    'More observed requests needed',
    'يلزم تسجيل المزيد من الطلبات',
  ],
  insufficient_observation_window: [
    'Observation window is too short',
    'فترة المراقبة غير كافية',
  ],
  insufficient_verified_completions: [
    'More verified completions needed',
    'يلزم المزيد من إثباتات اكتمال التنفيذ',
  ],
  no_observed_capacity_collision: [
    'Observe a capacity-related delay',
    'رصد تأجيل مرتبط بالسعة',
  ],
  unknown_admission_evidence: [
    'Some admission evidence is unknown',
    'بعض أدلة القبول غير معروفة',
  ],
  unresolved_owner_effects: [
    'Native execution effects are unresolved',
    'آثار التنفيذ لدى الجهة المسؤولة غير محسومة',
  ],
  closed_utc_hours: [
    'Observation uses completed UTC hours',
    'تستخدم المراقبة ساعات التوقيت العالمي المكتملة',
  ],
  minimum_24h_observe_window: [
    'At least 24 hours of observation',
    '٢٤ ساعة من المراقبة على الأقل',
  ],
  minimum_20_requests_per_class: [
    'At least 20 requests per class',
    '٢٠ طلبًا لكل فئة على الأقل',
  ],
  minimum_5_verified_completions_per_class: [
    'At least 5 verified completions per class',
    '٥ عمليات مكتملة ومثبتة لكل فئة على الأقل',
  ],
  zero_unresolved_effects: [
    'No unresolved execution effects',
    'دون آثار تنفيذ غير محسومة',
  ],
  current_fresh_resource_evidence: [
    'Current resource evidence required',
    'يلزم وجود أدلة حديثة للموارد',
  ],
  native_owner_guards_remain_authoritative: [
    'Native owner guards retain authority',
    'تظل ضوابط الجهة المسؤولة ملزمة',
  ],
  human_review_of_delivery_and_service_reliability_required: [
    'Human review of delivery and service reliability required',
    'تلزم مراجعة بشرية للتسليم وموثوقية الخدمات',
  ],
  off: ['Off', 'متوقف'],
  observe: ['Observe', 'مراقبة'],
  enforce: ['Enforce', 'تطبيق'],
  normal: ['Available', 'متاحة'],
  idle: ['Idle', 'دون عمل حاليًا'],
  incident: ['Health incident', 'حادث خدمة'],
  healthy: ['Available', 'متاحة'],
  available: ['Available', 'متاحة'],
  constrained: ['Under pressure', 'تحت ضغط'],
  saturated: ['At capacity', 'السعة ممتلئة'],
  unhealthy: ['Not ready', 'غير جاهزة'],
  unavailable: ['No reading', 'لا توجد قراءة'],
  unknown: ['Unknown', 'غير معروفة'],
  stale: ['Out of date', 'قديمة'],
  fresh: ['Current', 'حديثة'],
  covered: ['Covered', 'مغطاة'],
  missing: ['Missing evidence', 'أدلة مفقودة'],
  ready: ['Ready for review', 'جاهز للمراجعة'],
  not_ready: ['Needs evidence', 'تحتاج أدلة'],
  granted: ['Granted', 'مُصرّح'],
  allow: ['Allowed', 'مسموح'],
  allowed: ['Allowed', 'مسموح'],
  defer: ['Deferred', 'مؤجل'],
  deferred: ['Deferred', 'مؤجل'],
  would_defer: ['Would defer', 'سيُؤجَّل'],
  bypass: ['Bypassed', 'مُستثنى'],
  bypassed: ['Bypassed', 'مُستثنى'],
  reserved: ['Reserved', 'محجوز'],
  running: ['Running', 'قيد التنفيذ'],
  started: ['Started', 'بدأ'],
  completed: ['Completed', 'مكتمل'],
  released: ['Released', 'محرر'],
  expired: ['Expired', 'منتهي'],
  uncertain: ['Execution unresolved', 'التنفيذ غير محسوم'],
  revoked: ['Revoked before start', 'أُلغي قبل البدء'],
  failed: ['Failed', 'فشل'],
  ai_enqueue: ['AI queue', 'طابور الذكاء الاصطناعي'],
  source_pull: ['Source collection', 'جمع المصادر'],
  media_enqueue: ['Media queue', 'طابور الوسائط'],
  stt_batch: ['Transcription', 'التفريغ الصوتي'],
  llm_batch: ['Language model work', 'مهام النموذج اللغوي'],
  text_embedding: ['Text embedding', 'تضمين النص'],
  image_embedding: ['Image embedding', 'تضمين الصور'],
  heavy_sweep: ['Database sweep', 'مسح قاعدة البيانات'],
  external_probe: ['External checks', 'فحوصات خارجية'],
  aggregation_ai: ['AI workers', 'معالجات الذكاء الاصطناعي'],
  aggregation_media: ['Media workers', 'معالجات الوسائط'],
  enrichment_svc: ['Enrichment', 'الإثراء'],
  media_svc: ['Media', 'الوسائط'],
  cms_db: ['CMS database', 'قاعدة بيانات المحتوى'],
  llm_budget: ['Language model allowance', 'مخصص النماذج اللغوية'],
  stt_budget: ['Transcription allowance', 'مخصص التفريغ الصوتي'],
};

export const name = (value: string, locale: WorkloadLocale): string => {
  if (value.startsWith('caller:'))
    return `${name(value.split(':')[1], locale)} · ${copy(locale, 'no requests recorded', 'لم تُسجّل طلبات')}`;
  const [resource, reason] = value.split(':', 2);
  if (reason === 'not_ready')
    return `${name(resource, locale)} · ${copy(locale, 'current evidence needed', 'يلزم دليل حديث')}`;
  return names[value]?.[locale === 'ar' ? 1 : 0] || value.replaceAll('_', ' ');
};

export function WorkloadState({
  value,
  locale,
}: {
  value: string;
  locale: WorkloadLocale;
}) {
  const good = [
    'normal',
    'healthy',
    'available',
    'fresh',
    'covered',
    'completed',
    'ready',
    'released',
    'idle',
  ].includes(value);
  const warning = [
    'constrained',
    'defer',
    'deferred',
    'would_defer',
    'stale',
    'uncertain',
    'recovering',
    'unavailable',
  ].includes(value);
  const bad = [
    'saturated',
    'unhealthy',
    'incident',
    'failed',
    'blocked',
  ].includes(value);
  const active = [
    'observe',
    'enforce',
    'running',
    'handed_off',
    'admit',
    'admit_reduced',
  ].includes(value);
  const Icon =
    value === 'observe'
      ? Eye
      : value === 'enforce'
        ? ShieldCheck
        : good
          ? CheckCircle2
          : warning
            ? Clock3
            : bad
              ? AlertCircle
              : Circle;
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-4',
        good
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : warning
            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
            : bad
              ? 'bg-destructive/10 text-red-700 dark:text-red-300'
              : active
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {name(value, locale)}
    </span>
  );
}

export function WorkloadPanel({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight sm:text-base">
            {title}
          </h2>
          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WorkloadTime({
  value,
  locale,
}: {
  value?: string | null;
  locale: WorkloadLocale;
}) {
  if (
    !value ||
    value.startsWith('0001-') ||
    !Number.isFinite(Date.parse(value))
  )
    return (
      <span className="text-muted-foreground">
        {copy(locale, 'No timestamp', 'لا يوجد توقيت')}
      </span>
    );
  return (
    <time dateTime={value} title={value}>
      {new Date(value).toLocaleString(
        locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )}
    </time>
  );
}

export function WorkloadNotice({
  locale,
  title,
  children,
  retry,
}: {
  locale: WorkloadLocale;
  title: string;
  children?: ReactNode;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        {children && (
          <div className="break-words text-muted-foreground">{children}</div>
        )}
      </div>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          {copy(locale, 'Try again', 'إعادة المحاولة')}
        </Button>
      )}
    </div>
  );
}

export function EmptyWorkload({
  locale,
  title,
  description,
}: {
  locale: WorkloadLocale;
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center">
      <p className="text-sm font-medium">
        {title ||
          copy(locale, 'No evidence recorded yet', 'لم تُسجَّل أدلة بعد')}
      </p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export const errorMessage = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string'
    ? error.message
    : '';

export const inputClass =
  'min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
