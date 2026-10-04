'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  databaseMigrationAPI,
  type MigrationAction,
  type MigrationProgram,
  type MigrationStatus,
} from '@/lib/api/database-migrations';

type ViewState = {
  status: MigrationStatus | null;
  actions: MigrationAction[] | null;
  programs: MigrationProgram[] | null;
  error: string;
  loading: boolean;
};

const copy = {
  en: {
    title: 'Advanced database relocation',
    purpose:
      'This is for moving an entire database to another database or provider. For ordinary schema updates, use Database health.',
    notConfigured: 'Relocation is not configured',
    optional:
      'This optional feature is not needed to run your environments or apply schema migrations. No setup is needed unless you plan to move a database.',
    setup:
      'For a database move, a developer must configure a separate control database and review the source and destination first.',
    observe:
      'This tab shows relocation status and saved analyses. It does not start a database move.',
    monitoring: 'Read-only relocation monitoring',
    disabledExplanation:
      'Database copying and cutover are disabled. They require a separately reviewed and verified implementation.',
    unavailable: 'Relocation checks could not be completed',
    retryGuidance:
      'Try Check again. If it still fails, ask a developer to inspect the relocation coordinator. This does not determine the health of your application database.',
    health: 'Open Database health',
    retry: 'Check again',
    control: 'Relocation control database',
    execution: 'Copying and cutover',
    records: 'Recorded relocations',
    ready: 'Connected',
    unknown: 'Unknown',
    disabled: 'Disabled',
    enabled: 'Enabled',
    loading: 'Checking',
    noRecords: 'No relocations have been recorded.',
    recordsUnavailable:
      'Relocation history could not be read. Check again; an unavailable check does not mean the history is empty.',
    recordsNotConfigured:
      'Relocation history becomes available after the optional control database is configured.',
    details: 'Technical details',
    registry: 'Registered relocation capabilities',
    registryUnavailable: 'The capability registry could not be read.',
    registryNote:
      'These are capability definitions, not executable buttons. Write actions remain subject to separate approval and release checks.',
    readOnly: 'Read-only inspection',
    approval: 'Separate approval required',
    manual: 'Manual operation',
    available: 'Released',
    locked: 'Not released',
    owner: 'Execution owner',
    verifier: 'Verification owner',
    state: 'Recorded state',
    units: 'Physical databases',
    evidence: 'Check details',
  },
  ar: {
    title: 'نقل قاعدة البيانات — متقدم',
    purpose:
      'هذا القسم لنقل قاعدة بيانات كاملة إلى قاعدة أخرى أو مزود آخر. لتحديث المخطط المعتاد استخدم «صحة قاعدة البيانات».',
    notConfigured: 'نقل قاعدة البيانات غير مُعدّ',
    optional:
      'هذه ميزة اختيارية لا تحتاجها لتشغيل بيئاتك أو تطبيق ترحيلات المخطط. لا يلزم إعدادها إلا إذا أردت نقل قاعدة بيانات.',
    setup:
      'لنقل قاعدة بيانات، يحتاج المطور إلى إعداد قاعدة تحكم منفصلة ومراجعة المصدر والوجهة أولاً.',
    observe:
      'يعرض هذا القسم حالة النقل والتحليلات المحفوظة. لا يبدأ نقل قاعدة بيانات.',
    monitoring: 'متابعة نقل قاعدة البيانات للقراءة فقط',
    disabledExplanation:
      'نسخ قاعدة البيانات والتحويل إلى الوجهة معطّلان. يتطلبان تنفيذاً تمت مراجعته والتحقق منه بصورة منفصلة.',
    unavailable: 'تعذّر إكمال فحوص النقل',
    retryGuidance:
      'اضغط «افحص مجدداً». إذا استمر الخطأ، اطلب من المطور فحص منسّق النقل. هذا الفحص لا يحدد صحة قاعدة بيانات التطبيق.',
    health: 'افتح صحة قاعدة البيانات',
    retry: 'افحص مجدداً',
    control: 'قاعدة التحكم بالنقل',
    execution: 'النسخ والتحويل إلى الوجهة',
    records: 'عمليات النقل المسجلة',
    ready: 'متصلة',
    unknown: 'غير معروف',
    disabled: 'معطّل',
    enabled: 'مفعّل',
    loading: 'جارٍ الفحص',
    noRecords: 'لا توجد عمليات نقل مسجلة.',
    recordsUnavailable:
      'تعذّرت قراءة سجل النقل. أعد الفحص؛ تعذّر الفحص لا يعني أن السجل فارغ.',
    recordsNotConfigured: 'يتوفر سجل النقل بعد إعداد قاعدة التحكم الاختيارية.',
    details: 'التفاصيل التقنية',
    registry: 'قدرات النقل المسجلة',
    registryUnavailable: 'تعذّرت قراءة سجل القدرات.',
    registryNote:
      'هذه تعريفات للقدرات وليست أزرار تنفيذ. تظل عمليات الكتابة بحاجة إلى موافقة وفحوص تفعيل منفصلة.',
    readOnly: 'فحص للقراءة فقط',
    approval: 'يتطلب موافقة منفصلة',
    manual: 'عملية يدوية',
    available: 'متاح',
    locked: 'غير متاح للتنفيذ',
    owner: 'الخدمة المسؤولة عن التنفيذ',
    verifier: 'الخدمة المسؤولة عن التحقق',
    state: 'الحالة المسجلة',
    units: 'قواعد البيانات الفعلية',
    evidence: 'تفاصيل الفحص',
  },
};

export default function RelocationPanel({
  language = 'en',
  onDatabaseHealth,
}: {
  language?: 'en' | 'ar';
  onDatabaseHealth?: () => void;
}) {
  const t = copy[language];
  const [check, setCheck] = useState(0);
  const [view, setView] = useState<ViewState>({
    status: null,
    actions: null,
    programs: null,
    error: '',
    loading: true,
  });
  useEffect(() => {
    let active = true;
    setView({
      status: null,
      actions: null,
      programs: null,
      error: '',
      loading: true,
    });
    Promise.allSettled([
      databaseMigrationAPI.status(),
      databaseMigrationAPI.actions(),
    ])
      .then(async ([status, actions]) => {
        if (!active) return;
        const errors = [status, actions]
          .filter((result) => result.status === 'rejected')
          .map((result) =>
            result.status === 'rejected' && result.reason instanceof Error
              ? result.reason.message
              : 'Unavailable'
          );
        let programs: MigrationProgram[] | null = null;
        // Missing or unreadable setup cannot supply proof of an empty history.
        if (status.status === 'fulfilled' && status.value.control_store_ready) {
          try {
            programs = (await databaseMigrationAPI.programs()).items;
          } catch (reason) {
            errors.push(
              reason instanceof Error ? reason.message : 'Unavailable'
            );
          }
        }
        if (active)
          setView({
            status: status.status === 'fulfilled' ? status.value : null,
            actions:
              actions.status === 'fulfilled' ? actions.value.items : null,
            programs,
            error: [...new Set(errors)].join(' · '),
            loading: false,
          });
      })
      .catch((reason) => {
        if (active)
          setView((previous) => ({
            ...previous,
            error:
              reason instanceof Error
                ? reason.message
                : 'Unable to load migration controls',
            loading: false,
          }));
      });
    return () => {
      active = false;
    };
  }, [check]);
  const notConfigured = view.status?.status === 'not_configured';
  const unavailable =
    !view.loading &&
    (!!view.error || !view.status || view.status.status === 'unavailable');
  return (
    <div
      className="space-y-4"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid="database-relocation-panel"
    >
      <div>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t.purpose}
        </p>
      </div>
      <Card className={unavailable ? 'border-amber-500/50' : undefined}>
        <CardHeader>
          <CardTitle className="text-base">
            {view.loading
              ? t.loading
              : unavailable
                ? t.unavailable
                : notConfigured
                  ? t.notConfigured
                  : t.monitoring}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm" aria-live="polite">
          {!view.loading && (
            <>
              <p role={unavailable ? 'alert' : undefined}>
                {unavailable
                  ? t.retryGuidance
                  : notConfigured
                    ? t.optional
                    : t.observe}
              </p>
              {notConfigured && (
                <p className="text-muted-foreground">{t.setup}</p>
              )}
              {view.status?.execution_enabled === false && (
                <p>{t.disabledExplanation}</p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {onDatabaseHealth && (
              <Button variant="outline" onClick={onDatabaseHealth}>
                {t.health}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={view.loading}
              onClick={() => setCheck((previous) => previous + 1)}
            >
              {t.retry}
            </Button>
          </div>
          {view.error && (
            <details>
              <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                {t.evidence}
              </summary>
              <p className="mt-2 text-xs" dir="auto">
                {view.error}
              </p>
            </details>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Summary
          title={t.control}
          value={
            view.loading
              ? t.loading
              : notConfigured
                ? t.notConfigured
                : view.status?.control_store_ready
                  ? t.ready
                  : t.unknown
          }
          healthy={view.status?.control_store_ready === true}
        />
        <Summary
          title={t.execution}
          value={
            view.loading
              ? t.loading
              : view.status
                ? view.status.execution_enabled
                  ? t.enabled
                  : t.disabled
                : t.unknown
          }
          healthy={false}
        />
        <Summary
          title={t.records}
          value={
            view.loading
              ? t.loading
              : view.programs !== null
                ? String(view.programs.length)
                : notConfigured
                  ? t.notConfigured
                  : t.unknown
          }
          healthy={view.programs !== null}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.records}</CardTitle>
        </CardHeader>
        <CardContent>
          {view.loading ? (
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          ) : view.programs === null ? (
            <p className="text-sm text-muted-foreground">
              {notConfigured ? t.recordsNotConfigured : t.recordsUnavailable}
            </p>
          ) : view.programs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noRecords}</p>
          ) : (
            <div className="space-y-3">
              {view.programs.map((program) => (
                <div
                  key={program.id}
                  className="grid gap-1 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium">
                      {program.source_alias} → {program.target_alias}
                    </p>
                    <p className="text-muted-foreground">
                      {program.environment} · {program.id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.units}: {program.units.length}
                    </p>
                  </div>
                  <div className="text-xs">
                    {t.state}: <code>{program.state}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <details className="rounded-sm border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t.details}
        </summary>
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold">{t.registry}</h3>
          <p className="text-sm text-muted-foreground">{t.registryNote}</p>
          {view.actions === null ? (
            <p className="text-sm">
              {view.loading ? t.loading : t.registryUnavailable}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {view.actions.map((action) => (
                <div key={action.key} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-xs font-semibold">
                      {action.key}
                    </p>
                    <span className="flex items-center gap-2">
                      {action.enabled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                      )}
                      {action.enabled ? t.available : t.locked}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {action.class === 'read_only'
                      ? t.readOnly
                      : action.class === 'manual_only'
                        ? t.manual
                        : t.approval}
                  </p>
                  <p className="text-muted-foreground">
                    {t.owner}: <code dir="ltr">{action.execution_owner}</code>
                    <br />
                    {t.verifier}:{' '}
                    <code dir="ltr">{action.verification_owner}</code>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function Summary({
  title,
  value,
  healthy,
}: {
  title: string;
  value: string;
  healthy: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            healthy
              ? 'text-xl font-semibold text-emerald-600'
              : 'text-xl font-semibold'
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
