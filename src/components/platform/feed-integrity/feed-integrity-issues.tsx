'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Copy, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  useCloseFeedIntegrityEpisode,
  useCreateFeedIntegritySuppression,
  useRevokeFeedIntegritySuppression,
} from '@/hooks/use-feed-integrity';
import type {
  FeedIntegrityEpisode,
  FeedIntegrityStatus,
} from '@/types/platform/feed-integrity';
import { IntegrityEvidence } from './feed-integrity-autopilot-panel';
import { IntegrityTime, ObservationRows } from './feed-integrity-overview';
import {
  checkTitle,
  checkName,
  evidenceRecord,
  feedName,
  groupObservations,
  incomplete,
  observationScope,
  hasVerifiedScope,
  ownerLabel,
  problem,
  reasonLabel,
  safeOwnerLink,
  severityLabel,
  severityRank,
  stateLabel,
  tone,
  translate,
  variantLabel,
  type IntegrityLocale,
} from './presentation';

export type IntegrityParams = Record<string, string | undefined>;
const selectClass =
  'h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
function targetLabel(scope?: string) {
  if (!scope) return '—';
  return scope.replace(/([a-f0-9]{8})-[a-f0-9-]{27,}/gi, '$1…');
}

function IssueInspector({
  episode,
  data,
  check,
  feed,
  locale,
  unavailable,
  checking,
  onCheck,
  onFinish,
}: {
  episode?: FeedIntegrityEpisode;
  data?: FeedIntegrityStatus;
  check: string;
  feed: string;
  locale: IntegrityLocale;
  unavailable: boolean;
  checking: boolean;
  onCheck: () => void;
  onFinish: () => void;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const close = useCloseFeedIntegrityEpisode(locale);
  const suppress = useCreateFeedIntegritySuppression(locale);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [ttl, setTtl] = useState(60);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const rows = (data?.current_observations || []).filter(
    (o) => o.check_key === check && o.feed === feed
  );
  const evidence = evidenceRecord(episode?.evidence);
  const url = typeof evidence.url === 'string' ? evidence.url : undefined;
  const spec = data?.checks?.find((c) => c.Key === check);
  const attribution =
    episode?.attribution ||
    data?.open_episodes.find(
      (ep) =>
        ep.check_key === check &&
        ep.feed === feed &&
        safeOwnerLink(ep.attribution?.deep_link)
    )?.attribution;
  const owner = attribution?.owner || spec?.OwnerSurface;
  const link = safeOwnerLink(attribution?.deep_link);
  const exactOutcome = episode ? observationScope(episode, rows) : undefined;
  const pending = close.isPending || suppress.isPending;
  const error = close.error || suppress.error;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(episode?.scope || '');
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };
  return (
    <div className="min-w-0 space-y-5 text-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant={tone(episode?.severity || rows[0]?.severity)}>
            {severityLabel(
              episode?.severity || rows[0]?.severity || '',
              locale
            )}
          </Badge>
          {episode ? (
            <Badge variant="secondary">
              {stateLabel(episode.status, locale)}
            </Badge>
          ) : null}
        </div>
        <h3 className="text-base font-semibold" dir="auto">
          {!episode && !rows.some(problem)
            ? checkName(check, locale)
            : checkTitle(check, locale, spec?.Label)}
        </h3>
        <p className="text-muted-foreground">
          {check.startsWith('probe_')
            ? t(
                'This check samples media URLs. Its results apply to the checked targets.',
                'يفحص هذا الفحص عينات من روابط الوسائط. تخص نتائجه الأهداف المفحوصة.'
              )
            : check.startsWith('inv_')
              ? t(
                  'CMS inventory was checked against feed eligibility and metadata rules.',
                  'فُحص مخزون CMS وفق قواعد أهلية الخلاصة وبياناتها.'
                )
              : check === 'checker_unhealthy'
                ? t(
                    'The checker could not complete part of its work. Feed health remains partly unknown.',
                    'تعذر على الفاحص إكمال جزء من عمله. سلامة الخلاصة غير مؤكدة جزئيًا.'
                  )
                : t(
                    'The recorded feed response was checked against delivery rules and timing limits.',
                    'فُحصت استجابة الخلاصة المسجلة وفق قواعد العرض وحدود الوقت.'
                  )}
        </p>
      </div>
      <div className="space-y-2 border-t pt-4">
        <h4 className="font-medium">
          {t('Target and evidence', 'الهدف والأدلة')}
        </h4>
        <p>
          {feedName(feed, locale)}
          {episode ? (
            <>
              {' '}
              · <bdi>{variantLabel(episode.variant, locale)}</bdi>
            </>
          ) : null}
        </p>
        {episode ? (
          <>
            <div className="flex items-start gap-2">
              <code dir="ltr" className="min-w-0 flex-1 break-all text-xs">
                {episode.scope || '—'}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={copy}
                aria-label={t('Copy exact target', 'نسخ الهدف الدقيق')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied ? (
              <p role="status" className="text-xs text-muted-foreground">
                {t('Target copied', 'نُسخ الهدف')}
              </p>
            ) : null}
            {copyError ? (
              <p role="alert" className="text-xs text-destructive">
                {t(
                  'Copy unavailable. Select the target text above.',
                  'تعذر النسخ. حدد نص الهدف أعلاه.'
                )}
              </p>
            ) : null}
            {typeof evidence.reason === 'string' ? (
              <p className="font-medium" dir="auto">
                {reasonLabel(evidence.reason, locale)}
              </p>
            ) : null}
            {typeof evidence.latency_ms === 'number' ? (
              <p>
                {t('Recorded response time', 'وقت الاستجابة المسجل')}:{' '}
                <bdi className="tabular-nums">{evidence.latency_ms} ms</bdi>
              </p>
            ) : null}
            {typeof evidence.duration_sec === 'number' ? (
              <p>
                {t('Recorded duration', 'المدة المسجلة')}:{' '}
                <bdi className="tabular-nums">{evidence.duration_sec} s</bdi>
              </p>
            ) : null}
            {url ? (
              <p
                className="break-all rounded-md bg-muted/40 p-2 font-mono text-xs"
                dir="ltr"
              >
                {url}
              </p>
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
              <dt className="text-muted-foreground">
                {t('First detected', 'أول رصد')}
              </dt>
              <dd>
                <IntegrityTime
                  value={episode.first_detected_at}
                  locale={locale}
                />
              </dd>
              <dt className="text-muted-foreground">
                {t('Last problem seen', 'آخر رصد للمشكلة')}
              </dt>
              <dd>
                <IntegrityTime value={episode.last_seen_at} locale={locale} />
              </dd>
              <dt className="text-muted-foreground">
                {t('Latest scope check', 'آخر فحص للنطاق')}
              </dt>
              <dd>
                {exactOutcome
                  ? stateLabel(exactOutcome, locale)
                  : t(
                      'Awaiting fresh verification',
                      'بانتظار تحقق جديد'
                    )}
              </dd>
            </dl>
            {episode.status === 'recovering' ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  'CMS is waiting for enough clean checks before resolving this issue.',
                  'ينتظر CMS عددًا كافيًا من الفحوصات السليمة قبل تأكيد زوال المشكلة.'
                )}
              </p>
            ) : null}
          </>
        ) : (
          <div>
            <ObservationRows observations={rows.slice(0, 2)} locale={locale} />
            <p className="text-xs text-muted-foreground">
              {t(
                'Select an issue in the queue for its exact target and decision scope.',
                'اختر مشكلة في القائمة لعرض هدفها الدقيق ونطاق قرارها.'
              )}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium">{t('Next action', 'الإجراء التالي')}</h4>
        <p className="text-muted-foreground">
          {check === 'inv_news_cache_rebuild_debt'
            ? t(
                'Review any pending snapshot refresh below the issue queue, or investigate the snapshot in News management.',
                'راجع أي تحديث لقطة ينتظر الموافقة أسفل قائمة المشكلات، أو تحقق من اللقطة في إدارة الأخبار.'
              )
            : `${t('Investigate the exact target in', 'تحقق من الهدف الدقيق في')} ${ownerLabel(owner, locale)}.`}
        </p>
        {link ? (
          <Button asChild className="max-w-full" size="sm">
            <Link href={link}>
              {t('Open', 'فتح')} {ownerLabel(owner, locale)}
              <ArrowUpRight className="ms-2 h-4 w-4 shrink-0" />
            </Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(
              'No owner link was recorded for this scope. Use the target and technical evidence to investigate.',
              'لم يُسجل رابط نظام مسؤول لهذا النطاق. استخدم الهدف والأدلة التقنية للتحقق.'
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t(
            'After the owner fixes the problem, run a new check. This checks both feeds; it is not a targeted repair.',
            'بعد إصلاح المشكلة في النظام المسؤول، شغّل فحصًا جديدًا. يفحص ذلك الخلاصتين ولا ينفذ إصلاحًا موجهًا.'
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={checking || unavailable}
          onClick={onCheck}
        >
          {t('Run new check', 'تشغيل فحص جديد')}
        </Button>
      </div>
      {rows.length ? (
        <details className="border-t pt-4">
          <summary className="cursor-pointer font-medium">
            {t('Current check coverage', 'تغطية الفحص الحالي')}
          </summary>
          <ObservationRows observations={rows} locale={locale} />
        </details>
      ) : null}
      {episode ? (
        <>
          <details className="space-y-3 border-t pt-4">
            <summary className="cursor-pointer font-medium">
              {t('Technical details', 'التفاصيل التقنية')}
            </summary>
            <p className="text-xs text-muted-foreground">
              {t(
                'Exact recorded evidence and observations',
                'الأدلة والنتائج المسجلة بدقة'
              )}
            </p>
            <IntegrityEvidence
              value={{
                check_key: episode.check_key,
                evidence: episode.evidence,
                affected_trend: episode.affected_trend,
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'Nearby owner activity is a suspected correlation, not a confirmed cause.',
                'النشاط القريب زمنيًا في النظام المسؤول ارتباط محتمل وليس سببًا مثبتًا.'
              )}
            </p>
            <IntegrityEvidence value={episode.attribution} />
          </details>
          <details className="space-y-3 border-t pt-4">
            <summary className="cursor-pointer font-medium">
              {t('Administrative decisions', 'القرارات الإدارية')}
            </summary>
            <p className="text-xs text-muted-foreground">
              {t(
                'Recording a closure does not repair or verify the feed. Suppression excludes this exact scope from tracking and scoring and cancels unstarted repairs until it expires. Fresh confirmation and approval are required afterward.',
                'تسجيل الإغلاق لا يصلح الخلاصة ولا يتحقق منها. يستثني الكتم هذا النطاق الدقيق من التتبع والتقييم ويلغي الإصلاحات التي لم تبدأ حتى انتهاء مدته. يتطلب ما بعد ذلك تأكيدًا وموافقة جديدين.'
              )}
            </p>
            {unavailable ? (
              <p className="text-xs text-destructive">
                {t(
                  'Decisions are disabled while current status is unavailable.',
                  'القرارات معطلة ما دامت الحالة الحالية غير متاحة.'
                )}
              </p>
            ) : null}
            <label className="block text-sm">
              {t('Decision note', 'ملاحظة القرار')}
              <Textarea
                aria-label={t('Episode decision note', 'ملاحظة قرار الحالة')}
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2"
                disabled={pending || unavailable}
              />
            </label>
            <label className="block text-sm">
              {t('Closure reason', 'سبب الإغلاق')}
              <select
                aria-label={t('Close reason', 'سبب الإغلاق')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending || unavailable}
                className={`${selectClass} mt-2 w-full`}
              >
                <option value="">{t('Choose a reason', 'اختر سببًا')}</option>
                {[
                  [
                    'resolved_manually',
                    'Fixed in owner system',
                    'أُصلحت في النظام المسؤول',
                  ],
                  [
                    'accepted_debt',
                    'Accepted known problem',
                    'قُبلت المشكلة المعروفة',
                  ],
                  [
                    'superseded',
                    'Replaced by another issue',
                    'استُبدلت بحالة أخرى',
                  ],
                  ['false_positive', 'Incorrect detection', 'رصد غير صحيح'],
                ].map(([value, en, ar]) => (
                  <option key={value} value={value}>
                    {t(en, ar)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={!note.trim() || !reason || pending || unavailable}
              onClick={() =>
                close.mutate(
                  { id: episode.id, reason, notes: note },
                  { onSuccess: onFinish }
                )
              }
            >
              {t('Record closure', 'تسجيل الإغلاق')}
            </Button>
            <label className="block text-sm">
              {t('Suppress this exact scope for', 'كتم هذا النطاق الدقيق لمدة')}
              <select
                aria-label={t('Suppression duration', 'مدة الكتم')}
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
                disabled={pending || unavailable}
                className={`${selectClass} mt-2 w-full`}
              >
                <option value={60}>{t('1 hour', 'ساعة')}</option>
                <option value={120}>{t('2 hours', 'ساعتين')}</option>
                <option value={1440}>{t('1 day', 'يوم')}</option>
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={!note.trim() || pending || unavailable}
              onClick={() =>
                suppress.mutate(
                  {
                    key: episode.check_key,
                    feed: episode.feed,
                    variant: episode.variant,
                    scope: episode.scope,
                    reason: note,
                    ttl_minutes: ttl,
                  },
                  { onSuccess: onFinish }
                )
              }
            >
              {t('Suppress exact scope', 'كتم النطاق الدقيق')}
            </Button>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error.message}
              </p>
            ) : null}
          </details>
        </>
      ) : null}
    </div>
  );
}

export function FeedIntegrityIssues({
  data,
  locale,
  params,
  setParams,
  unavailable,
  loading,
  checking,
  onCheck,
}: {
  data?: FeedIntegrityStatus;
  locale: IntegrityLocale;
  params: URLSearchParams;
  setParams: (changes: IntegrityParams) => void;
  unavailable: boolean;
  loading: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const [desktop, setDesktop] = useState(false);
  const revoke = useRevokeFeedIntegritySuppression(locale);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const observations = data?.current_observations || [];
  const episodes = data?.open_episodes || [];
  const q = (params.get('q') || '').trim().toLowerCase();
  const feed = params.get('feed') || 'all';
  const state = params.get('state') || 'all';
  const check = params.get('check') || '';
  const selected = episodes.find(
    (ep) => String(ep.id) === params.get('selected')
  );
  const inspectKey = selected?.check_key || params.get('inspect') || '';
  const inspectFeed = selected?.feed || params.get('inspectFeed') || '';
  const missingSelection =
    !!params.get('selected') && !selected && !!data && !unavailable;
  const inspectorOpen = !!inspectKey || missingSelection;
  const matching = episodes.filter(
    (ep) =>
      (feed === 'all' || ep.feed === feed) &&
      (!check || ep.check_key === check) &&
      (state === 'all' ||
        (state === 'unverified'
          ? !hasVerifiedScope(ep, observations)
          : ep.status === state)) &&
      `${checkTitle(ep.check_key, locale)} ${ep.summary} ${ep.scope} ${ep.feed} ${ep.variant}`
        .toLowerCase()
        .includes(q)
  );
  const observationGroups = groupObservations(
    observations.filter(
      (o) =>
        (problem(o) || incomplete(o)) &&
        (feed === 'all' || o.feed === feed) &&
        (!check || o.check_key === check) &&
        state === 'all' &&
        `${checkTitle(o.check_key, locale)} ${o.feed} ${o.variant}`
          .toLowerCase()
          .includes(q)
    )
  );
  const keys = new Set([
    ...matching.map((ep) => `${ep.feed}|${ep.check_key}`),
    ...observationGroups.map((rows) => `${rows[0].feed}|${rows[0].check_key}`),
  ]);
  const groups = [...keys]
    .map((key) => ({
      key,
      episodes: matching.filter((ep) => `${ep.feed}|${ep.check_key}` === key),
      observations:
        observationGroups.find(
          (rows) => `${rows[0].feed}|${rows[0].check_key}` === key
        ) || [],
    }))
    .sort(
      (a, b) =>
        Number(b.observations.some(problem)) -
          Number(a.observations.some(problem)) ||
        severityRank(
          a.observations[0]?.severity || a.episodes[0]?.severity || ''
        ) -
          severityRank(
            b.observations[0]?.severity || b.episodes[0]?.severity || ''
          ) ||
        a.key.localeCompare(b.key)
    );
  const pageSize = 10;
  const page = Math.min(
    Math.max(1, Math.floor(Number(params.get('page')) || 1)),
    Math.max(1, Math.ceil(groups.length / pageSize))
  );
  const finish = () =>
    setParams({
      selected: undefined,
      inspect: undefined,
      inspectFeed: undefined,
    });
  const inspector = missingSelection ? (
    <div className="space-y-3 text-sm">
      <p>
        {t(
          'This issue is no longer in the open issue list. Review Activity for its recorded history.',
          'لم تعد هذه المشكلة ضمن قائمة المشكلات المفتوحة. راجع النشاط لعرض سجلها.'
        )}
      </p>
      <Button variant="outline" size="sm" onClick={finish}>
        {t('Clear selection', 'إلغاء الاختيار')}
      </Button>
    </div>
  ) : (
    <IssueInspector
      key={selected?.id || `${inspectFeed}:${inspectKey}`}
      episode={selected}
      data={data}
      check={inspectKey}
      feed={inspectFeed}
      locale={locale}
      unavailable={unavailable}
      checking={checking}
      onCheck={onCheck}
      onFinish={finish}
    />
  );
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4">
            <CardTitle className="text-base">
              {t('Issue queue', 'قائمة المشكلات')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t(
                'Grouped by check type. Each issue retains its exact target and decision scope.',
                'مجمعة بحسب نوع الفحص. تحتفظ كل حالة بهدفها الدقيق ونطاق قرارها.'
              )}
            </p>
          </CardHeader>
          <div className="flex flex-wrap gap-2 border-y p-3">
            <div className="relative min-w-0 flex-1 basis-48">
              <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9"
                aria-label={t('Search issues', 'البحث في المشكلات')}
                placeholder={t(
                  'Search problem or target',
                  'ابحث عن مشكلة أو هدف'
                )}
                value={params.get('q') || ''}
                onChange={(e) =>
                  setParams({ q: e.target.value, page: undefined })
                }
              />
            </div>
            <select
              className={selectClass}
              aria-label={t('Filter by feed', 'تصفية حسب الخلاصة')}
              value={feed}
              onChange={(e) =>
                setParams({ feed: e.target.value, page: undefined })
              }
            >
              <option value="all">{t('All feeds', 'جميع الخلاصات')}</option>
              <option value="pods">{feedName('pods', locale)}</option>
              <option value="news">{feedName('news', locale)}</option>
              <option value="platform">{t('Checker', 'الفاحص')}</option>
            </select>
            <select
              className={selectClass}
              aria-label={t('Filter by issue state', 'تصفية حسب حالة المشكلة')}
              value={state}
              onChange={(e) =>
                setParams({ state: e.target.value, page: undefined })
              }
            >
              <option value="all">{t('All evidence', 'جميع الأدلة')}</option>
              <option value="open">{t('Open issues', 'مشكلات مفتوحة')}</option>
              <option value="recovering">
                {t('Recovering', 'قيد التعافي')}
              </option>
              <option value="unverified">
                {t('Awaiting fresh verification', 'بانتظار تحقق جديد')}
              </option>
            </select>
            {check ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParams({ check: undefined, page: undefined })}
              >
                {t('Clear check filter', 'إزالة تصفية الفحص')}
                <X className="ms-1 h-3 w-3" />
              </Button>
            ) : null}
          </div>
          {loading ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              {t('Loading issues…', 'جارٍ تحميل المشكلات…')}
            </p>
          ) : null}
          {unavailable ? (
            <p className="p-4 text-xs text-muted-foreground">
              {t(
                'Showing last loaded evidence. Current issue status could not be refreshed.',
                'تُعرض آخر أدلة محملة. تعذر تحديث حالة المشكلات الحالية.'
              )}
            </p>
          ) : null}
          <div className="divide-y">
            {groups
              .slice((page - 1) * pageSize, page * pageSize)
              .map((group) => {
                const [groupFeed, groupCheck] = group.key.split('|');
                const expanded =
                  check === groupCheck ||
                  selected?.check_key === groupCheck ||
                  inspectKey === groupCheck;
                return (
                  <details
                    key={`${group.key}:${expanded}`}
                    open={expanded || undefined}
                    className="group"
                  >
                    <summary className="cursor-pointer px-4 py-3 text-sm hover:bg-muted/30">
                      <span className="font-medium">
                        {group.episodes.length ||
                        group.observations.some(problem)
                          ? checkTitle(groupCheck, locale)
                          : checkName(groupCheck, locale)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {feedName(groupFeed, locale)} · {group.episodes.length}{' '}
                        {t('unresolved scopes', 'نطاقات غير مغلقة')}
                        {group.observations.length
                          ? ` · ${group.observations.length} ${t('current variants', 'متغيرات حالية')}`
                          : ` · ${t('Earlier evidence', 'أدلة سابقة')}`}
                      </span>
                    </summary>
                    <div className="border-t bg-muted/20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="m-2"
                        onClick={() =>
                          setParams({
                            inspect: groupCheck,
                            inspectFeed: groupFeed,
                            selected: undefined,
                          })
                        }
                      >
                        {t('Inspect check evidence', 'فحص أدلة الفحص')}
                      </Button>
                      {group.episodes.map((ep) => (
                        <button
                          key={ep.id}
                          aria-pressed={selected?.id === ep.id}
                          className={`flex w-full items-start justify-between gap-2 border-t px-4 py-3 text-start text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected?.id === ep.id ? 'bg-primary/10' : ''}`}
                          onClick={() =>
                            setParams({
                              selected: String(ep.id),
                              inspect: undefined,
                              inspectFeed: undefined,
                            })
                          }
                        >
                          <span className="min-w-0">
                            <span className="block">
                              <bdi>{variantLabel(ep.variant, locale)}</bdi>
                            </span>
                            <code
                              dir="ltr"
                              className="mt-1 block break-all text-xs text-muted-foreground"
                            >
                              {targetLabel(ep.scope)}
                            </code>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t('Last seen', 'آخر رصد')}{' '}
                              <IntegrityTime
                                value={ep.last_seen_at}
                                locale={locale}
                              />
                              {!hasVerifiedScope(ep, observations)
                                ? ` · ${t('Awaiting fresh verification', 'بانتظار تحقق جديد')}`
                                : ''}
                            </span>
                          </span>
                          <Badge className="shrink-0" variant={tone(ep.status)}>
                            {stateLabel(ep.status, locale)}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })}
          </div>
          {!loading && !unavailable && data && !groups.length ? (
            <div className="space-y-2 p-5">
              <p className="text-sm font-medium">
                {q || check || feed !== 'all' || state !== 'all'
                  ? t(
                      'No issues match these filters',
                      'لا توجد مشكلات تطابق هذه التصفية'
                    )
                  : t(
                      'No unresolved issues or incomplete results',
                      'لا توجد مشكلات غير مغلقة أو نتائج غير مكتملة'
                    )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  'Use Overview to inspect coverage, or change the filters.',
                  'راجع التغطية في النظرة العامة أو غيّر التصفية.'
                )}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
            <span>
              {groups.length} {t('check groups', 'مجموعات فحص')} ·{' '}
              <bdi>
                {page} / {Math.max(1, Math.ceil(groups.length / pageSize))}
              </bdi>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) })}
              >
                {t('Previous', 'السابق')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pageSize >= groups.length}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                {t('Next', 'التالي')}
              </Button>
            </div>
          </div>
        </Card>
        <Card className="sticky top-6 hidden min-w-0 xl:block">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-base">
              {t('Issue inspector', 'تفاصيل المشكلة')}
            </CardTitle>
            {desktop && inspectorOpen ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('Close inspector', 'إغلاق التفاصيل')}
                onClick={finish}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4 pt-0">
            {desktop && inspectorOpen ? (
              inspector
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  'Select a check or issue to inspect its evidence and next action.',
                  'اختر فحصًا أو مشكلة لعرض الأدلة والإجراء التالي.'
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Sheet
        open={!desktop && inspectorOpen}
        onOpenChange={(open) => {
          if (!open) finish();
        }}
      >
        <SheetContent
          side="bottom"
          hasAccessibleHeader
          lang={locale}
          closeLabel={t('Close inspector', 'إغلاق التفاصيل')}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className={`max-h-[86vh] overflow-y-auto ${locale === 'ar' ? 'font-sans' : ''}`}
        >
          <SheetHeader className="mb-4 pe-8 text-start">
            <SheetTitle>{t('Issue inspector', 'تفاصيل المشكلة')}</SheetTitle>
            <SheetDescription>
              {t(
                'Evidence, target and next action',
                'الأدلة والهدف والإجراء التالي'
              )}
            </SheetDescription>
          </SheetHeader>
          {!desktop && inspectorOpen ? inspector : null}
        </SheetContent>
      </Sheet>
      {(data?.active_suppressions.length || 0) > 0 ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">
              {t('Active suppressions', 'الكتم النشط')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t(
                'These scopes are excluded from tracking and scoring until expiry.',
                'تُستثنى هذه النطاقات من التتبع والتقييم حتى انتهاء الكتم.'
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {data?.active_suppressions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-3 border-t pt-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p>{checkTitle(s.check_key, locale)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <bdi>{targetLabel(s.scope)}</bdi> · {t('Expires', 'ينتهي')}{' '}
                    <IntegrityTime value={s.expires_at} locale={locale} />
                  </p>
                  <p
                    className="mt-1 break-words text-xs text-muted-foreground"
                    dir="auto"
                  >
                    {s.reason}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending || unavailable}
                  onClick={() => revoke.mutate(s.id)}
                >
                  {t('Revoke suppression', 'إلغاء الكتم')}
                </Button>
              </div>
            ))}
            {revoke.error ? (
              <p role="alert" className="text-xs text-destructive">
                {revoke.error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
