'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Database, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  localEnvironmentAPI,
  type EnvironmentOverview,
  type EnvironmentReport,
  type PreparationPlan,
  type EnvironmentEvent,
  type UpgradeJob,
} from '@/lib/api/local-environments';
import RelocationPanel from '@/components/platform/database-environments/relocation-panel';
import EnvironmentNextStep, {
  nextEnvironmentStep,
  MigrationBlockerNotice,
} from '@/components/platform/database-environments/next-step';

const text = {
  en: {
    title: 'Environments & Database Health',
    subtitle:
      'Read environment status. Edit its .env file and choose it when starting.',
    running: 'Currently running',
    next: 'Default file',
    last: 'Last successful startup',
    environments: 'Environments',
    health: 'Database health',
    activity: 'Activity',
    advanced: 'Advanced relocation',
    check: 'Check now',
    review: 'Advanced recovery',
    upgrade: 'Repair and migrate',
    run: 'Confirm and run reviewed changes',
    upgradeIntro:
      'The launcher will pause database-writing services, execute only these reviewed changes, verify the result and restart services. Console stays open. Other app features and sign-in may be temporarily unavailable.',
    runningOnly:
      'To execute changes, start this environment first. Checks for other environments remain read-only.',
    jobTitle: 'Repair and migration progress',
    jobHistory: 'Earlier repair and migration attempt',
    previousJob: 'Previous app launch — this is the result of an earlier run.',
    historyGuidance:
      'Use the current Next step below, or Check now. This earlier result is kept for reference.',
    historyCheckPassed:
      'The latest database check passed. The earlier result below does not describe the current database status.',
    historicalResult: 'Result at the time of this attempt',
    jobAttention:
      'Execution stopped. Read the reason below before retrying. Completed changes, if any, remain applied.',
    jobSuccess: 'Reviewed migrations applied and verified. Services restarted.',
    noUpgrade: 'No reviewed changes are needed.',
    save: 'Save reviewed preparation',
    saved: 'Preparation review saved. Stop the stack before executing it.',
    untouched:
      'Stop the current app, then run the command for the file you want.',
    unchecked: 'Not checked',
    none: 'None',
    preserve: 'Preserve data',
    disposable: 'Explicitly disposable',
    steps: 'Proposed effects',
    blocked: 'Preparation needs owner attention',
    stop: 'For advanced recovery, stop the app and run:',
    detail: 'Detailed evidence',
    pending: 'pending migrations',
    pendingGuidance:
      'Pending migrations allow local startup. Features requiring them may be unavailable. Use Repair and migrate here, or stop the app before using the terminal migration command.',
    workBlocked: 'Migration blocked',
    historyRetained: 'Processing history retained',
    schemaReady:
      'These unresolved records are preserved. Qualified schema migrations can run with database writers paused; processing recovery remains a separate task.',
    workCount:
      'stored work records require owner reconciliation before migrations.',
    workUnknown:
      'Migration work could not be checked. Check again before reviewing preparation.',
    workEvidence:
      'Expired leases and closed requests do not prove that attempt effects are settled. These counts may overlap.',
    expired: 'Expired leases',
    terminalRequests: 'Attempts linked to closed requests',
    pipeline: 'Open Pipeline',
    delivery:
      'Follow Next step above. Verified repairs can settle some attempts; unproven work needs an investigation. Repeating checks only refreshes the evidence.',
    repairable: 'attempts have proof and can be settled by Repair and migrate.',
    unproven: 'content attempts still need evidence from the owning service.',
    inactiveWork:
      'Inspect the owning workflow while this environment is running.',
    blockedReview:
      'Resolve the blockers and check again. This review cannot be saved or executed.',
    unknown:
      'Unable to read local state. The offline command works without the stack.',
    refresh: 'Refresh history',
    select: 'Inspect an environment',
    cancel: 'Close review',
    observed: 'Last checked',
    preserved:
      'Only the chosen configuration runs. Startup does not migrate or reset data.',
    setup: 'Environment files',
    notConfigured: 'Not configured',
    setupIntro:
      'Keep one private .env file per environment. Each file contains its database, Redis allocation and bucket settings.',
    setupGuidance:
      'Create the file manually, or use this optional template command. Edit it in your editor; registration and a setup wizard are not required.',
    setupCredentials:
      'Existing settings stay in your private file. Apply pending database migrations separately in your terminal.',
    setupReturn: 'After saving, stop the current app and start this file',
    setupFile: 'Private settings file:',
  },
  ar: {
    title: 'البيئات وصحة قواعد البيانات',
    subtitle: 'راقب حالة البيئة. عدّل ملف .env واختره عند تشغيل التطبيق.',
    running: 'البيئة الحالية',
    next: 'الملف الافتراضي',
    last: 'آخر تشغيل ناجح',
    environments: 'البيئات',
    health: 'صحة قواعد البيانات',
    activity: 'النشاط',
    advanced: 'نقل قاعدة البيانات — متقدم',
    check: 'افحص الآن',
    review: 'راجع التجهيز',
    upgrade: 'أصلح ونفّذ الترحيلات',
    run: 'أكّد ونفّذ التغييرات المراجَعة',
    upgradeIntro:
      'سيوقف المشغّل الخدمات التي تكتب في قاعدة البيانات، وينفّذ هذه التغييرات المراجَعة فقط، ويتحقق من النتيجة ثم يعيد تشغيل الخدمات. تبقى لوحة التحكم مفتوحة. قد تتوقف الميزات الأخرى وتسجيل الدخول مؤقتاً.',
    runningOnly:
      'شغّل هذه البيئة أولاً لتنفيذ التغييرات. فحص البيئات الأخرى للقراءة فقط.',
    jobTitle: 'تقدم الإصلاح والترحيلات',
    jobHistory: 'محاولة إصلاح وترحيل سابقة',
    previousJob: 'تشغيل سابق للتطبيق — هذه نتيجة محاولة سابقة.',
    historyGuidance:
      'اتبع الخطوة التالية الحالية أدناه أو اضغط «افحص الآن». هذه النتيجة السابقة محفوظة للرجوع إليها.',
    historyCheckPassed:
      'اجتازت قاعدة البيانات الفحص الأحدث. النتيجة السابقة أدناه لا تصف حالة قاعدة البيانات الحالية.',
    historicalResult: 'النتيجة وقت هذه المحاولة',
    jobAttention:
      'توقف التنفيذ. اقرأ السبب أدناه قبل المحاولة مجدداً. تبقى التغييرات المنفّذة، إن وجدت، مطبّقة.',
    jobSuccess:
      'طُبّقت الترحيلات المراجَعة وتم التحقق منها وإعادة تشغيل الخدمات.',
    noUpgrade: 'لا توجد تغييرات تحتاج إلى التنفيذ.',
    save: 'احفظ مراجعة التجهيز',
    saved: 'حُفظت المراجعة. أوقف جميع الخدمات قبل تنفيذ التجهيز.',
    untouched: 'أوقف التطبيق الحالي، ثم نفّذ أمر الملف الذي تريد تشغيله.',
    unchecked: 'لم تُفحص',
    none: 'لا يوجد',
    preserve: 'الحفاظ على البيانات',
    disposable: 'بيئة مؤقتة صراحةً',
    steps: 'التغييرات المقترحة',
    blocked: 'يتطلب التجهيز مراجعة من مالك الخدمة',
    stop: 'للاستعادة المتقدمة، أوقف التطبيق ونفّذ:',
    detail: 'الأدلة والتفاصيل',
    pending: 'ترحيلات معلّقة',
    pendingGuidance:
      'الترحيلات المعلّقة لا تمنع التشغيل المحلي. قد لا تتوفر الميزات التي تحتاجها. استخدم «أصلح ونفّذ الترحيلات» هنا، أو أوقف التطبيق قبل تنفيذ أمر الترحيل في الطرفية.',
    workBlocked: 'تنفيذ الترحيلات محظور',
    historyRetained: 'سجل المعالجة محفوظ',
    schemaReady:
      'تبقى هذه السجلات غير المحسومة محفوظة. يمكن تطبيق ترحيلات المخطط المؤهلة بعد إيقاف الكتّاب مؤقتاً؛ استعادة المعالجة تبقى مهمة منفصلة.',
    workCount: 'سجل عمل يحتاج إلى تسوية من الخدمة المالكة قبل تنفيذ الترحيلات.',
    workUnknown: 'تعذر فحص سجلات العمل. أعد الفحص قبل مراجعة التجهيز.',
    workEvidence:
      'انتهاء المهلة أو إغلاق الطلب لا يثبت تسوية آثار المحاولة. قد تتداخل هذه الأعداد.',
    expired: 'المهل المنتهية',
    terminalRequests: 'محاولات مرتبطة بطلبات مغلقة',
    pipeline: 'افتح Pipeline',
    delivery:
      'اتبع الخطوة التالية أعلاه. يمكن للأدلة المؤكدة تسوية بعض المحاولات؛ العمل غير المحسوم يحتاج إلى التحقيق. تكرار الفحص يحدّث الأدلة فقط.',
    repairable: 'محاولة لها دليل ويمكن تسويتها عبر الإصلاح والترحيل.',
    unproven: 'محاولة معالجة محتوى لا تزال تحتاج إلى دليل من الخدمة المالكة.',
    inactiveWork: 'افحص سير العمل المسؤول أثناء تشغيل هذه البيئة.',
    blockedReview:
      'عالج العوائق ثم أعد الفحص. لا يمكن حفظ هذه المراجعة أو تنفيذها.',
    unknown:
      'تعذرت قراءة الحالة المحلية. يمكنك استخدام الأمر المحلي دون تشغيل الخدمات.',
    refresh: 'حدّث السجل',
    select: 'اختر بيئة للفحص',
    cancel: 'أغلق المراجعة',
    observed: 'آخر فحص',
    preserved:
      'تعمل إعدادات الملف المختار فقط. التشغيل لا ينفّذ الترحيلات ولا يعيد ضبط البيانات.',
    setup: 'ملفات البيئات',
    notConfigured: 'غير مُعدّة',
    setupIntro:
      'احتفظ بملف .env خاص لكل بيئة، يتضمن قاعدة البيانات وتخصيص Redis وإعدادات التخزين.',
    setupGuidance:
      'أنشئ الملف يدوياً أو استخدم أمر القالب الاختياري. عدّل الملف في محرّرك؛ لا يلزم التسجيل أو معالج إعداد.',
    setupCredentials:
      'تبقى إعداداتك في الملف الخاص. نفّذ ترحيلات قاعدة البيانات بشكل منفصل في الطرفية.',
    setupReturn: 'بعد الحفظ، أوقف التطبيق الحالي وشغّل هذا الملف',
    setupFile: 'ملف الإعدادات الخاص:',
  },
};
const label = (state: string) => state.replaceAll('_', ' ');
const date = (value: string) =>
  value.startsWith('0001-') ? '—' : new Date(value).toLocaleString();
const workSubjects: Record<string, { en: string; ar: string }> = {
  lifecycle_operation_claims: {
    en: 'Lifecycle claims',
    ar: 'عمليات دورة الحياة',
  },
  source_run_attempts: {
    en: 'Source-run attempts',
    ar: 'محاولات تشغيل المصادر',
  },
  content_stage_attempts: {
    en: 'Content processing attempts',
    ar: 'محاولات معالجة المحتوى',
  },
  pipeline_repair_requests: {
    en: 'Pipeline repair requests',
    ar: 'طلبات إصلاح المعالجة',
  },
  artifact_coverage_requests: {
    en: 'Artifact coverage requests',
    ar: 'طلبات تغطية المخرجات',
  },
  atomization_work_requests: {
    en: 'Atomization requests',
    ar: 'طلبات تقسيم المحتوى',
  },
  studio_clearance_requests: {
    en: 'Studio clearance requests',
    ar: 'طلبات موافقة الاستوديو',
  },
  media_supply_actions: {
    en: 'Media supply actions',
    ar: 'عمليات إمداد الوسائط',
  },
};

const repairReasons: Record<string, { en: string; ar: string }> = {
  effect_requires_owner_proof: {
    en: 'Completion or the current output has not been verified',
    ar: 'لم يتم التحقق من الاكتمال أو المخرجات الحالية',
  },
  matching_attempt_receipt_missing: {
    en: 'The completion receipt for this exact attempt is missing',
    ar: 'إيصال اكتمال هذه المحاولة نفسها غير موجود',
  },
  request_correlation_mismatch: {
    en: 'The attempt does not match its request',
    ar: 'المحاولة لا تتطابق مع طلبها',
  },
  lease_not_quiescent: {
    en: 'The attempt is still within its execution waiting period',
    ar: 'المحاولة لا تزال ضمن مهلة انتظار التنفيذ',
  },
};

function MigrationWorkNotice({
  work,
  language,
  current,
}: {
  work: NonNullable<EnvironmentReport['databases'][number]['migration_work']>;
  language: 'en' | 'ar';
  current: boolean;
}) {
  if (work.state === 'ready') return null;
  const t = text[language];
  if (work.schema_upgrade_ready)
    return (
      <div className="space-y-2 rounded-sm border p-3" role="status">
        <p className="font-semibold">
          {t.historyRetained} · {work.count}
        </p>
        <p>{t.schemaReady}</p>
      </div>
    );
  const contentAttempts = work.checks.some(
    (check) => check.subject === 'content_stage_attempts' && check.count > 0
  );
  return (
    <div
      className="space-y-2 rounded-sm border border-amber-500/50 bg-amber-500/10 p-3"
      role="status"
    >
      <p className="font-semibold">{t.workBlocked}</p>
      <MigrationBlockerNotice work={work} language={language} />
      <p>
        {work.state === 'unknown'
          ? t.workUnknown
          : `${work.count} ${t.workCount}`}
      </p>
      {work.checks
        .filter((check) => check.count > 0)
        .map((check) => (
          <div key={check.subject}>
            <p>
              {workSubjects[check.subject]?.[language] ?? label(check.subject)}{' '}
              · {check.count}
            </p>
            {(check.expired !== undefined ||
              check.terminal_requests !== undefined) && (
              <p className="text-xs text-muted-foreground">
                {t.expired}: {check.expired ?? 0} · {t.terminalRequests}:{' '}
                {check.terminal_requests ?? 0}
              </p>
            )}
          </div>
        ))}
      {work.state === 'blocked' && (
        <p className="text-xs text-muted-foreground">{t.workEvidence}</p>
      )}
      {work.attempt_repair && work.blocked_by?.reason !== 'live_work' && (
        <div className="space-y-1 text-sm">
          {work.attempt_repair.actions.length > 0 && (
            <p>
              {work.attempt_repair.actions.length} {t.repairable}
            </p>
          )}
          {work.attempt_repair.remaining > 0 && (
            <p>
              {work.attempt_repair.remaining} {t.unproven}
            </p>
          )}
          <ul className="text-xs text-muted-foreground">
            {Object.entries(work.attempt_repair.reasons)
              .filter(([, count]) => count > 0)
              .map(([reason, count]) => (
                <li key={reason}>
                  {count} · {repairReasons[reason]?.[language] ?? label(reason)}
                </li>
              ))}
          </ul>
        </div>
      )}
      {contentAttempts &&
        work.blocked_by?.reason !== 'live_work' &&
        (current ? (
          <>
            <p className="text-xs">{t.delivery}</p>
            <Link
              className="inline-block underline underline-offset-4"
              href="/platform/pipeline"
            >
              {t.pipeline}
            </Link>
          </>
        ) : (
          <p className="text-xs">{t.inactiveWork}</p>
        ))}
    </div>
  );
}

export default function DatabaseMigrationsPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const t = text[language];
  const [overview, setOverview] = useState<EnvironmentOverview | null>(null);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [plan, setPlan] = useState<PreparationPlan | null>(null);
  const [upgradeJob, setUpgradeJob] = useState<UpgradeJob | null>(null);
  const [events, setEvents] = useState<EnvironmentEvent[]>([]);
  const [busy, setBusy] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('environments');
  const [showSetup, setShowSetup] = useState(false);
  const [setupEnvironment, setSetupEnvironment] = useState('dev');
  const jobActive =
    !!upgradeJob &&
    [
      'queued',
      'building',
      'pausing',
      'applying',
      'verifying',
      'restarting',
    ].includes(upgradeJob.state);
  const load = useCallback(async () => {
    try {
      const value = await localEnvironmentAPI.overview();
      setLoadError('');
      setOverview((previous) => {
        if (previous?.runtime?.id && previous.runtime.id !== value.runtime?.id)
          window.location.reload();
        return value;
      });
      setSelected(
        (previous) =>
          previous ||
          value.runtime?.environment ||
          value.selection.next_environment ||
          value.selection.default_environment
      );
    } catch (reason) {
      setLoadError(
        reason instanceof Error ? reason.message : 'Local status unavailable'
      );
    }
  }, []);
  useEffect(() => {
    if (jobActive) return;
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15_000);
    return () => clearInterval(interval);
  }, [load, jobActive]);
  useEffect(() => {
    setReport(overview?.reports[selected] || null);
    setPlan(null);
    setEvents([]);
    setNotice('');
  }, [selected]);
  useEffect(() => {
    // An open review keeps its exact evidence. Once the run ends (including a
    // partial repair), show the newer authoritative report saved by the job.
    if (plan || jobActive || busy) return;
    const latest = overview?.reports[selected];
    if (!latest || latest.environment !== selected) return;
    setReport((previous) =>
      !previous ||
      previous.environment !== selected ||
      Date.parse(latest.observed_at) > Date.parse(previous.observed_at)
        ? latest
        : previous
    );
  }, [overview?.reports, selected, plan, jobActive, busy]);
  useEffect(() => {
    const saved = overview?.upgrades?.[selected];
    if (saved)
      setUpgradeJob((previous) =>
        !previous ||
        saved.id !== previous.id ||
        saved.updated_at > previous.updated_at
          ? saved
          : previous
      );
    else
      setUpgradeJob((previous) =>
        previous?.environment === selected ? previous : null
      );
  }, [overview?.upgrades, selected]);
  useEffect(() => {
    if (!upgradeJob || !jobActive) return;
    let disposed = false;
    let waiting = false;
    const poll = async () => {
      if (waiting) return;
      waiting = true;
      try {
        const value = await localEnvironmentAPI.upgradeJob(upgradeJob.id);
        if (!disposed) {
          setError('');
          setLoadError('');
          setUpgradeJob(value);
          if (
            ![
              'queued',
              'building',
              'pausing',
              'applying',
              'verifying',
              'restarting',
            ].includes(value.state)
          )
            void load();
        }
      } catch (reason) {
        if (!disposed)
          setError(
            reason instanceof Error ? reason.message : 'Job status unavailable'
          );
      } finally {
        waiting = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [upgradeJob?.id, jobActive, load]);
  const action = async (name: string, work: () => Promise<void>) => {
    setBusy(name);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Action did not complete'
      );
    } finally {
      setBusy('');
    }
  };
  const inspect = () =>
    action('check', async () => {
      setPlan(null);
      const value = await localEnvironmentAPI.inspect(selected);
      await load();
      setReport(value);
    });
  const review = () =>
    action('plan', async () => {
      const value = await localEnvironmentAPI.plan(selected);
      setReport(value.report);
      setPlan(value);
    });
  const history = () =>
    action('history', async () => {
      setEvents((await localEnvironmentAPI.history(selected)).items);
    });
  const reviewUpgrade = () =>
    action('upgrade-plan', async () => {
      const value = await localEnvironmentAPI.upgradePlan(selected);
      setReport(value.report);
      setPlan(value);
      if (!value.blocked.length && !value.steps.length) setNotice(t.noUpgrade);
    });
  const current = overview?.runtime;
  const historicalJob =
    !!upgradeJob &&
    !jobActive &&
    !!current?.id &&
    upgradeJob.runtime_id !== current.id;
  const historyCheckPassed =
    historicalJob &&
    !!report &&
    report.environment === selected &&
    report.environment === upgradeJob?.environment &&
    Date.parse(report.observed_at) > Date.parse(upgradeJob.updated_at) &&
    nextEnvironmentStep(report) === 'ready';
  const jobTimeline = upgradeJob && (
    <ol
      className="max-h-72 space-y-1 overflow-auto rounded-sm bg-muted p-3 font-mono text-xs"
      dir="ltr"
    >
      {upgradeJob.messages.map((message, index) => (
        <li key={index}>
          {date(message.at)} · {message.text}
        </li>
      ))}
    </ol>
  );
  const configured = (id: string) =>
    overview?.configuration?.[id]?.state === 'configured';
  const visibleError = error || loadError;
  const running =
    current && ['starting', 'running', 'stopping'].includes(current.state)
      ? `${current.environment} · ${label(current.state)}`
      : current
        ? label(current.state)
        : t.none;
  return (
    <div
      className="space-y-6"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid="database-migration-cockpit"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Database className="h-7 w-7" />
            {t.title}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSetup((previous) => !previous)}
          >
            {t.setup}
          </Button>
          <Button
            variant="outline"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            aria-label="Change language"
          >
            {language === 'en' ? 'العربية' : 'English'}
          </Button>
        </div>
      </header>
      {showSetup && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t.setup} · <span dir="ltr">{setupEnvironment}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{t.setupIntro}</p>
            <p>{t.setupGuidance}</p>
            <pre className="overflow-x-auto rounded-sm border p-3" dir="ltr">
              {`./scripts/env.sh add ${setupEnvironment}`}
            </pre>
            <p className="text-muted-foreground">{t.setupCredentials}</p>
            <p className="font-medium">{t.setupReturn}</p>
            <pre className="overflow-x-auto rounded-sm border p-3" dir="ltr">
              {`./start.sh --env ${setupEnvironment}`}
            </pre>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [t.running, running],
          [t.next, overview ? 'stable' : '—'],
          [t.last, overview?.last_successful?.environment || t.none],
        ].map(([title, value]) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold" dir="auto">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {visibleError && (
        <div
          role="alert"
          className="flex gap-2 rounded-sm border border-destructive/40 p-4 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {visibleError}
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-sm border p-4 text-sm">
          {notice}
        </p>
      )}
      {busy && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {language === 'ar' ? 'جارٍ التحقق…' : 'Checking…'}
        </p>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          if (value === 'activity' && selected) void history();
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="environments">{t.environments}</TabsTrigger>
          <TabsTrigger value="health">{t.health}</TabsTrigger>
          <TabsTrigger value="activity">{t.activity}</TabsTrigger>
          <TabsTrigger value="advanced">{t.advanced}</TabsTrigger>
        </TabsList>
        <TabsContent value="environments" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t.untouched} {t.preserved}
          </p>
          {overview ? (
            <div className="divide-y rounded-sm border">
              {overview.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div>
                    <h2 className="font-semibold" dir="ltr">
                      {profile.id}
                    </h2>
                    <p className="text-sm text-muted-foreground" dir="auto">
                      {profile.purpose}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {profile.preservation === 'preserve'
                        ? t.preserve
                        : t.disposable}{' '}
                      ·{' '}
                      {!configured(profile.id)
                        ? t.notConfigured
                        : overview.reports[profile.id]
                          ? `${label(overview.reports[profile.id]!.state)} · ${date(overview.reports[profile.id]!.observed_at)}`
                          : t.unchecked}
                    </p>
                    {!configured(profile.id) && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.setupFile}{' '}
                        <code dir="ltr">{`environments/.private/${profile.id}.env`}</code>
                        .
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!configured(profile.id) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSetupEnvironment(profile.id);
                          setShowSetup(true);
                        }}
                      >
                        {t.setup}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={!!busy || !configured(profile.id)}
                      onClick={() => {
                        setSelected(profile.id);
                        setTab('health');
                        void action('check', async () => {
                          setReport(
                            await localEnvironmentAPI.inspect(profile.id)
                          );
                          await load();
                        });
                      }}
                    >
                      {t.health}
                    </Button>
                    <code
                      className="rounded-sm border px-3 py-2 text-xs"
                      dir="ltr"
                    >
                      {`./start.sh --env ${profile.id}`}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-sm border p-5 text-sm text-muted-foreground">
              {t.unknown} <code dir="ltr">./scripts/env.sh list</code>
            </p>
          )}
        </TabsContent>
        <TabsContent value="health" className="space-y-4">
          {upgradeJob && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {historicalJob
                    ? t.jobHistory
                    : `${t.jobTitle} · ${label(upgradeJob.state)}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm" aria-live="polite">
                {historicalJob ? (
                  <>
                    <p className="text-muted-foreground">
                      {historyCheckPassed
                        ? t.historyCheckPassed
                        : t.historyGuidance}
                    </p>
                    <details className="space-y-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {t.previousJob} {date(upgradeJob.updated_at)}
                      </summary>
                      <p>
                        {t.historicalResult} · {label(upgradeJob.state)}
                      </p>
                      {jobTimeline}
                    </details>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {date(upgradeJob.updated_at)}
                    </p>
                    {jobActive && (
                      <p className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.upgradeIntro}
                      </p>
                    )}
                    {upgradeJob.state === 'succeeded' && (
                      <p className="text-emerald-600">{t.jobSuccess}</p>
                    )}
                    {['needs_attention', 'interrupted'].includes(
                      upgradeJob.state
                    ) && (
                      <div
                        className="space-y-2 rounded-sm border border-amber-500/50 bg-amber-500/10 p-3"
                        role="alert"
                      >
                        <p className="font-semibold">{t.jobAttention}</p>
                        <p className="break-words" dir="auto">
                          {
                            upgradeJob.messages[upgradeJob.messages.length - 1]
                              ?.text
                          }
                        </p>
                      </div>
                    )}
                    {jobTimeline}
                  </>
                )}
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              {t.select}
              <select
                className="ms-3 rounded-sm border bg-background p-2"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={!!busy || jobActive}
              >
                {overview?.profiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    disabled={!configured(profile.id)}
                  >
                    {profile.id}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={
                !selected || !!busy || jobActive || !configured(selected)
              }
              onClick={() => void inspect()}
            >
              {t.check}
            </Button>
            <Button
              disabled={
                !selected ||
                !!busy ||
                jobActive ||
                current?.environment !== selected ||
                (!!report &&
                  [
                    'check',
                    'config',
                    'investigate',
                    'wait',
                    'advanced',
                    'ready',
                  ].includes(nextEnvironmentStep(report))) ||
                !configured(selected)
              }
              onClick={() => void reviewUpgrade()}
            >
              {t.upgrade}
            </Button>
            <Button
              variant="outline"
              disabled={
                !selected || !!busy || jobActive || !configured(selected)
              }
              onClick={() => void review()}
            >
              {t.review}
            </Button>
          </div>
          {selected && current?.environment !== selected && (
            <p className="text-sm text-muted-foreground">{t.runningOnly}</p>
          )}
          {report ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t.observed}: {date(report.observed_at)} ·{' '}
                <span dir="ltr">{report.environment}</span>
              </p>
              {!jobActive && (
                <EnvironmentNextStep
                  key={`${report.id}:${language}`}
                  report={report}
                  language={language}
                  current={current?.environment === report.environment}
                  busy={!!busy}
                  onReview={() => void reviewUpgrade()}
                  onAdvanced={() => void review()}
                  onCheck={() => void inspect()}
                />
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {report.databases.map((db) => (
                  <Card key={db.owner}>
                    <CardHeader>
                      <CardTitle className="flex justify-between gap-2 text-base">
                        <span dir="ltr">{db.owner.toUpperCase()}</span>
                        <span
                          className={
                            db.state === 'ready'
                              ? 'text-emerald-600'
                              : 'text-muted-foreground'
                          }
                        >
                          {label(db.state)}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="break-all font-mono text-xs" dir="ltr">
                        {db.target}
                      </p>
                      <p>
                        {db.pending.length} {t.pending}
                      </p>
                      {db.migration_work && (
                        <MigrationWorkNotice
                          work={db.migration_work}
                          language={language}
                          current={current?.environment === report.environment}
                        />
                      )}
                      {db.issues.slice(0, 3).map((issue) => (
                        <p key={issue} dir="auto">
                          {issue}
                        </p>
                      ))}
                      {db.warnings?.map((warning) => (
                        <p
                          key={warning}
                          dir="auto"
                          className="text-amber-700 dark:text-amber-400"
                        >
                          {warning}
                        </p>
                      ))}
                      {db.missing.length > 0 && (
                        <p
                          className="break-words text-muted-foreground"
                          dir="ltr"
                        >
                          Missing: {db.missing.join(', ')}
                        </p>
                      )}
                      {db.owner === 'iam' && (
                        <p className="text-xs text-muted-foreground">
                          Version {db.version} ·{' '}
                          {db.dirty ? 'dirty' : db.ledger}. IAM history uses
                          version/dirty evidence; historical checksums are
                          unavailable.
                        </p>
                      )}
                      <details>
                        <summary className="cursor-pointer">{t.detail}</summary>
                        <pre
                          className="mt-2 max-h-80 overflow-auto rounded-sm bg-muted p-3 text-xs"
                          dir="ltr"
                        >
                          {JSON.stringify(db, null, 2)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {report.resources.map((resource) => (
                <div
                  key={resource.resource}
                  className="rounded-sm border p-4 text-sm"
                >
                  <p className="font-semibold">
                    {resource.resource} · {label(resource.state)}
                  </p>
                  <p
                    className="break-all text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {resource.target}
                  </p>
                  <p className="mt-1" dir="auto">
                    {resource.detail}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <p className="rounded-sm border p-5 text-sm text-muted-foreground">
              {t.unchecked}
            </p>
          )}
          {plan && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {plan.blocked.length ? t.blocked : t.steps}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {[
                  ...new Set(
                    plan.report.databases.flatMap((db) => db.warnings || [])
                  ),
                ].map((warning) => (
                  <p
                    key={warning}
                    dir="auto"
                    className="text-amber-700 dark:text-amber-400"
                  >
                    {warning}
                  </p>
                ))}
                {plan.blocked.map((reason) => (
                  <p key={reason} className="text-destructive">
                    {reason}
                  </p>
                ))}
                <ol className="list-decimal space-y-2 ps-5">
                  {plan.steps.map((step, index) => (
                    <li key={index} dir="auto">
                      <span className="font-medium">{step.owner}: </span>
                      {step.summary}
                      {step.migration && (
                        <p
                          className="break-all font-mono text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {step.migration.file} · {step.migration.class}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <details>
                  <summary className="cursor-pointer">{t.detail}</summary>
                  <pre
                    className="mt-2 max-h-96 overflow-auto bg-muted p-3 text-xs"
                    dir="ltr"
                  >
                    {JSON.stringify(plan, null, 2)}
                  </pre>
                </details>
                {plan.blocked.length > 0 ? (
                  <p className="font-medium">{t.blockedReview}</p>
                ) : plan.mode === 'upgrade' ? (
                  <p>{t.upgradeIntro}</p>
                ) : (
                  <>
                    <p>{t.stop}</p>
                    <pre
                      className="overflow-auto rounded-sm bg-muted p-3"
                      dir="ltr"
                    >
                      {`./scripts/env.sh prepare --env ${plan.environment}`}
                    </pre>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Review expires: {date(plan.expires_at)}. New evidence or later
                  stages require another review.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      !!busy ||
                      jobActive ||
                      plan.blocked.length > 0 ||
                      plan.steps.length === 0
                    }
                    onClick={() =>
                      void action('review', async () => {
                        if (plan.mode === 'upgrade') {
                          setUpgradeJob(
                            await localEnvironmentAPI.upgrade(
                              plan.id,
                              plan.digest
                            )
                          );
                          setPlan(null);
                          return;
                        }
                        await localEnvironmentAPI.review(plan.id, plan.digest);
                        setNotice(t.saved);
                        setPlan(null);
                      })
                    }
                  >
                    {plan.mode === 'upgrade' ? t.run : t.save}
                  </Button>
                  <Button variant="outline" onClick={() => setPlan(null)}>
                    {t.cancel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center gap-3">
            <span dir="ltr" className="font-semibold">
              {selected}
            </span>
            <Button
              variant="outline"
              disabled={!selected || !!busy}
              onClick={() => void history()}
            >
              {t.refresh}
            </Button>
          </div>
          <div className="divide-y rounded-sm border">
            {events.length ? (
              events.map((event) => (
                <div key={event.id} className="p-4 text-sm">
                  <p className="font-medium">{label(event.kind)}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(event.at)} · {event.actor}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer">{t.detail}</summary>
                    <pre
                      className="max-h-80 overflow-auto bg-muted p-3 text-xs"
                      dir="ltr"
                    >
                      {JSON.stringify(event.detail, null, 2)}
                    </pre>
                  </details>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                {language === 'ar'
                  ? 'لا يوجد نشاط مسجّل لهذه البيئة.'
                  : 'No recorded activity for this environment.'}
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="advanced">
          <RelocationPanel
            language={language}
            onDatabaseHealth={() => setTab('health')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
