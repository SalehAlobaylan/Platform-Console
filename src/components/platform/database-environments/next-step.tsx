'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { EnvironmentReport } from '@/lib/api/local-environments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Step =
  | 'check'
  | 'config'
  | 'investigate'
  | 'wait'
  | 'repair'
  | 'advanced'
  | 'migrate'
  | 'ready';

// Guidance describes existing owner capabilities. It cannot approve a repair,
// infer that an expired attempt succeeded, or bypass a migration prerequisite.
export function nextEnvironmentStep(report: EnvironmentReport): Step {
  if (
    !/^[a-z][a-z0-9-]{0,47}$/.test(report.environment) ||
    !report.databases.length
  )
    return 'check';
  if (report.databases.some((db) => db.state === 'unreachable'))
    return 'config';
  if (
    report.databases.some(
      (db) =>
        !['cms', 'iam'].includes(db.owner) ||
        db.dirty ||
        [
          'unknown',
          'ledger_recovery_required',
          'identity_recovery_required',
          'unsupported_repair',
        ].includes(db.state)
    )
  )
    return 'investigate';
  const work = report.databases.filter(
    (db) =>
      db.migration_work &&
      db.migration_work.state !== 'ready' &&
      !db.migration_work.schema_upgrade_ready
  );
  if (work.some((db) => db.migration_work?.state === 'unknown'))
    return 'investigate';
  if (work.some((db) => db.migration_work?.blocked_by?.reason === 'live_work'))
    return 'wait';
  if (work.length)
    return work.some(
      (db) => (db.migration_work?.attempt_repair?.actions.length ?? 0) > 0
    )
      ? 'repair'
      : 'investigate';
  if (
    report.databases.some(
      (db) => db.owner === 'cms' && db.pending.length > 0 && !db.migration_work
    )
  )
    return 'check';
  if (report.resources.some((resource) => resource.state !== 'ready'))
    return 'config';
  if (
    report.databases.some(
      (db) =>
        db.state === 'fresh_bootstrap_required' ||
        db.pending.some((migration) => migration.requires_destructive_flag)
    )
  )
    return 'advanced';
  if (
    report.databases.some((db) =>
      ['repair_required', 'checksum_repair_required'].includes(db.state)
    )
  )
    return 'repair';
  if (report.databases.some((db) => db.pending.length)) return 'migrate';
  if (
    report.databases.some((db) => db.missing.length || db.state !== 'ready') ||
    report.state !== 'ready'
  )
    return 'investigate';
  return 'ready';
}

const text = {
  en: {
    heading: 'Next step',
    titles: {
      check: 'Check this environment',
      config: 'Check the connection settings',
      investigate: 'Collect an investigation report',
      wait: 'Wait for the owning workflow',
      repair: 'Review the available repairs',
      advanced: 'Review the SQL before applying it',
      migrate: 'Apply the pending migrations',
      ready: 'Database checks passed',
    },
    check: 'Use Check now to get instructions for this environment.',
    config:
      'Read the connection error below. Correct this environment’s private .env file or provider settings, then run this check again.',
    investigate:
      'The current migration prerequisite is blocked. An investigation is needed before another migration run can help.',
    wait: 'Let the owning workflow finish or reconcile its claim, then use Check now. Stopping the app or repeating migration execution does not settle its effects.',
    unreviewedPolicy:
      'has no matching tested migration classification. A developer must review its exact SQL and checksum before it can preserve processing history.',
    ownerPolicy: 'requires owner reconciliation.',
    ownerProof: 'still needs verified owner proof before migration execution.',
    liveOwner: 'has live owner work blocking migrations.',
    olderEvidence:
      'This saved check does not identify the specific blocker. Use Check now for fresh evidence before another run.',
    work: 'stored processing records are blocking the migration prerequisite. These are processing records, not SQL errors.',
    noRepair:
      'No automatic repair is available in this check. Repeating Repair and migrate or applying from the terminal will hit the same blocker.',
    retained:
      'unresolved processing records will be preserved. They do not block these qualified schema changes; this run does not settle their effects.',
    proofUnknown:
      'Repair proof is unavailable in this check. The diagnostic command will try to collect it; missing evidence stays unknown.',
    otherBlocker:
      'Some attempts have repair proof, but another database blocker needs investigation before a reviewed run can proceed.',
    diagnosis:
      'Copy this command and run it in the project terminal. The app can stay running. It only reads database evidence and saves a private local folder.',
    handoff:
      'Open the README.md path printed by the command. Give that folder to the developer investigating the blocker; it contains the health report, repair proof when available, and pending SQL.',
    repair:
      'Review the proposed changes below, then confirm the reviewed run. The app pauses its backend services and restores them afterward.',
    partial:
      'attempts have verified repair proof. This run settles those attempts; remaining blockers may still need investigation before migrations can run.',
    advanced:
      'This check includes an empty database or SQL requiring additional review. Open Advanced recovery and read its proposed effects. This check does not approve execution.',
    migrate:
      'Pending migrations allow local startup; features needing them may be unavailable. Use Repair and migrate to review and run the changes here. For the terminal alternative, copy the script below and run it from the project folder; it stops the app, applies pending owner migrations, then starts this environment.',
    stopOnError:
      'If a command fails, the script stops before the next command. Read that error and check again for fresh instructions.',
    inactive:
      'To run reviewed changes here, first stop the current app and start this environment with the commands below. Then return to this page and check it.',
    ready:
      'No pending migrations were found. You can keep using this environment.',
    after:
      'After the connection fix or reviewed run, click Check now. Use its updated next step; completed changes stay applied.',
    afterRecovery:
      'After the developer resolves the specific blocker, click Check now and follow its updated next step.',
    copy: 'Copy commands',
    copied: 'Copied',
    copyFailed:
      'Copy failed. Select the commands below and copy them manually.',
    review: 'Review changes',
    advancedButton: 'Open Advanced recovery',
    checkButton: 'Check again',
  },
  ar: {
    heading: 'الخطوة التالية',
    titles: {
      check: 'افحص هذه البيئة',
      config: 'راجع إعدادات الاتصال',
      investigate: 'اجمع تقريراً للتحقيق',
      wait: 'انتظر انتهاء العمل لدى الخدمة المسؤولة',
      repair: 'راجع الإصلاحات المتاحة',
      advanced: 'راجع SQL قبل تطبيقه',
      migrate: 'طبّق الترحيلات المعلقة',
      ready: 'اجتازت قاعدة البيانات الفحص',
    },
    check: 'اضغط «افحص الآن» للحصول على تعليمات لهذه البيئة.',
    config:
      'اقرأ خطأ الاتصال أدناه. صحّح ملف .env الخاص بهذه البيئة أو إعدادات المزود، ثم أعد الفحص بهذا الأمر.',
    investigate:
      'متطلب الترحيل الحالي محجوب. يلزم التحقيق قبل أن تفيد محاولة ترحيل أخرى.',
    wait: 'انتظر انتهاء العمل أو تسوية مطالبة التنفيذ لدى الخدمة المسؤولة، ثم اضغط «افحص الآن». إيقاف التطبيق أو تكرار الترحيل لا يثبت حسم آثار العمل.',
    unreviewedPolicy:
      'ليس له تصنيف ترحيل مختبر يطابق الملف. يحتاج المطور إلى مراجعة SQL وبصمته قبل السماح ببقاء تاريخ المعالجة دون تسوية.',
    ownerPolicy: 'يتطلب تسوية لدى الخدمة المسؤولة.',
    ownerProof:
      'ما زال يحتاج إلى دليل مؤكد لدى الخدمة المسؤولة قبل تنفيذ الترحيل.',
    liveOwner: 'فيه عمل جارٍ لدى الخدمة المسؤولة يحجب الترحيل.',
    olderEvidence:
      'هذا الفحص المحفوظ لا يحدد العائق. اضغط «افحص الآن» للحصول على أدلة حديثة قبل محاولة أخرى.',
    work: 'سجلات معالجة تحجب متطلب الترحيل. هذه سجلات معالجة وليست أخطاء SQL.',
    noRepair:
      'لا يوجد إصلاح تلقائي متاح في هذا الفحص. تكرار الإصلاح والترحيل أو التطبيق من الطرفية سيواجه العائق نفسه.',
    retained:
      'سجلات معالجة غير محسومة ستبقى محفوظة. لا تحجب تغييرات المخطط المؤهلة هذه؛ التنفيذ لا يسوّي آثارها.',
    proofUnknown:
      'أدلة الإصلاح غير متاحة في هذا الفحص. سيحاول أمر التشخيص جمعها؛ غياب الدليل يبقى غير محسوم.',
    otherBlocker:
      'لبعض المحاولات أدلة إصلاح، لكن عائقاً آخر في قاعدة البيانات يحتاج إلى التحقيق قبل التنفيذ.',
    diagnosis:
      'انسخ هذا الأمر وشغّله في طرفية المشروع. يمكن إبقاء التطبيق يعمل. يقرأ أدلة قاعدة البيانات ويحفظ مجلداً محلياً خاصاً فقط.',
    handoff:
      'افتح مسار README.md الذي يطبعه الأمر. أعطِ المجلد للمطور الذي يحقق في العائق؛ يحتوي على تقرير الصحة وأدلة الإصلاح إن توفرت وملفات SQL المعلقة.',
    repair:
      'راجع التغييرات المقترحة أدناه، ثم أكّد التنفيذ. سيوقف التطبيق خدمات الخلفية مؤقتاً ويعيد تشغيلها بعد ذلك.',
    partial:
      'محاولات لها أدلة إصلاح مؤكدة. يعالج هذا التنفيذ تلك المحاولات؛ قد تحتاج العوائق المتبقية إلى تحقيق قبل تطبيق الترحيلات.',
    advanced:
      'يشمل الفحص قاعدة فارغة أو SQL يحتاج إلى مراجعة إضافية. افتح الاستعادة المتقدمة واقرأ الآثار المقترحة. هذا الفحص لا يوافق على التنفيذ.',
    migrate:
      'الترحيلات المعلقة تسمح بالتشغيل المحلي؛ قد تتعطل الميزات التي تحتاجها. استخدم الإصلاح والترحيل لمراجعة التغييرات وتنفيذها هنا. أو انسخ الأوامر أدناه وشغّلها من مجلد المشروع؛ توقف التطبيق وتطبّق ترحيلات الخدمات ثم تشغّل هذه البيئة.',
    stopOnError:
      'إذا فشل أمر، تتوقف الأوامر قبل الخطوة التالية. اقرأ الخطأ وأعد الفحص للحصول على تعليمات حديثة.',
    inactive:
      'لتنفيذ التغييرات هنا، أوقف التطبيق الحالي وشغّل هذه البيئة بالأوامر أدناه. ثم عد إلى هذه الصفحة وافحصها.',
    ready: 'لا توجد ترحيلات معلقة. يمكنك متابعة استخدام هذه البيئة.',
    after:
      'بعد إصلاح الاتصال أو التنفيذ الذي راجعته، اضغط «افحص الآن» واتبع الخطوة المحدثة. تبقى التغييرات المكتملة مطبقة.',
    afterRecovery:
      'بعد أن يعالج المطور العائق المحدد، اضغط «افحص الآن» واتبع الخطوة المحدثة.',
    copy: 'نسخ الأوامر',
    copied: 'تم النسخ',
    copyFailed: 'تعذر النسخ. حدّد الأوامر أدناه وانسخها يدوياً.',
    review: 'مراجعة التغييرات',
    advancedButton: 'فتح الاستعادة المتقدمة',
    checkButton: 'إعادة الفحص',
  },
};

export function MigrationBlockerNotice({
  work,
  language,
}: {
  work: NonNullable<EnvironmentReport['databases'][number]['migration_work']>;
  language: 'en' | 'ar';
}) {
  const blocker = work.blocked_by;
  if (!blocker) return null;
  const t = text[language];
  return (
    <div className="space-y-1">
      {blocker.migration && (
        <p>
          <code dir="ltr">{blocker.migration}</code>{' '}
          {blocker.reason === 'migration_not_reviewed'
            ? t.unreviewedPolicy
            : blocker.reason === 'live_work'
              ? t.liveOwner
              : t.ownerPolicy}
        </p>
      )}
      {blocker.subject && blocker.reason !== 'migration_not_reviewed' && (
        <p>
          <code dir="ltr">{blocker.subject}</code>{' '}
          {blocker.reason === 'live_work' ? t.liveOwner : t.ownerProof}
        </p>
      )}
    </div>
  );
}

export default function EnvironmentNextStep({
  report,
  language,
  current,
  busy,
  onReview,
  onAdvanced,
  onCheck,
}: {
  report: EnvironmentReport;
  language: 'en' | 'ar';
  current: boolean;
  busy: boolean;
  onReview: () => void;
  onAdvanced: () => void;
  onCheck: () => void;
}) {
  const t = text[language];
  const step = nextEnvironmentStep(report);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );
  const work = report.databases.filter(
    (db) => db.migration_work?.state === 'blocked'
  );
  const count = work.reduce(
    (total, db) => total + (db.migration_work?.count ?? 0),
    0
  );
  const repairCount = work.reduce(
    (total, db) =>
      total + (db.migration_work?.attempt_repair?.actions.length ?? 0),
    0
  );
  const proofUnavailable = work.some(
    (db) =>
      !db.migration_work?.attempt_repair &&
      db.migration_work?.checks.some(
        (check) => check.subject === 'content_stage_attempts' && check.count > 0
      )
  );
  const start = `./scripts/env.sh stop &&\n./start.sh --env ${report.environment}`;
  let commands = '';
  if (step === 'investigate')
    commands = `./scripts/env.sh diagnose --env ${report.environment}`;
  if (step === 'config')
    commands = `./scripts/env.sh doctor --env ${report.environment}`;
  if (['repair', 'advanced'].includes(step) && !current) commands = start;
  if (step === 'migrate') {
    const owners = ['cms', 'iam'].filter((owner) =>
      report.databases.some((db) => db.owner === owner && db.pending.length)
    );
    commands = [
      './scripts/env.sh stop',
      ...owners.map(
        (owner) =>
          `./scripts/${owner}-migrate.sh --env ${report.environment} apply`
      ),
      `./start.sh --env ${report.environment}`,
    ].join(' &&\n');
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commands);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };
  return (
    <Card
      className={
        step === 'investigate'
          ? 'border-amber-600 dark:border-amber-400'
          : 'border-foreground/40'
      }
      aria-label={t.heading}
    >
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-wide">
          {t.heading} · <span dir="ltr">{report.environment}</span>
        </p>
        <CardTitle className="text-lg">{t.titles[step]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{t[step]}</p>
        {work
          .filter((db) => db.migration_work?.blocked_by)
          .map((db) => (
            <MigrationBlockerNotice
              key={db.owner}
              work={db.migration_work!}
              language={language}
            />
          ))}
        {work.some(
          (db) =>
            !db.migration_work?.blocked_by &&
            !db.migration_work?.schema_upgrade_ready
        ) && <p>{t.olderEvidence}</p>}
        {count > 0 && step !== 'wait' && (
          <p>
            {count}{' '}
            {work.every((db) => db.migration_work?.schema_upgrade_ready)
              ? t.retained
              : t.work}
          </p>
        )}
        {step === 'investigate' && count > 0 && (
          <p className="font-medium">
            {repairCount > 0
              ? t.otherBlocker
              : proofUnavailable &&
                  !work.some((db) => db.migration_work?.blocked_by)
                ? t.proofUnknown
                : t.noRepair}
          </p>
        )}
        {step === 'repair' && repairCount > 0 && (
          <p>
            {repairCount} {t.partial}
          </p>
        )}
        {step === 'investigate' && (
          <ol className="list-decimal space-y-2 ps-5">
            <li>{t.diagnosis}</li>
            <li>{t.handoff}</li>
            <li>{t.afterRecovery}</li>
          </ol>
        )}
        {['repair', 'advanced'].includes(step) && !current && (
          <p>{t.inactive}</p>
        )}
        {commands && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium" dir="ltr">
                Terminal
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copy()}
                disabled={busy}
              >
                <Copy className="me-2 h-4 w-4" aria-hidden="true" />
                {copyState === 'copied' ? t.copied : t.copy}
              </Button>
            </div>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-sm border bg-muted p-3 text-xs"
            >
              <code>{commands}</code>
            </pre>
            <p role="status" className="text-xs">
              {copyState === 'failed'
                ? t.copyFailed
                : copyState === 'copied'
                  ? t.copied
                  : ''}
            </p>
            {['migrate', 'repair', 'advanced'].includes(step) && (
              <p className="text-muted-foreground">{t.stopOnError}</p>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {['repair', 'migrate'].includes(step) && current && (
            <Button disabled={busy} onClick={onReview}>
              {t.review}
            </Button>
          )}
          {step === 'advanced' && current && (
            <Button disabled={busy} onClick={onAdvanced}>
              {t.advancedButton}
            </Button>
          )}
          {['check', 'config', 'wait', 'investigate'].includes(step) && (
            <Button variant="outline" disabled={busy} onClick={onCheck}>
              {t.checkButton}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
