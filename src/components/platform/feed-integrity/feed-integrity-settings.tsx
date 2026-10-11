'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  usePauseFeedIntegritySchedule,
  useUpdateFeedIntegrityPolicy,
} from '@/hooks/use-feed-integrity';
import type { FeedIntegrityPolicy } from '@/types/platform/feed-integrity';
import { FeedIntegrityAutopilotPanel } from './feed-integrity-autopilot-panel';
import { translate, type IntegrityLocale } from './presentation';

const fields: Array<
  [keyof FeedIntegrityPolicy, string, string, number, number]
> = [
  [
    'light_interval_minutes',
    'Quick check interval (minutes)',
    'الفاصل بين الفحوصات السريعة (دقائق)',
    1,
    1440,
  ],
  [
    'deep_interval_hours',
    'Media check interval (hours)',
    'الفاصل بين فحوصات الوسائط (ساعات)',
    1,
    720,
  ],
  [
    'confirm_runs',
    'Problem checks needed to open an issue',
    'فحوصات المشكلة اللازمة لفتح حالة',
    1,
    20,
  ],
  [
    'resolve_runs',
    'Clean checks needed to confirm recovery',
    'فحوصات سليمة لتأكيد التعافي',
    1,
    20,
  ],
  ['edge_pages_per_feed', 'Pages per feed', 'عدد الصفحات لكل خلاصة', 1, 5],
  [
    'probe_url_budget',
    'Media request limit (0 skips URL probes)',
    'حد طلبات الوسائط (٠ يتجاوز فحص الروابط)',
    0,
    100,
  ],
  [
    'probe_concurrency',
    'Concurrent media probes',
    'فحوصات الوسائط المتزامنة',
    1,
    4,
  ],
  [
    'probe_timeout_ms',
    'Media probe timeout (ms)',
    'مهلة فحص الوسائط (مللي ثانية)',
    500,
    10000,
  ],
  [
    'pods_latency_budget_ms',
    'Pods response time target (ms)',
    'وقت استجابة بودز المستهدف (مللي ثانية)',
    1,
    60000,
  ],
  [
    'news_latency_budget_ms',
    'News response time target (ms)',
    'وقت استجابة الأخبار المستهدف (مللي ثانية)',
    1,
    60000,
  ],
  [
    'expected_min_pods_units',
    'Minimum Pods units',
    'الحد الأدنى لعناصر بودز',
    0,
    1000,
  ],
  [
    'expected_min_news_slides',
    'Minimum News slides',
    'الحد الأدنى لشرائح الأخبار',
    0,
    1000,
  ],
];

export function FeedIntegritySettings({
  policy,
  locale,
  unavailable,
}: {
  policy?: FeedIntegrityPolicy;
  locale: IntegrityLocale;
  unavailable: boolean;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const save = useUpdateFeedIntegrityPolicy(locale);
  const pause = usePauseFeedIntegritySchedule(locale);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);
  const paused =
    !!policy?.paused_until && Date.parse(policy.paused_until) > Date.now();
  const locked = !policy || unavailable || save.isPending || pause.isPending;
  const changed = fields.filter(
    ([key]) =>
      draft[key] !== undefined && draft[key] !== String(policy?.[key] ?? '')
  );
  const submit = () => {
    const patch: Partial<FeedIntegrityPolicy> = {};
    for (const [key, en, ar, min, max] of changed) {
      const value = Number(draft[key]);
      if (
        !draft[key]?.trim() ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      ) {
        setValidation(
          `${t(en, ar)}: ${t('enter a whole number between', 'أدخل عددًا صحيحًا بين')} ${min}–${max}.`
        );
        return;
      }
      Object.assign(patch, { [key]: value });
    }
    setValidation('');
    save.mutate(patch, {
      onSuccess: () => {
        setDraft({});
        setSaved(true);
      },
    });
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">
            {t('Check scheduling', 'جدولة الفحوصات')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(
              'Checks collect evidence. They do not repair feeds or approve proposals.',
              'تجمع الفحوصات الأدلة ولا تصلح الخلاصات أو توافق على المقترحات.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {unavailable ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'Settings are read-only until current status is available.',
                'الإعدادات للقراءة فقط حتى تتوفر الحالة الحالية.'
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              aria-label={t('Scheduled checks', 'الفحوصات المجدولة')}
              checked={policy?.scheduled_enabled ?? false}
              disabled={locked}
              onCheckedChange={(scheduled_enabled) =>
                save.mutate({ scheduled_enabled })
              }
            />
            <span className="text-sm">
              {paused
                ? t(
                    'Scheduled checks paused',
                    'الفحوصات المجدولة متوقفة مؤقتًا'
                  )
                : policy?.scheduled_enabled
                  ? t('Scheduled checks enabled', 'الفحوصات المجدولة مفعلة')
                  : t('Manual checks only', 'فحوصات يدوية فقط')}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={locked || !policy?.scheduled_enabled}
              onClick={() => pause.mutate(paused ? 0 : 120)}
            >
              {paused
                ? t('Resume checks', 'استئناف الفحوصات')
                : t('Pause checks 2h', 'إيقاف الفحوصات لساعتين')}
            </Button>
          </div>
          {paused ? (
            <p className="text-xs text-muted-foreground">
              {t('Paused until', 'متوقف حتى')}{' '}
              <bdi>
                {new Date(policy?.paused_until || '').toLocaleString(locale)}
              </bdi>
            </p>
          ) : null}
          {policy ? (
            <p className="text-xs text-muted-foreground">
              {t('Quick checks every', 'فحوصات سريعة كل')}{' '}
              <bdi>{policy.light_interval_minutes}</bdi>{' '}
              {t('minutes; media checks every', 'دقيقة؛ فحوصات وسائط كل')}{' '}
              <bdi>{policy.deep_interval_hours}</bdi>{' '}
              {t(
                'hours when scheduling is enabled.',
                'ساعة عند تفعيل الجدولة.'
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t(
              'Scheduling switches apply immediately. Advanced values are saved together below.',
              'تُطبق مفاتيح الجدولة مباشرة. تُحفظ القيم المتقدمة معًا أدناه.'
            )}
          </p>
          <details className="border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t('Advanced check settings', 'إعدادات الفحص المتقدمة')}
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([key, en, ar, min, max]) => (
                <label key={key} className="text-sm">
                  {t(en, ar)}
                  <Input
                    aria-label={t(en, ar)}
                    type="number"
                    min={min}
                    max={max}
                    value={draft[key] ?? String(policy?.[key] ?? '')}
                    disabled={locked}
                    onChange={(e) => {
                      setDraft({ ...draft, [key]: e.target.value });
                      setValidation('');
                      setSaved(false);
                    }}
                    className="mt-2"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    <bdi>
                      {min}–{max}
                    </bdi>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={locked || !changed.length}
                onClick={submit}
              >
                {save.isPending
                  ? t('Saving…', 'جارٍ الحفظ…')
                  : t('Save check settings', 'حفظ إعدادات الفحص')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={locked || !Object.keys(draft).length}
                onClick={() => {
                  setDraft({});
                  setValidation('');
                  setSaved(false);
                }}
              >
                {t('Discard changes', 'تجاهل التغييرات')}
              </Button>
              {changed.length ? (
                <span className="text-xs text-muted-foreground">
                  {t('Unsaved changes', 'تغييرات غير محفوظة')}
                </span>
              ) : saved ? (
                <span role="status" className="text-xs text-muted-foreground">
                  {t('Settings saved', 'حُفظت الإعدادات')}
                </span>
              ) : null}
            </div>
          </details>
          {validation || save.error || pause.error ? (
            <p role="alert" className="text-sm text-destructive">
              {validation || save.error?.message || pause.error?.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <FeedIntegrityAutopilotPanel settings locale={locale} />
    </div>
  );
}
