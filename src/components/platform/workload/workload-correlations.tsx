import Link from 'next/link';
import type { WorkloadQualification } from '@/types/platform/workload';
import type { WorkloadQuery } from './workload-evidence';
import {
  copy,
  EmptyWorkload,
  name,
  WorkloadNotice,
  WorkloadPanel,
  WorkloadTime,
  type WorkloadLocale,
} from './presentation';

export function WorkloadCorrelations({
  query,
  locale,
}: {
  query: WorkloadQuery<WorkloadQualification>;
  locale: WorkloadLocale;
}) {
  const t = (en: string, ar: string) => copy(locale, en, ar);
  const data = query.data;
  return (
    <WorkloadPanel
      title={t(
        'Service incidents and admission pressure',
        'حوادث الخدمات وضغط القبول'
      )}
      description={t(
        'Matching resource and time show contextual overlap. This is supporting review evidence, not proof that one caused the other.',
        'توضح مطابقة المورد والتوقيت تزامن الأحداث. هذه أدلة مساندة للمراجعة، ولا تثبت أن أحد الحدثين تسبب في الآخر.'
      )}
    >
      {(query.isError || data?.correlation_available === false) && (
        <WorkloadNotice
          locale={locale}
          title={t(
            'Incident overlap evidence unavailable',
            'أدلة تزامن الحوادث غير متاحة'
          )}
          retry={() => query.refetch()}
        >
          {data?.correlation_reason
            ? name(data.correlation_reason, locale)
            : t(
                'Current System Health incident context could not be read.',
                'تعذرت قراءة سياق حوادث صحة النظام الحالي.'
              )}
        </WorkloadNotice>
      )}
      {data?.correlations?.length ? (
        <div className="divide-y">
          {data.correlations.map((item, index) => (
            <article
              key={`${item.incident_id}-${item.class}-${index}`}
              className="space-y-2 py-3"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="text-sm font-medium">
                  {name(item.service, locale)} · {name(item.class, locale)}
                </h3>
                <Link
                  className="text-xs underline underline-offset-4"
                  href={item.href}
                >
                  {t('Review incident', 'مراجعة الحادثة')}
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                <WorkloadTime value={item.started_at} locale={locale} />
                {item.resolved_at ? (
                  <>
                    {' '}
                    — <WorkloadTime value={item.resolved_at} locale={locale} />
                  </>
                ) : (
                  <> · {t('No resolution recorded', 'لم يُسجَّل حل')}</>
                )}
              </p>
              <p className="text-sm">
                {item.would_defer}{' '}
                {t('would-defer decisions among', 'قرار تأجيل افتراضي من أصل')}{' '}
                {item.decisions}{' '}
                {t('matching admission decisions.', 'قرار قبول مطابق.')}
              </p>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {t('Exact incident', 'معرّف الحادثة الدقيق')}
                </summary>
                <code className="mt-2 block break-all" dir="ltr">
                  {item.incident_id}
                </code>
              </details>
            </article>
          ))}
        </div>
      ) : data?.correlation_available && !query.isError ? (
        <EmptyWorkload
          locale={locale}
          title={t(
            'No matching incident overlap recorded',
            'لم يُسجَّل تزامن مطابق مع حوادث'
          )}
          description={t(
            'This does not establish available capacity or healthy delivery.',
            'هذا لا يثبت توفر السعة أو سلامة التسليم.'
          )}
        />
      ) : !query.isPending &&
        !query.isError &&
        data?.correlation_available !== false ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'Incident context has not been supplied.',
            'لم يتوفر سياق الحوادث.'
          )}
        </p>
      ) : null}
    </WorkloadPanel>
  );
}
