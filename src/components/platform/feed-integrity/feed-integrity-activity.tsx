'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useFeedIntegrityRun,
  useFeedIntegrityRuns,
} from '@/hooks/use-feed-integrity';
import { IntegrityEvidence } from './feed-integrity-autopilot-panel';
import { IntegrityTime } from './feed-integrity-overview';
import {
  checkTitle,
  checkName,
  feedName,
  stateLabel,
  tone,
  translate,
  variantLabel,
  type IntegrityLocale,
} from './presentation';
import type { IntegrityParams } from './feed-integrity-issues';

export function FeedIntegrityActivity({
  locale,
  params,
  setParams,
}: {
  locale: IntegrityLocale;
  params: URLSearchParams;
  setParams: (changes: IntegrityParams) => void;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const runs = useFeedIntegrityRuns();
  const id = params.get('run') || '';
  const detail = useFeedIntegrityRun(id);
  const [limit, setLimit] = useState(30);
  const filter = params.get('fq') || '';
  const fstate = params.get('fstate') || 'problems';
  const findings = (detail.data?.findings || [])
    .filter(
      (f) =>
        (fstate === 'all' ||
          (fstate === 'problems'
            ? f.status === 'violation' || f.status === 'check_error'
            : f.status.startsWith('skipped:'))) &&
        `${f.status === 'violation' ? checkTitle(f.check_key, locale) : checkName(f.check_key, locale)} ${f.feed} ${f.variant} ${f.target_ref}`
          .toLowerCase()
          .includes(filter.trim().toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.status === 'violation') - Number(a.status === 'violation') ||
        a.check_key.localeCompare(b.check_key)
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">
            {t('Recorded checks', 'الفحوصات المسجلة')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t(
              'Select a check to inspect only its recorded findings.',
              'اختر فحصًا لعرض نتائجه المسجلة فقط.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 p-5 pt-0">
          {runs.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('Loading check activity…', 'جارٍ تحميل نشاط الفحوصات…')}
            </p>
          ) : null}
          {runs.isError ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                {t('Check activity unavailable', 'نشاط الفحوصات غير متاح')}:{' '}
                {runs.error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runs.refetch()}
              >
                {t('Retry', 'إعادة المحاولة')}
              </Button>
            </div>
          ) : null}
          <div className="max-h-80 divide-y overflow-y-auto">
            {(runs.data?.items || []).map((run) => (
              <button
                key={run.id}
                aria-pressed={String(run.id) === id}
                onClick={() => {
                  setParams({
                    run: String(run.id),
                    fq: undefined,
                    fstate: undefined,
                  });
                  setLimit(30);
                }}
                className={`flex w-full flex-wrap items-center justify-between gap-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${String(run.id) === id ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {run.tier === 'deep'
                      ? t('Feed and media check', 'فحص الخلاصة والوسائط')
                      : t('Quick feed check', 'فحص الخلاصة السريع')}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    <bdi>{new Date(run.started_at).toLocaleString(locale)}</bdi>
                  </span>
                </span>
                <Badge variant={tone(run.status)}>
                  {stateLabel(run.status, locale)}
                </Badge>
              </button>
            ))}
          </div>
          {!runs.isLoading &&
          !runs.isError &&
          runs.data &&
          !runs.data.items.length ? (
            <p className="text-sm text-muted-foreground">
              {t('No checks recorded yet.', 'لا توجد فحوصات مسجلة بعد.')}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {id ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-5 pb-3">
            <CardTitle className="text-base">
              {t('Selected check evidence', 'أدلة الفحص المحدد')}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setParams({ run: undefined, fq: undefined, fstate: undefined })
              }
            >
              {t('Close evidence', 'إغلاق الأدلة')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            {detail.isLoading ? (
              <p role="status" className="text-sm">
                {t('Loading this check…', 'جارٍ تحميل هذا الفحص…')}
              </p>
            ) : null}
            {detail.isError ? (
              <div role="alert" className="space-y-2 text-sm">
                <p>
                  {t('Selected check unavailable', 'الفحص المحدد غير متاح')}:{' '}
                  {detail.error.message}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => detail.refetch()}
                >
                  {t('Retry', 'إعادة المحاولة')}
                </Button>
              </div>
            ) : null}
            {detail.data ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={tone(detail.data.run.status)}>
                    {stateLabel(detail.data.run.status, locale)}
                  </Badge>
                  <span>
                    {t('Started', 'بدأ')}{' '}
                    <IntegrityTime
                      value={detail.data.run.started_at}
                      locale={locale}
                    />
                  </span>
                  <span>
                    {t('Duration', 'المدة')}:{' '}
                    <bdi>
                      {detail.data.run.finished_at
                        ? `${Math.max(0, Math.round((Date.parse(detail.data.run.finished_at) - Date.parse(detail.data.run.started_at)) / 1000))} s`
                        : t('In progress', 'جارٍ')}
                    </bdi>
                  </span>
                </div>
                {detail.data.run.error ? (
                  <p
                    role="alert"
                    className="text-sm text-destructive"
                    dir="auto"
                  >
                    {detail.data.run.error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-0 flex-1 basis-48"
                    aria-label={t(
                      'Search selected check findings',
                      'البحث في نتائج الفحص المحدد'
                    )}
                    placeholder={t(
                      'Search check or target',
                      'ابحث عن فحص أو هدف'
                    )}
                    value={filter}
                    onChange={(e) => {
                      setParams({ fq: e.target.value });
                      setLimit(30);
                    }}
                  />
                  <select
                    aria-label={t(
                      'Filter finding results',
                      'تصفية نتائج الفحص'
                    )}
                    className="h-10 max-w-full rounded-md border bg-background px-3 text-sm"
                    value={fstate}
                    onChange={(e) => {
                      setParams({ fstate: e.target.value });
                      setLimit(30);
                    }}
                  >
                    <option value="problems">
                      {t('Problems and errors', 'المشكلات والأخطاء')}
                    </option>
                    <option value="skipped">
                      {t('Skipped checks', 'الفحوصات غير المنفذة')}
                    </option>
                    <option value="all">
                      {t('All findings', 'جميع النتائج')}
                    </option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {findings.length}{' '}
                  {t('findings in this check', 'نتائج في هذا الفحص')} ·{' '}
                  <code dir="ltr">#{id}</code>
                </p>
                <div className="divide-y">
                  {findings.slice(0, limit).map((f) => (
                    <details key={f.id} className="py-3 text-sm">
                      <summary className="cursor-pointer">
                        <span className="font-medium">
                          {f.status === 'violation'
                            ? checkTitle(f.check_key, locale)
                            : checkName(f.check_key, locale)}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {feedName(f.feed, locale)} ·{' '}
                          <bdi>{variantLabel(f.variant, locale)}</bdi> ·{' '}
                          {stateLabel(f.status, locale)}
                        </span>
                        {f.target_ref ? (
                          <code
                            className="mt-1 block truncate text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {f.target_ref}
                          </code>
                        ) : null}
                      </summary>
                      {f.target_ref ? (
                        <p
                          className="my-2 break-all font-mono text-xs"
                          dir="ltr"
                        >
                          {f.target_ref}
                        </p>
                      ) : null}
                      <IntegrityEvidence value={f.evidence} />
                    </details>
                  ))}
                </div>
                {!findings.length ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'No findings match this filter in the selected check.',
                      'لا توجد نتائج تطابق هذه التصفية في الفحص المحدد.'
                    )}
                  </p>
                ) : null}
                {findings.length > limit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLimit(limit + 30)}
                  >
                    {t('Show more findings', 'عرض نتائج إضافية')}
                  </Button>
                ) : null}
                <details className="space-y-3 border-t pt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {t('Technical run record', 'السجل التقني للفحص')}
                  </summary>
                  <p className="text-xs" dir="auto">
                    {detail.data.run.summary}
                  </p>
                  <IntegrityEvidence value={detail.data.run.lane_results} />
                </details>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(
            'Choose a recorded check to view findings with their original context.',
            'اختر فحصًا مسجلًا لعرض النتائج في سياقها الأصلي.'
          )}
        </p>
      )}
    </div>
  );
}
