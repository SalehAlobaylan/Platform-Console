'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as api from '@/lib/api/cms/redundancy';

type Translate = (en: string, ar: string) => string;
function useTranslations(): Translate {
  const params = useSearchParams();
  return (en, ar) => (params.get('locale') === 'ar' ? ar : en);
}
function message(error: unknown) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'Request failed';
}
function bytes(n: number) {
  return `${(n / 1024 ** 2).toFixed(1)} MiB`;
}
function time(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}
function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded border border-destructive p-3 text-sm"
    >
      <AlertCircle className="h-4 w-4" />
      {message(error)}
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Retry / إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
function Pager({
  offset,
  count,
  total,
  onChange,
  t,
}: {
  offset: number;
  count: number;
  total?: number;
  onChange: (n: number) => void;
  t: Translate;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - 25))}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('Previous', 'السابق')}
      </Button>
      <span>
        {offset + (count ? 1 : 0)}–{offset + count}
        {total !== undefined && ` / ${total}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={total !== undefined ? offset + count >= total : count < 25}
        onClick={() => onChange(offset + 25)}
      >
        {t('Next', 'التالي')}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

export default function RedundancyWorkspace() {
  const t = useTranslations();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('review');
  const [familyTarget, setFamilyTarget] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['redundancy'] });
  const status = useQuery({
    queryKey: ['redundancy', 'status'],
    queryFn: api.getRedundancyStatus,
    refetchInterval: 30000,
  });
  const run = useMutation({
    mutationFn: api.runRedundancy,
    onSuccess: (result) => {
      setNotice(result.data.summary);
      void refresh();
    },
  });
  const pause = useMutation({
    mutationFn: api.pauseRedundancy,
    onSuccess: () => {
      setNotice(t('Schedule pause updated', 'تم تحديث إيقاف الجدولة'));
      void refresh();
    },
  });
  const data = status.data;
  const paused =
    !!data?.policy.paused_until &&
    new Date(data.policy.paused_until).getTime() > Date.now();
  return (
    <div
      className="space-y-6"
      dir={params.get('locale') === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {t('Redundancy Hygiene', 'تنظيم النسخ المكررة')}
            </h1>
            <Badge variant="outline">{t('Human review', 'مراجعة بشرية')}</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            {t(
              'Keep one trusted copy of each recording in Pods. Review evidence before changing visibility.',
              'احتفظ بنسخة موثوقة من كل تسجيل في بودز. راجع الأدلة قبل تغيير الظهور.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!data || status.isError || run.isPending || paused}
            onClick={() => run.mutate('full')}
          >
            {t('Backfill / continue', 'فحص المكتبة / متابعة')}
          </Button>
          <Button
            disabled={!data || status.isError || run.isPending || paused}
            onClick={() => run.mutate('frontier')}
          >
            {run.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="me-2 h-4 w-4" />
            )}
            {t('Scan changes', 'فحص التغييرات')}
          </Button>
        </div>
      </div>
      {status.isPending && (
        <p aria-busy="true">
          {t('Loading library identity…', 'جار تحميل هوية المكتبة…')}
        </p>
      )}
      {status.isError && (
        <Failure error={status.error} retry={() => void status.refetch()} />
      )}
      {(run.isError || pause.isError) && (
        <Failure error={run.error || pause.error} />
      )}
      {notice && (
        <p role="status" className="rounded border p-3 text-sm" dir="auto">
          {notice}
        </p>
      )}
      {data && !status.isError && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Metric
              title={t('Media records', 'سجلات الوسائط')}
              value={data.library_items}
            />
            <Metric
              title={t('Awaiting review', 'بانتظار المراجعة')}
              value={data.open_proposals}
            />
            <Metric
              title={t('Active families', 'المجموعات النشطة')}
              value={data.active_families}
            />
            <Metric
              title={t('Redundant share', 'نسبة التكرار')}
              value={`${(data.redundancy_rate * 100).toFixed(1)}%`}
            />
            <Metric
              title={t('Bytes held by copies', 'مساحة النسخ المكررة')}
              value={bytes(data.redundant_bytes)}
            />
            <Metric
              title={t('Collapse', 'دمج الظهور')}
              value={
                data.policy.enabled && data.policy.collapse_enabled
                  ? t('Active', 'نشط')
                  : t('Off', 'متوقف')
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-4">
            <div className="space-y-1 text-sm">
              <p>
                {paused
                  ? `${t('Paused until', 'متوقف حتى')} ${time(data.policy.paused_until)}`
                  : data.policy.enabled
                    ? t('Scheduled detection enabled', 'الكشف المجدول مفعّل')
                    : t('Manual detection only', 'الكشف اليدوي فقط')}
                .{' '}
                {t(
                  'Identity confirmation always requires review.',
                  'تأكيد الهوية يتطلب المراجعة دائماً.'
                )}
              </p>
              <p className="text-muted-foreground">
                {t('Last complete sweep', 'آخر فحص مكتمل')}:{' '}
                <bdi>{time(data.policy.last_swept_at)}</bdi> ·{' '}
                {t('Oldest proposal', 'أقدم اقتراح')}:{' '}
                <bdi>{time(data.oldest_proposal_at)}</bdi>
              </p>
              {data.policy.scan_state.scope && (
                <p>
                  {t('Resumable scan in progress', 'يوجد فحص قابل للمتابعة')}:{' '}
                  <bdi>{data.policy.scan_state.scope}</bdi>
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pause.isPending}
              onClick={() => pause.mutate(paused ? 0 : 120)}
            >
              {paused ? t('Resume', 'استئناف') : t('Pause 2h', 'إيقاف ساعتين')}
            </Button>
          </div>
          {data.reclaim_awaiting_approval > 0 && (
            <p className="rounded border p-3 text-sm">
              {data.reclaim_awaiting_approval}{' '}
              {t(
                'reclaim recommendations await human approval.',
                'توصيات لاسترداد المساحة بانتظار الموافقة البشرية.'
              )}{' '}
              <Link className="underline" href="/platform/media/circulation">
                {t('Open Circulation', 'فتح التداول')}
              </Link>
            </p>
          )}
          {data.attention?.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-destructive p-3 text-sm"
            >
              <p>
                {item.canonical_unavailable
                  ? t(
                      'A canonical recording is unavailable; inspect this family.',
                      'النسخة الرئيسية غير متاحة؛ افحص المجموعة.'
                    )
                  : t(
                      'A collapsed member has more engagement than its canonical.',
                      'نسخة مخفية بالدمج لديها تفاعل أعلى من النسخة الرئيسية.'
                    )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFamilyTarget(item.id);
                  setTab('families');
                }}
              >
                {t('Inspect family', 'فحص المجموعة')}
              </Button>
            </div>
          ))}
          {data.latest_run?.status === 'failed' && (
            <Failure error={{ message: data.latest_run.error }} />
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="review">
                {t('Review', 'المراجعة')}
              </TabsTrigger>
              <TabsTrigger value="families">
                {t('Families', 'المجموعات')}
              </TabsTrigger>
              <TabsTrigger value="activity">
                {t('Activity', 'السجل')}
              </TabsTrigger>
              <TabsTrigger value="settings">
                {t('Settings', 'الإعدادات')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="review">
              <Review t={t} refresh={refresh} />
            </TabsContent>
            <TabsContent value="families">
              <Families
                key={familyTarget}
                initialFamily={familyTarget}
                t={t}
                refresh={refresh}
              />
            </TabsContent>
            <TabsContent value="activity">
              <Activity t={t} />
            </TabsContent>
            <TabsContent value="settings">
              <Settings t={t} status={data} refresh={refresh} />
            </TabsContent>
          </Tabs>
          <details className="rounded border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t('Diagnostics and evidence coverage', 'التشخيص وتغطية الأدلة')}
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                {t('Cached transcript signatures', 'بصمات النصوص المخزنة')}:{' '}
                {data.fingerprint_items} · <bdi>{data.evaluator_version}</bdi>
              </p>
              <p>
                {t(
                  'Duration is a hard gate. Transcript bodies carry the strongest identity evidence. Embeddings corroborate; shared thumbnails cannot establish identity.',
                  'المدة شرط أساسي. متن النص هو أقوى دليل للهوية، والتضمينات دليل مساعد، والصور المشتركة لا تثبت التطابق.'
                )}
              </p>
              <p>
                {t(
                  'Near-match admission hints proceed through CMS lifecycle reconciliation. Exact URL evidence never bypasses unfinished work.',
                  'تمر إشارات التشابه عبر دورة حياة المحتوى في CMS. تطابق الرابط لا يتجاوز العمل غير المكتمل.'
                )}
              </p>
              <pre
                dir="ltr"
                className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs"
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
function Evidence({
  item,
  snippet,
  t,
}: {
  item: api.MediaEvidence;
  snippet?: string;
  t: Translate;
}) {
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const alternatives = [
    item.fallback_playback_url,
    item.media_url,
    ...(Array.isArray(item.media_renditions)
      ? item.media_renditions.map((r) => r.playback_url || r.url)
      : []),
  ];
  // Progressive/audio alternatives can be auditioned without an HLS library.
  const urls = [
    ...new Set(
      (item.playback_type === 'hls'
        ? [
            ...alternatives.filter(
              (url) => url && !/\.m3u8(?:\?|$)/i.test(url)
            ),
            item.playback_url,
            ...alternatives,
          ]
        : [item.playback_url, ...alternatives]
      ).filter((url): url is string => !!url)
    ),
  ];
  const playback = urls[playbackIndex];
  return (
    <div className="min-w-0 space-y-3 rounded border p-4">
      <h3 className="font-semibold" dir="auto">
        {item.title || item.id}
      </h3>
      <p className="text-sm text-muted-foreground" dir="auto">
        {item.source_name || '—'} · {Math.round((item.duration_sec || 0) / 60)}{' '}
        min · {bytes(item.file_size_bytes)}
      </p>
      {item.thumbnail_url && (
        <Image
          unoptimized
          width={480}
          height={128}
          src={item.thumbnail_url}
          alt=""
          className="h-32 w-full rounded object-contain"
        />
      )}
      {playback && (
        <audio
          aria-label={t('Recording preview', 'معاينة التسجيل')}
          controls
          preload="none"
          src={playback}
          className="w-full"
          onError={() => {
            if (playbackIndex + 1 < urls.length) setPlaybackIndex((i) => i + 1);
            else setPlaybackFailed(true);
          }}
        />
      )}
      {playbackFailed && (
        <p role="alert">
          {t(
            'Preview unavailable. Open the original recording to compare.',
            'المعاينة غير متاحة. افتح التسجيل الأصلي للمقارنة.'
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          className="underline"
          href={`/platform/media/atomization?tab=studio&item=${item.id}`}
        >
          {t('Inspect media', 'فحص الوسائط')}
        </Link>
        {item.original_url && (
          <a
            href={item.original_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            {t('Original', 'المصدر الأصلي')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('Views / likes / shares', 'مشاهدات / إعجابات / مشاركات')}:{' '}
        {item.view_count} / {item.like_count} / {item.share_count}
      </p>
      <div>
        <p className="mb-1 text-xs font-semibold">
          {t('Transcript evidence', 'دليل من النص')}
        </p>
        <p className="rounded bg-muted p-3 text-sm leading-relaxed" dir="auto">
          {snippet ||
            t('No transcript evidence available', 'لا تتوفر أدلة نصية')}
        </p>
      </div>
      <bdi className="block break-all text-xs text-muted-foreground">
        {item.id}
      </bdi>
    </div>
  );
}
function Review({
  t,
  refresh,
}: {
  t: Translate;
  refresh: () => Promise<unknown>;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const list = useQuery({
    queryKey: ['redundancy', 'pairs', offset],
    queryFn: () => api.listRedundancyPairs({ offset, verdict: 'review' }),
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ['redundancy', 'pair', selected],
    queryFn: () => api.getRedundancyPair(selected),
    enabled: !!selected,
  });
  const done = () => {
    setSelected('');
    setReason('');
    void refresh();
  };
  const confirm = useMutation({
    mutationFn: api.confirmRedundancyPair,
    onSuccess: (result) => {
      setNotice(
        result.warning ||
          t(
            'Identity confirmed. Family visibility follows the collapse policy.',
            'تم تأكيد الهوية. يتبع الظهور إعداد دمج المجموعات.'
          )
      );
      done();
    },
  });
  const reject = useMutation({
    mutationFn: api.rejectRedundancyPair,
    onSuccess: () => {
      setNotice(t('Pair rejected permanently', 'تم رفض الزوج بشكل دائم'));
      done();
    },
  });
  const data = detail.data;
  const pending = confirm.isPending || reject.isPending;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {t('Review recording identity', 'مراجعة هوية التسجيل')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && <p role="status">{notice}</p>}
          {list.isPending && (
            <p aria-busy="true">
              {t('Loading proposals…', 'جار تحميل الاقتراحات…')}
            </p>
          )}
          {list.isError && (
            <Failure error={list.error} retry={() => void list.refetch()} />
          )}
          {list.data?.data.length === 0 && (
            <p>
              {t(
                'No proposals awaiting review in this page.',
                'لا توجد اقتراحات بانتظار المراجعة في هذه الصفحة.'
              )}
            </p>
          )}
          {list.data?.data.map((pair) => (
            <button
              key={pair.id}
              onClick={() => {
                setSelected(pair.id);
                setReason('');
              }}
              className={`flex w-full flex-wrap items-center justify-between gap-3 rounded border p-3 text-start hover:bg-muted ${selected === pair.id ? 'border-primary' : ''}`}
            >
              <div>
                <Badge
                  variant={
                    pair.verdict === 'high_confidence_duplicate'
                      ? 'warning'
                      : 'secondary'
                  }
                >
                  {pair.verdict === 'high_confidence_duplicate'
                    ? t('Strong evidence', 'أدلة قوية')
                    : t('Possible copy', 'نسخة محتملة')}
                </Badge>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  <bdi>{pair.item_a_id}</bdi> ↔ <bdi>{pair.item_b_id}</bdi>
                </p>
              </div>
              <span>
                {Math.round(pair.confidence * 100)}% · {t('Compare', 'مقارنة')}
              </span>
            </button>
          ))}
          {list.data && (
            <Pager
              offset={offset}
              count={list.data.data.length}
              total={list.data.total}
              onChange={(n) => {
                setOffset(n);
                setSelected('');
              }}
              t={t}
            />
          )}
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('Compare before confirming', 'قارن قبل التأكيد')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.isPending && (
              <p aria-busy="true">
                {t('Loading evidence…', 'جار تحميل الأدلة…')}
              </p>
            )}
            {detail.isError && (
              <Failure
                error={detail.error}
                retry={() => void detail.refetch()}
              />
            )}
            {data && !detail.isError && (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.items.map((item) => (
                    <Evidence
                      key={item.id}
                      item={item}
                      snippet={data.transcript_snippets[item.id]}
                      t={t}
                    />
                  ))}
                </div>
                {data.matching_shingle && (
                  <p className="text-sm">
                    {t('Shared transcript phrase', 'عبارة مشتركة في النص')}:{' '}
                    <span dir="auto">{data.matching_shingle}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {Object.entries(data.evaluations[0]?.lane_scores || {}).map(
                    ([lane, score]) => (
                      <Metric
                        key={lane}
                        title={lane}
                        value={
                          score.available
                            ? `${Math.round(score.score * 100)}%`
                            : score.reason || 'absent'
                        }
                      />
                    )
                  )}
                </div>
                <p className="rounded border p-3 text-sm">
                  {t(
                    'Confirming joins these records into one family. When collapse is enabled, only its canonical copy enters Pods. Their records, engagement and files remain separate.',
                    'يضم التأكيد السجلين في مجموعة واحدة. عند تفعيل دمج الظهور تظهر النسخة الرئيسية فقط في بودز، وتبقى السجلات والتفاعلات والملفات منفصلة.'
                  )}
                </p>
                <Label htmlFor="reject-reason">
                  {t('Reason for rejection', 'سبب الرفض')}
                </Label>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  dir="auto"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      pending ||
                      data.pair.tombstoned ||
                      !data.pair.latest_evaluation_id
                    }
                    onClick={() =>
                      confirm.mutate({
                        id: data.pair.id,
                        evaluationId: data.pair.latest_evaluation_id!,
                      })
                    }
                  >
                    <Check className="me-2 h-4 w-4" />
                    {t('Confirm same recording', 'تأكيد أنهما نفس التسجيل')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending || reason.trim().length < 3}
                    onClick={() => reject.mutate({ id: data.pair.id, reason })}
                  >
                    <X className="me-2 h-4 w-4" />
                    {t('Different recordings', 'تسجيلان مختلفان')}
                  </Button>
                </div>
                <details>
                  <summary>
                    {t('Raw evaluation evidence', 'أدلة التقييم التفصيلية')}
                  </summary>
                  <pre
                    dir="ltr"
                    className="max-h-80 overflow-auto whitespace-pre-wrap bg-muted p-3 text-xs"
                  >
                    {JSON.stringify(data.evaluations, null, 2)}
                  </pre>
                </details>
              </>
            )}
            {(confirm.isError || reject.isError) && (
              <Failure error={confirm.error || reject.error} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function Families({
  t,
  refresh,
  initialFamily = '',
}: {
  initialFamily?: string;
  t: Translate;
  refresh: () => Promise<unknown>;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(initialFamily);
  const [reason, setReason] = useState('');
  const [candidate, setCandidate] = useState('');
  const [locked, setLocked] = useState(true);
  const list = useQuery({
    queryKey: ['redundancy', 'families', offset],
    queryFn: () => api.listRedundancyFamilies(offset),
  });
  const detail = useQuery({
    queryKey: ['redundancy', 'family', selected],
    queryFn: () => api.getRedundancyFamily(selected),
    enabled: !!selected,
  });
  const canonical = useMutation({
    mutationFn: api.setRedundancyCanonical,
    onSuccess: () => void refresh(),
  });
  const dissolve = useMutation({
    mutationFn: api.dissolveRedundancyFamily,
    onSuccess: () => {
      setSelected('');
      setReason('');
      void refresh();
    },
  });
  const data = detail.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('Confirmed families', 'المجموعات المؤكدة')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.isError && (
            <Failure error={list.error} retry={() => void list.refetch()} />
          )}
          {list.isPending && (
            <p aria-busy="true">
              {t('Loading families…', 'جار تحميل المجموعات…')}
            </p>
          )}
          {list.data?.data.length === 0 && (
            <p>{t('No active families', 'لا توجد مجموعات نشطة')}</p>
          )}
          {list.data?.data.map((family) => (
            <button
              className="w-full rounded border p-3 text-start hover:bg-muted"
              key={family.id}
              onClick={() => {
                setSelected(family.id);
                setCandidate(family.canonical_content_item_id);
                setLocked(!!family.canonical_locked_by);
              }}
            >
              <span className="font-medium">
                {t('Canonical', 'النسخة الرئيسية')}:{' '}
                <bdi className="break-all text-xs">
                  {family.canonical_content_item_id}
                </bdi>
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {time(family.last_confirmed_at)} ·{' '}
                {family.canonical_locked_by
                  ? t('Human locked', 'مقفلة بشرياً')
                  : t('Scored selection', 'اختيار بالتقييم')}
              </p>
            </button>
          ))}
          {list.data && (
            <Pager
              offset={offset}
              count={list.data.data.length}
              total={list.data.total}
              onChange={setOffset}
              t={t}
            />
          )}
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('Family visibility and correction', 'ظهور المجموعة وتصحيحها')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.isPending && (
              <p aria-busy="true">
                {t('Loading family…', 'جار تحميل المجموعة…')}
              </p>
            )}
            {detail.isError && (
              <Failure
                error={detail.error}
                retry={() => void detail.refetch()}
              />
            )}
            {data && !detail.isError && (
              <>
                <ul className="list-inside list-disc text-sm">
                  {data.family.canonical_reasons?.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                {data.members.map((member) => {
                  const item = data.items.find(
                    (i) => i.id === member.content_item_id
                  );
                  return (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                      key={member.content_item_id}
                    >
                      <div>
                        <p dir="auto">
                          {item?.title || member.content_item_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.role === 'canonical'
                            ? t('Canonical', 'رئيسية')
                            : data.collapse_active
                              ? t(
                                  'Collapsed from feed',
                                  'مخفية من الخلاصة بالدمج'
                                )
                              : t(
                                  'Redundant; collapse is off',
                                  'مكررة؛ دمج الظهور متوقف'
                                )}{' '}
                          · {bytes(item?.file_size_bytes || 0)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={
                          candidate === member.content_item_id
                            ? 'secondary'
                            : 'outline'
                        }
                        onClick={() => setCandidate(member.content_item_id)}
                      >
                        {candidate === member.content_item_id
                          ? t('Selected', 'مختارة')
                          : t('Select canonical', 'اختيار كرئيسية')}
                      </Button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <Switch
                    id="canonical-lock"
                    checked={locked}
                    onCheckedChange={setLocked}
                  />
                  <Label htmlFor="canonical-lock">
                    {t(
                      'Keep human canonical lock during future merges',
                      'الحفاظ على القفل البشري خلال الدمج المستقبلي'
                    )}
                  </Label>
                </div>
                <Button
                  disabled={
                    !candidate || canonical.isPending || dissolve.isPending
                  }
                  onClick={() =>
                    canonical.mutate({
                      id: selected,
                      contentItemId: candidate,
                      locked,
                    })
                  }
                >
                  {t('Save canonical decision', 'حفظ قرار النسخة الرئيسية')}
                </Button>
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="dissolve-reason">
                    {t(
                      'Dissolve mistaken family — reason required',
                      'تفكيك مجموعة خاطئة — يلزم السبب'
                    )}
                  </Label>
                  <Textarea
                    id="dissolve-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                    dir="auto"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Restores independent feed eligibility and permanently rejects these family edges. Pending hygiene recommendations are cancelled. Previously applied demotions remain owned by Circulation.',
                      'يعيد أهلية الظهور المستقلة ويرفض روابط المجموعة بشكل دائم. تُلغى التوصيات المعلقة، ويظل إلغاء التخفيضات المنفذة من مسؤولية التداول.'
                    )}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={
                      reason.trim().length < 3 ||
                      dissolve.isPending ||
                      canonical.isPending
                    }
                    onClick={() => dissolve.mutate({ id: selected, reason })}
                  >
                    {t('Dissolve family', 'تفكيك المجموعة')}
                  </Button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {t('Circulation handoff', 'التسليم إلى التداول')}
                  </h3>
                  {data.recommendations.map((rec) => (
                    <p className="text-sm" key={rec.id}>
                      <bdi>{rec.verdict}</bdi> · <bdi>{rec.status}</bdi>
                    </p>
                  ))}
                  <Link
                    href="/platform/media/circulation"
                    className="text-sm underline"
                  >
                    {t(
                      'Review consequences in Circulation',
                      'مراجعة النتائج في التداول'
                    )}
                  </Link>
                </div>
              </>
            )}
            {(canonical.isError || dissolve.isError) && (
              <Failure error={canonical.error || dissolve.error} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function Activity({ t }: { t: Translate }) {
  const [offset, setOffset] = useState(0);
  const [runID, setRunID] = useState('');
  const [evaluationOffset, setEvaluationOffset] = useState(0);
  const [outcome, setOutcome] = useState('');
  const [actionOffset, setActionOffset] = useState(0);
  const runs = useQuery({
    queryKey: ['redundancy', 'runs', offset],
    queryFn: () => api.listRedundancyRuns(offset),
    refetchInterval: 30000,
  });
  const run = useQuery({
    queryKey: ['redundancy', 'run', runID, evaluationOffset],
    queryFn: () => api.getRedundancyRun(runID, evaluationOffset),
    enabled: !!runID,
  });
  const actions = useQuery({
    queryKey: ['redundancy', 'actions', runID, outcome, actionOffset],
    queryFn: () =>
      api.listRedundancyActions({
        offset: actionOffset,
        run: runID || undefined,
        outcome: outcome || undefined,
      }),
    refetchInterval: 30000,
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('Detection runs', 'جولات الكشف')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.isError && (
            <Failure error={runs.error} retry={() => void runs.refetch()} />
          )}
          {runs.data?.data?.map((row) => (
            <button
              key={row.id}
              className="w-full rounded border p-3 text-start hover:bg-muted"
              onClick={() => {
                setRunID(row.id);
                setEvaluationOffset(0);
                setActionOffset(0);
              }}
            >
              <Badge
                variant={row.status === 'failed' ? 'destructive' : 'outline'}
              >
                {row.status}
              </Badge>
              <span className="ms-3 text-xs">{time(row.started_at)}</span>
              <p className="mt-2 text-sm" dir="auto">
                {row.summary || row.error}
              </p>
            </button>
          ))}
          {runs.data && (
            <Pager
              offset={offset}
              count={runs.data.data?.length || 0}
              onChange={setOffset}
              t={t}
            />
          )}
          {runID && (
            <>
              <Button size="sm" variant="outline" onClick={() => setRunID('')}>
                {t('Clear run filter', 'إلغاء تصفية الجولة')}
              </Button>
              {run.isError && <Failure error={run.error} />}
              {run.data && (
                <>
                  <pre
                    dir="ltr"
                    className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs"
                  >
                    {JSON.stringify(run.data, null, 2)}
                  </pre>
                  <Pager
                    offset={evaluationOffset}
                    count={run.data.evaluations?.length || 0}
                    total={run.data.total}
                    onChange={setEvaluationOffset}
                    t={t}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {t(
              'Action history and admission checks',
              'سجل الإجراءات وفحص القبول'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="action-outcome">
            {t('Outcome filter', 'تصفية النتيجة')}
          </Label>
          <select
            id="action-outcome"
            className="h-10 rounded border bg-background px-3 text-sm"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setActionOffset(0);
            }}
          >
            <option value="">{t('All outcomes', 'كل النتائج')}</option>
            {['succeeded', 'completed', 'failed', 'paused', 'skipped'].map(
              (o) => (
                <option key={o}>{o}</option>
              )
            )}
          </select>
          {actions.isError && (
            <Failure
              error={actions.error}
              retry={() => void actions.refetch()}
            />
          )}
          {actions.data?.data?.map((action) => (
            <details key={action.id} className="rounded border p-3 text-sm">
              <summary className="cursor-pointer">
                <bdi>{action.action_kind}</bdi> · <bdi>{action.outcome}</bdi> ·{' '}
                {time(action.created_at)}
              </summary>
              <p className="my-2" dir="auto">
                {action.reason} · {action.actor}
              </p>
              <pre
                dir="ltr"
                className="max-h-64 overflow-auto whitespace-pre-wrap bg-muted p-3 text-xs"
              >
                {JSON.stringify(action.metadata, null, 2)}
              </pre>
            </details>
          ))}
          {actions.data && (
            <Pager
              offset={actionOffset}
              count={actions.data.data?.length || 0}
              total={actions.data.total}
              onChange={setActionOffset}
              t={t}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Settings({
  t,
  status,
  refresh,
}: {
  t: Translate;
  status: api.RedundancyStatus;
  refresh: () => Promise<unknown>;
}) {
  const current = {
    ...status.policy,
    lane_settings: status.lane_settings,
  };
  const [edits, setEdits] = useState<Partial<typeof current>>({});
  const [revision, setRevision] = useState<string | null>(null);
  const draft = { ...current, ...edits };
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: api.updateRedundancyPolicy,
    onSuccess: () => {
      setEdits({});
      setRevision(null);
      setSaved(true);
      void refresh();
    },
  });
  const patch = (change: Partial<typeof draft>) => {
    setSaved(false);
    setRevision((p) => p ?? status.policy.updated_at);
    setEdits((p) => ({ ...p, ...change }));
  };
  const numeric: Array<{
    key:
      | 'sweep_interval_minutes'
      | 'max_frontier_items'
      | 'max_pairs_scored'
      | 'proposal_floor';
    en: string;
    ar: string;
    min: number;
    max: number;
    step?: number;
  }> = [
    {
      key: 'sweep_interval_minutes',
      en: 'Sweep interval (minutes)',
      ar: 'فترة الفحص بالدقائق',
      min: 5,
      max: 10080,
    },
    {
      key: 'max_frontier_items',
      en: 'Items per run',
      ar: 'العناصر لكل جولة',
      min: 1,
      max: 5000,
    },
    {
      key: 'max_pairs_scored',
      en: 'Pair evaluations per run',
      ar: 'تقييمات الأزواج لكل جولة',
      min: 1,
      max: 50000,
    },
    {
      key: 'proposal_floor',
      en: 'Proposal confidence floor',
      ar: 'الحد الأدنى لثقة الاقتراح',
      min: 0.5,
      max: 1,
      step: 0.01,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('Policy and safety controls', 'السياسة وضوابط الأمان')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              ...edits,
              expected_updated_at: revision ?? status.policy.updated_at,
            });
          }}
        >
          {[
            {
              key: 'enabled' as const,
              en: 'Enable scheduled detection and family consequences',
              ar: 'تفعيل الكشف المجدول ونتائج المجموعات',
            },
            {
              key: 'collapse_enabled' as const,
              en: 'Serve only canonical members in Pods',
              ar: 'إظهار النسخ الرئيسية فقط في بودز',
            },
            {
              key: 'emit_circulation_recs' as const,
              en: 'Recommend demotion and approved reclamation to Circulation',
              ar: 'اقتراح التخفيض والاسترداد بموافقة إلى التداول',
            },
          ].map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <Switch
                id={row.key}
                checked={draft[row.key]}
                onCheckedChange={(v) => patch({ [row.key]: v })}
              />
              <Label htmlFor={row.key}>{t(row.en, row.ar)}</Label>
            </div>
          ))}
          <div className="grid gap-4 md:grid-cols-2">
            {numeric.map((row) => (
              <div key={row.key} className="space-y-2">
                <Label htmlFor={row.key}>{t(row.en, row.ar)}</Label>
                <Input
                  id={row.key}
                  type="number"
                  min={row.min}
                  max={row.max}
                  step={row.step || 1}
                  required
                  value={draft[row.key]}
                  onChange={(e) => patch({ [row.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <details className="rounded border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t('Evidence thresholds and weights', 'حدود الأدلة وأوزانها')}
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Object.entries(draft.lane_settings).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`lane-${key}`}>
                    <bdi>{key.replaceAll('_', ' ')}</bdi>
                  </Label>
                  <Input
                    id={`lane-${key}`}
                    type="number"
                    min={
                      key === 'transcript_confirm'
                        ? 0.8
                        : key === 'embedding_confirm'
                          ? 0.93
                          : key === 'title_confirm'
                            ? 0.7
                            : key === 'transcript_weight'
                              ? 0.01
                              : 0
                    }
                    max={key === 'thumbnail_weight' ? 0.05 : 1}
                    step={0.01}
                    value={value}
                    required
                    onChange={(e) =>
                      patch({
                        lane_settings: {
                          ...draft.lane_settings,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </details>
          <p className="text-sm text-muted-foreground">
            {t(
              'Changing evidence settings requires a new scan before older proposals can be confirmed. Recoverable deletion always requires Circulation approval.',
              'يتطلب تغيير إعدادات الأدلة فحصاً جديداً قبل تأكيد الاقتراحات القديمة. حذف النسخ القابل للاسترداد يتطلب دائماً موافقة التداول.'
            )}
          </p>
          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {t('Save policy', 'حفظ السياسة')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEdits({});
                setRevision(null);
                save.reset();
                void refresh();
                setSaved(false);
              }}
            >
              {t('Discard changes', 'تجاهل التغييرات')}
            </Button>
          </div>
          {saved && <p role="status">{t('Policy saved', 'تم حفظ السياسة')}</p>}
          {save.isError && <Failure error={save.error} />}
        </form>
      </CardContent>
    </Card>
  );
}
