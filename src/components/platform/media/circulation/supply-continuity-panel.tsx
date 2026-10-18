'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  DatabaseZap,
  Eye,
  RadioTower,
  ScanLine,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  useCancelMediaSupplyAction,
  useConfirmMediaSupplyActionPreview,
  useCreateMediaSupplyActionPreview,
  useMediaSupplyAction,
  useMediaSupplyActionEvents,
  useMediaSupplyEligibleActions,
  useMediaSupplyEpisodes,
  useMediaSupplyActionHistory,
	useMediaSupplyQualificationState,
} from '@/hooks/use-media-circulation';
import type {
  MediaSupplyEpisode,
  MediaSupplyActionPreview,
  MediaSupplyEpisodeListResponse,
  MediaSupplyStatusResponse,
} from '@/types/platform/media-circulation';
import {
  OPERATOR_CONTRACT_VERSION,
  type OperatorVisibleContext,
} from '@/types/platform/operator';

// This is navigation context only. CMS re-reads all supply evidence and is the
// only component that can return an eligible action; no panel value is sent as
// evidence or an executable argument.
function supplyOperatorContext(episodeID?: string): OperatorVisibleContext {
	const target = episodeID ?? 'current';
	return {
		schema_version: OPERATOR_CONTRACT_VERSION,
		domain: 'media_circulation',
		view: 'supply',
		filters: {},
		subjects: episodeID ? [{ type: 'media_supply_episode', id: episodeID }] : [{ type: 'tenant', id: 'current' }],
		selection: { mode: 'explicit', ids: [target], count: 1 },
		available_intents: ['explain', 'investigate', 'recommend', 'compare', 'resolve'],
	};
}

type VerdictMeta = {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
};

const VERDICT_META: Record<string, VerdictMeta & { ar: string }> = {
  no_current_break_observed: {
    label: 'No current break observed',
	ar: 'لم يُرصد انقطاع حالي',
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  observation_pending: {
    label: 'Observation in progress',
	ar: 'الرصد جارٍ',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    icon: Clock3,
  },
  source_due_not_admitted: {
    label: 'Due without CMS run',
	ar: 'مصدر مستحق بلا تشغيل CMS',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    icon: AlertTriangle,
  },
  source_run_without_ingest_proof: {
    label: 'Run missing ingest proof',
	ar: 'التشغيل يفتقد إثبات الإدخال',
    className:
      'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    icon: AlertTriangle,
  },
  pods_delivery_evidence_degraded: {
    label: 'Pods proof degraded',
	ar: 'إثبات Pods متدهور',
    className:
      'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    icon: AlertTriangle,
  },
  evidence_unavailable: {
    label: 'Evidence unavailable',
	ar: 'الأدلة غير متاحة',
    className:
      'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    icon: CircleDashed,
  },
  no_active_media_sources: {
    label: 'No active Media sources',
	ar: 'لا توجد مصادر وسائط نشطة',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    icon: RadioTower,
  },
	healthy_no_upstream_change: { label: 'No upstream change', ar: 'لا تغيير لدى المزوّد', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
	upstream_change_deferred: { label: 'Upstream change deferred', ar: 'تغيير المزوّد مؤجّل', className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200', icon: Clock3 },
	observation_blocked_by_intake: { label: 'Observation blocked by intake', ar: 'الرصد محجوب بسبب سعة الإدخال', className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300', icon: AlertTriangle },
	no_base_eligible_inventory: { label: 'No eligible Pods inventory', ar: 'لا يوجد مخزون مؤهل لـ Pods', className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200', icon: AlertTriangle },
	eligible_not_generation_reachable: { label: 'Eligible items missing from generation', ar: 'عناصر مؤهلة غائبة عن الجيل', className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300', icon: AlertTriangle },
	eligible_not_returned: { label: 'Generation items not returned', ar: 'عناصر الجيل لم تُرجع', className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300', icon: AlertTriangle },
	pods_inventory_stale: { label: 'Pods inventory is stale', ar: 'مخزون Pods قديم', className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200', icon: Clock3 },
};

function verdictMeta(verdict: string, ar = false): VerdictMeta {
  const found = VERDICT_META[verdict];
  return found ? { ...found, label: ar ? found.ar : found.label } : (
    {
      label: ar ? 'أدلة CMS تحتاج إلى مراجعة' : 'CMS evidence needs review',
      className: 'border-border bg-muted text-muted-foreground',
      icon: CircleDashed,
    }
  );
}

function completenessLabel(value: string, ar: boolean) {
  if (value === 'complete') return ar ? 'أدلة مكتملة' : 'Complete evidence';
  if (value === 'partial') return ar ? 'أدلة جزئية' : 'Partial evidence';
  return ar ? 'الأدلة غير متاحة' : 'Evidence unavailable';
}

function evaluatorLabel(recordingEnabled: boolean | null, ar: boolean) {
  if (recordingEnabled === true) return ar ? 'التسجيل مفعّل' : 'Recording enabled';
  if (recordingEnabled === false) return ar ? 'التسجيل متوقف' : 'Recording paused';
  return ar ? 'حالة التحكم غير معروفة' : 'Control state unknown';
}

function evaluatorTone(recordingEnabled: boolean | null, workerState: string) {
  if (workerState === 'stale') {
    return 'border-rose-500/25 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300';
  }
  if (workerState === 'not_started') {
    return 'border-violet-500/25 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300';
  }
  if (recordingEnabled === true) {
    return 'border-sky-500/25 bg-sky-500/[0.06] text-sky-700 dark:text-sky-300';
  }
  if (recordingEnabled === false) {
    return 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800 dark:text-amber-200';
  }
  return 'border-violet-500/25 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300';
}

function workerLabel(state: string, ar: boolean) {
  if (state === 'ready') return ar ? 'حلقة العامل جاهزة' : 'Loop ready';
  if (state === 'stale') return ar ? 'حلقة العامل قديمة' : 'Loop stale';
  return ar ? 'حلقة العامل لم تبدأ' : 'Loop not started';
}

function usePanelLocale() {
	const [locale, setLocale] = useState<'en' | 'ar'>('en');
	useEffect(() => {
		if (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar')) setLocale('ar');
	}, []);
	return { locale, ar: locale === 'ar' };
}

interface SupplyContinuityPanelProps {
  status?: MediaSupplyStatusResponse;
  episodes?: MediaSupplyEpisodeListResponse;
  loading: boolean;
  statusError?: Error | null;
  episodesError?: Error | null;
  onInspectRequest?: (requestID: string) => void;
}

/**
 * Each segment names one CMS-owned boundary. Recovery uses the exact eligible
 * descriptor, reviewable preview, and approval supplied by CMS.
 */
export function SupplyContinuityPanel({
  status,
  episodes,
  loading,
  statusError,
  episodesError,
  onInspectRequest,
}: SupplyContinuityPanelProps) {
	const { locale, ar } = usePanelLocale();
  const [episodeCursor, setEpisodeCursor] = useState('');
  const [episodePrevious, setEpisodePrevious] = useState<string[]>([]);
  const [selectedEpisodeID, setSelectedEpisodeID] = useState<string | null>(null);
  const episodePage = useMediaSupplyEpisodes(8, episodeCursor, Boolean(episodeCursor));
  const displayedEpisodes = episodeCursor ? episodePage.data : episodes;

  if (loading && !status) {
    return <SupplySkeleton ar={ar} />;
  }
  if (!status) {
    return (
      <section
        className="rounded-xl border border-dashed border-border bg-card/40 p-4"
        aria-labelledby="supply-continuity-title"
      >
        <p className="brand-overline text-muted-foreground">
          {ar ? 'استمرارية الإمداد' : 'Supply continuity'}
        </p>
        <h2
          id="supply-continuity-title"
          className="mt-1 text-base font-semibold"
        >
          {ar ? 'أدلة إمداد CMS غير متاحة' : 'CMS supply evidence is unavailable'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {statusError?.message || (ar
			? 'تعذّر على Console التحقق من حمولة استمرارية الإمداد من CMS، لذلك لن يستنتج حالة للمصدر أو التسليم.'
            : 'The Console could not validate the CMS Supply Continuity payload. No source or delivery state is inferred.')}
        </p>
      </section>
    );
  }

  const evaluation = status.supply_evaluation;
  const meta = verdictMeta(evaluation.verdict, ar);
  const Icon = meta.icon;
  const attentionEpisodes = displayedEpisodes?.items ?? [];
	const openEpisode = attentionEpisodes.find((episode) => episode.id === selectedEpisodeID) ?? attentionEpisodes.find((episode) => episode.state !== 'resolved') ?? attentionEpisodes[0];
  const evaluator = status.evaluator;
  const operational = status.operational;

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="supply-continuity-title"
	  lang={locale}
	  dir={ar ? 'rtl' : 'ltr'}
    >
      <div className="border-b border-border/70 bg-gradient-to-r from-amber-500/[0.07] via-transparent to-sky-500/[0.08] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="brand-overline text-muted-foreground">
              {ar ? 'استمرارية الإمداد · أدلة CMS' : 'Supply continuity · CMS evidence'}
            </p>
            <h2
              id="supply-continuity-title"
              className="mt-1 text-lg font-semibold tracking-tight"
            >
              {ar ? 'أين يتوقف إمداد Pods الجديد' : 'Where new Pods supply stops'}
            </h2>
            <p
              className="mt-1 text-sm leading-6 text-muted-foreground"
              dir="auto"
            >
              {evaluation.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('gap-1 border px-2 py-1', meta.className)}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
            <Badge
              variant="outline"
              className="border-border bg-background/70 text-muted-foreground"
            >
              {completenessLabel(evaluation.evidence_completeness, ar)}
            </Badge>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{ar ? 'المالك:' : 'Owner:'} <bdi dir="ltr">{evaluation.owner}</bdi></span>
          <span>{ar ? 'رُصد' : 'Observed'} {formatRelativeTime(evaluation.evaluated_at)}</span>
          <span className="[direction:ltr]">
            {ar ? 'الحد:' : 'Boundary:'} {evaluation.headline_boundary}
          </span>
        </div>

        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs',
            evaluatorTone(evaluator.recording_enabled, evaluator.worker_state)
          )}
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            <ScanLine className="h-3.5 w-3.5" />
            {ar ? 'مقيّم CMS' : 'CMS evaluator'} · {evaluatorLabel(evaluator.recording_enabled, ar)} · {workerLabel(evaluator.worker_state, ar)}
          </span>
          {evaluator.worker_last_heartbeat_at ? (
            <span className="text-muted-foreground">
              {ar ? 'نبضة الحلقة' : 'Loop heartbeat'} {formatRelativeTime(evaluator.worker_last_heartbeat_at)}
            </span>
          ) : null}
          {evaluator.last_observed_at ? (
            <span className="text-muted-foreground">
              {ar ? 'آخر نقطة تحقق' : 'Last checkpoint'} {formatRelativeTime(evaluator.last_observed_at)}
            </span>
          ) : (
            <span className="text-muted-foreground">{ar ? 'لا توجد نقطة تحقق دائمة بعد' : 'No durable checkpoint yet'}</span>
          )}
          {evaluator.last_outcome ? (
            <span className="[direction:ltr] text-muted-foreground">
              {ar ? 'النتيجة:' : 'Outcome:'} {evaluator.last_outcome.replaceAll('_', ' ')}
            </span>
          ) : null}
          {evaluator.evaluation_digest ? (
            <span className="[direction:ltr] text-muted-foreground">
              {ar ? 'الإثبات' : 'Proof'} {evaluator.evaluation_digest.slice(0, 10)}
            </span>
          ) : null}
        </div>
        {evaluator.unknowns.length > 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground" dir="auto">
            {evaluator.unknowns.join(' ')}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" dir={ar ? 'rtl' : 'ltr'}>
          <span className="font-medium">{ar ? 'حالة العمل:' : 'Operational:'} {operational.state === 'ready' ? (ar ? 'جاهزة' : 'ready') : operational.state === 'attention' ? (ar ? 'تحتاج انتباهاً' : 'attention') : (ar ? 'متدهورة' : 'degraded')}</span>
          <span>{ar ? 'المُعلّق:' : 'Pending:'} {operational.backlogs.projection_pending ?? 0} {ar ? 'إسقاط ·' : 'projection ·'} {operational.backlogs.retained_receipts ?? 0} {ar ? 'إيصالات محتجزة' : 'retained receipts'}</span>
          <span>{ar ? 'حلقات مفتوحة:' : 'Open episodes:'} {operational.backlogs.episodes_open ?? 0}</span>
          {Object.values(operational.workers).some((worker) => worker === 'stale') ? <span className="text-amber-700 dark:text-amber-300">{ar ? 'نبضة عامل CMS متقادمة' : 'A CMS worker heartbeat is stale'}</span> : null}
		  {Object.entries(operational.owners).filter(([, owner]) => owner.state !== 'ready').map(([owner, readiness]) => <span key={owner} className="text-amber-700 dark:text-amber-300">{ar ? 'مالك الإجراء غير متاح:' : 'Action owner unavailable:'} <bdi dir="ltr">{owner}</bdi>{readiness.detail ? <> · <span dir="auto">{readiness.detail}</span></> : null}</span>)}
        </div>
        {operational.unknowns.length > 0 ? <p className="mt-1 text-xs text-muted-foreground" dir="auto">{operational.unknowns.join(' ')}</p> : null}
		{operational.metrics.samples.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5" aria-label={ar ? 'مقاييس تشغيل استمرارية الإمداد' : 'Supply continuity operational metrics'}>{operational.metrics.samples.slice(0, 8).map((sample) => <Badge key={`${sample.name}:${sample.owner}:${sample.stage}`} variant="outline"><span>{sample.name.replaceAll('_', ' ')}</span>&nbsp;<bdi dir="ltr">{sample.value.toFixed(sample.unit === 'seconds' ? 0 : 0)} {sample.unit === 'seconds' ? 's' : ''}</bdi></Badge>)}</div> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <OperatorLaunchLink
            context={supplyOperatorContext(openEpisode?.id)}
            intent="resolve"
            size="sm"
            className="border-amber-500/30 bg-background/70 hover:bg-amber-500/[0.08]"
          >
            {ar ? 'تحقيق في Operator' : 'Investigate in Operator'}
          </OperatorLaunchLink>
          <p className="text-xs text-muted-foreground">
            {ar ? 'يعيد Operator قراءة أدلة CMS قبل عرض أي إجراء موقّع.' : 'Operator re-reads CMS evidence before it can offer any signed action.'}
          </p>
        </div>
      </div>

      <div className="grid divide-y divide-border/70 lg:grid-cols-[1.2fr_0.8fr] lg:divide-x lg:divide-y-0">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {ar ? 'سلسلة الإثبات' : 'Proof spine'}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <ProofSegment
              icon={RadioTower}
              label={ar ? 'قبول CMS' : 'CMS admission'}
              value={evaluation.counts.due_unadmitted}
              detail={ar ? 'مستحق بلا تشغيل نشط' : 'Due with no active run'}
              tone="amber"
            />
            <ProofSegment
              icon={DatabaseZap}
              label={ar ? 'أدلة تشغيل المصدر' : 'Source-run evidence'}
              value={evaluation.counts.in_flight}
              detail={ar ? 'تشغيلات قيد التنفيذ' : 'Runs currently in flight'}
              tone="sky"
            />
            <ProofSegment
              icon={Eye}
              label={ar ? 'تسليم Pods' : 'Pods delivery'}
              value={evaluation.counts.delivery_verified}
              detail={ar ? `${evaluation.counts.delivery_pending} قيد الرصد · ${evaluation.counts.delivery_degraded} متدهور` : `${evaluation.counts.delivery_pending} observing · ${evaluation.counts.delivery_degraded} degraded`}
              tone="emerald"
            />
          </div>

		  <div className="mt-3 rounded-lg border border-border/70 bg-muted/25 p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
			  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{ar ? 'إثبات الظهور' : 'Exposure proof'}</p>
			  <Badge variant="outline">{status.exposure.verdict.replaceAll('_', ' ')}</Badge>
			</div>
			<div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
			  <span>{ar ? 'مؤهل' : 'Eligible'} <b>{status.exposure.base_eligible_count}</b></span>
			  <span>{ar ? 'قابل للوصول' : 'Reachable'} <b>{status.exposure.reachable_count}</b></span>
			  <span>{ar ? 'مُرجع' : 'Returned'} <b>{status.exposure.returned_count}</b></span>
			  <span>{ar ? 'فريد' : 'Distinct'} <b>{status.exposure.distinct_returned_count}</b></span>
			</div>
			<p className="mt-2 text-xs text-muted-foreground" dir="auto">{ar ? 'أحدث عنصر قابل للوصول' : 'Newest reachable'} {status.exposure.newest_reachable_at ? formatRelativeTime(status.exposure.newest_reachable_at) : (ar ? 'غير معروف' : 'unknown')} · {ar ? 'أحدث عنصر مُرجع' : 'Newest returned'} {status.exposure.newest_returned_at ? formatRelativeTime(status.exposure.newest_returned_at) : (ar ? 'غير معروف' : 'unknown')} · {ar ? 'عرض' : 'render'} {status.exposure.last_feed_rendered_at ? formatRelativeTime(status.exposure.last_feed_rendered_at) : (ar ? 'غير معروف' : 'unknown')} · {ar ? 'مشاهدة دقيقة' : 'exact view'} {status.exposure.last_exact_view_at ? formatRelativeTime(status.exposure.last_exact_view_at) : (ar ? 'غير معروف' : 'unknown')}</p>
		  </div>

          {evaluation.unknowns.length > 0 ? (
            <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
                {ar ? 'ما لا يستطيع CMS إثباته' : 'What CMS cannot prove'}
              </p>
              <ul
                className="mt-1.5 space-y-1 text-sm text-muted-foreground"
                dir="auto"
              >
                {evaluation.unknowns.map((unknown) => (
                  <li key={unknown}>• {unknown}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {evaluation.affected_request_ids.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {ar ? 'تشغيلات المصدر المتأثرة' : 'Affected source runs'}
              </span>
              {evaluation.affected_request_ids.slice(0, 4).map((requestID) => (
                <Button
                  key={requestID}
                  variant="outline"
                  size="sm"
                  className="h-7 max-w-full gap-1 px-2 font-mono text-[11px] [direction:ltr]"
                  onClick={() => onInspectRequest?.(requestID)}
                  disabled={!onInspectRequest}
                >
                  {ar ? 'تتبّع' : 'Trace'} {requestID.slice(0, 8)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {ar ? 'تنبيهات دائمة' : 'Durable attention'}
            </p>
            {displayedEpisodes?.next_cursor ? (
              <span className="text-[11px] text-muted-foreground">
                {ar ? 'توجد حوادث أخرى' : 'More episodes available'}
              </span>
            ) : null}
          </div>
          {episodesError || episodePage.error ? (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {ar ? 'سجل الحوادث غير متاح؛ يبقى حكم CMS الحالي أعلاه مستقلاً.' : 'Episode history is unavailable; the current CMS verdict above remains separate.'}
            </p>
          ) : attentionEpisodes.length > 0 ? (
            <>
              <ul className="mt-2 divide-y divide-border/70">
                {attentionEpisodes.map((episode) => (
                  <SupplyEpisodeRow key={episode.id} episode={episode} ar={ar} selected={episode.id === openEpisode?.id} onSelect={() => setSelectedEpisodeID(episode.id)} />
                ))}
              </ul>
              {openEpisode ? <SupplyActionLifecycle key={openEpisode.id} episode={openEpisode} locale={locale} /> : null}
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {ar ? 'لا توجد حوادث إمداد دائمة مفتوحة أو مسجلة بعد.' : 'No durable Supply attention episodes are open or recorded yet.'}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {episodePrevious.length ? <Button size="sm" variant="outline" onClick={() => { const previous = [...episodePrevious]; setEpisodeCursor(previous.pop() ?? ''); setEpisodePrevious(previous); setSelectedEpisodeID(null); }}>{ar ? 'السابق' : 'Previous episodes'}</Button> : null}
            {displayedEpisodes?.next_cursor ? <Button size="sm" variant="outline" disabled={episodePage.isFetching} onClick={() => { setEpisodePrevious((old) => [...old, episodeCursor]); setEpisodeCursor(displayedEpisodes.next_cursor); setSelectedEpisodeID(null); }}>{ar ? 'حوادث أخرى' : 'More episodes'}</Button> : null}
          </div>
          {episodePage.isFetching ? <p role="status" className="mt-2 text-xs text-muted-foreground">{ar ? 'جارٍ تحميل الحوادث…' : 'Loading episodes…'}</p> : null}
        </div>
      </div>
	  <SupplyQualificationCard ar={ar} />
    </section>
  );
}

function SupplyEpisodeRow({ episode, ar, selected, onSelect }: { episode: MediaSupplyEpisode; ar: boolean; selected: boolean; onSelect: () => void }) {
  const episodeMeta = verdictMeta(episode.verdict, ar);
  const isResolved = episode.state === 'resolved';
  return (
    <li className="py-3 first:pt-1 last:pb-0">
      <button type="button" aria-pressed={selected} onClick={onSelect} className="flex w-full items-start justify-between gap-2 rounded-sm p-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className={cn('text-sm font-medium leading-5', selected && 'underline underline-offset-4')} dir="auto">{episode.summary}</span>
        <span
          className={cn(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            isResolved ? 'bg-emerald-500' : episodeMeta.className.includes('rose') ? 'bg-rose-500' : episodeMeta.className.includes('amber') ? 'bg-amber-500' : 'bg-violet-500'
          )}
          aria-label={episode.severity}
        />
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        {isResolved && episode.resolved_at ? `${ar ? 'استرداد متحقق' : 'Verified recovery'} · ${formatRelativeTime(episode.resolved_at)}` : `${episode.owner} · ${ar ? 'آخر رصد' : 'last seen'} ${formatRelativeTime(episode.last_seen_at)}`}
      </p>
    </li>
  );
}

// This component accepts only an immutable episode ID. It never takes a
// target, queue name, provider argument, or action key from the page; all of
// those values arrive in a CMS-validated eligibility descriptor.
export function SupplyActionLifecycle({ episode, locale }: { episode: MediaSupplyEpisode; locale: 'en' | 'ar' }) {
  const eligible = useMediaSupplyEligibleActions(episode.id);
  const previewAction = useCreateMediaSupplyActionPreview();
  const confirmAction = useConfirmMediaSupplyActionPreview();
  const cancelAction = useCancelMediaSupplyAction();
  const [preview, setPreview] = useState<(MediaSupplyActionPreview & { execution_owner: string }) | null>(null);
  const previewID = preview?.id ?? null;
  const [previewNow, setPreviewNow] = useState(Date.now());
  const [historyCursor, setHistoryCursor] = useState('');
  const [historyPrevious, setHistoryPrevious] = useState<string[]>([]);
  const history = useMediaSupplyActionHistory(episode.id, historyCursor);
  const restored = useRef(false);
  const [actionID, setActionID] = useState<string | null>(null);
  const action = useMediaSupplyAction(actionID);
  const actionIsLive = !action.data || ['queued', 'claimed', 'running', 'verifying', 'uncertain'].includes(action.data.state);
  const events = useMediaSupplyActionEvents(actionID, actionIsLive);

  useEffect(() => {
    if (!history.data || restored.current) return;
    restored.current = true;
    if (history.data.items[0]) setActionID(history.data.items[0].id);
  }, [history.data]);
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => setPreviewNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [preview]);
  const previewExpired = Boolean(preview && Date.parse(preview.expires_at) <= previewNow);

  const installed = eligible.data?.items.filter((candidate) => !candidate.manual_only && !candidate.disabled) ?? [];
  const disabled = eligible.data?.items.filter((candidate) => !candidate.manual_only && candidate.disabled) ?? [];
  const busy = previewAction.isPending || confirmAction.isPending || cancelAction.isPending;
  const state = action.data?.state;
  const mayCancel = state === 'queued' || state === 'claimed' || state === 'running';
  const mutationError = previewAction.error ?? confirmAction.error ?? cancelAction.error;
	const ar = locale === 'ar';


  return (
    <div className="mt-4 border-t border-border/70 pt-3" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{ar ? 'استرداد موقّع' : 'Signed recovery'}</p>
      {eligible.isLoading ? <p className="mt-2 text-xs text-muted-foreground">{ar ? 'جارٍ التحقق من أهلية إجراء CMS…' : 'Checking CMS action eligibility…'}</p> : null}
      {eligible.error ? <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">{ar ? 'تعذّر على CMS التحقق من أهلية الاسترداد. تبقى الأدلة للقراءة فقط.' : 'CMS could not validate recovery eligibility. Evidence remains read-only.'}</p> : null}
      {!eligible.isLoading && !eligible.error && installed.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">{ar ? 'لا يوجد استرداد آمن من CMS مؤهل حالياً. يبقى العمل اليدوي في مساره الأصلي.' : 'No safe CMS-native recovery is currently eligible. Manual-only work stays in its native workflow.'}</p> : null}
	  {disabled.map((candidate) => <p key={candidate.id} className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-xs text-amber-800 dark:text-amber-200" dir="auto">{ar ? `الإجراء ${candidate.key} معطّل بواسطة عنصر تحكم CMS: ${candidate.disabled_control ?? 'غير معروف'}.` : `${candidate.key} is disabled by the CMS control ${candidate.disabled_control ?? 'unknown'}.`}</p>)}
      {installed.length > 0 && !previewID && !actionID ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {installed.map((candidate) => (
            <Button key={candidate.id} size="sm" variant="outline" disabled={busy} onClick={() => previewAction.mutate({ key: candidate.key, episodeID: episode.id, eligibilityID: candidate.id }, { onSuccess: (result) => { setPreviewNow(Date.now()); setPreview({ ...result, execution_owner: candidate.execution_owner }); } })}>
						{ar ? 'معاينة' : 'Preview'} {supplyActionLabel(candidate.key, ar)}
            </Button>
          ))}
        </div>
      ) : null}
      {preview && !actionID ? (
        <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs">
          <p dir="auto">{ar ? 'ثبّت CMS معاينة الاسترداد ذات الهدف الواحد. يؤدّي التأكيد إلى وضع إجراء دائم في CMS في الطابور؛ ولا يصل المتصفح إلى أي طابور.' : 'CMS froze this one-target recovery preview. Confirming queues a durable CMS action; it does not access a queue from this browser.'}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{ar ? 'الإجراء' : 'Action'}</dt><dd>{supplyActionLabel(preview.action_key, ar)}</dd></div>
            <div><dt className="text-muted-foreground">{ar ? 'المالك' : 'Owner'}</dt><dd><bdi dir="ltr">{preview.execution_owner}</bdi></dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">{ar ? 'الهدف المحدد' : 'Exact target'}</dt><dd className="break-all"><bdi dir="ltr">{preview.target_type}: {preview.target_id}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{ar ? 'انتهاء المعاينة' : 'Preview expires'}</dt><dd><time dateTime={preview.expires_at}>{new Date(preview.expires_at).toLocaleString(ar ? 'ar-SA' : 'en-GB')}</time></dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">{ar ? 'الأثر المتوقع' : 'Expected effect'}</dt><dd dir="auto">{String(preview.planned_effects.verification ?? preview.planned_effects.expected_effect ?? supplyActionLabel(preview.action_key, ar))}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">{ar ? 'بصمة الأدلة' : 'Evidence digest'}</dt><dd className="break-all"><bdi dir="ltr">{preview.evidence_digest}</bdi></dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">{ar ? 'بصمة السياسة' : 'Policy digest'}</dt><dd className="break-all"><bdi dir="ltr">{preview.policy_digest}</bdi></dd></div>
          </dl>
          {preview.deep_links.map((href) => <Link key={href} href={href} className="mt-2 inline-flex underline underline-offset-2">{ar ? 'فتح الدليل الأصلي' : 'Open native evidence'}</Link>)}
          {previewExpired ? <p role="status" className="mt-2">{ar ? 'انتهت المعاينة؛ اطلب معاينة جديدة.' : 'Preview expired; request a fresh preview.'}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={busy || previewExpired} onClick={() => confirmAction.mutate(preview.id, { onSuccess: (request) => setActionID(request.id) })}>{ar ? 'تأكيد ووضع في الطابور' : 'Confirm and queue'}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPreview(null)}>{ar ? 'إلغاء المعاينة' : 'Discard preview'}</Button>
          </div>
        </div>
      ) : null}
      {actionID ? (
        <div className="mt-2 rounded-lg border border-sky-500/25 bg-sky-500/[0.05] p-3 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-medium">{state ? supplyActionStateLabel(state, ar) : (ar ? 'جارٍ تحميل دورة الحياة' : 'Loading lifecycle')}</p><p className="mt-1 text-muted-foreground" dir="ltr">{actionID}</p></div>
            {mayCancel ? <Button size="sm" variant="outline" disabled={busy} onClick={() => cancelAction.mutate(actionID)}>{ar ? 'إلغاء بأمان' : 'Cancel safely'}</Button> : null}
          </div>
          {action.error ? <p className="mt-2 text-amber-700">{ar ? 'حالة إجراء CMS غير متاحة. يستمر الإجراء الدائم باستقلالية.' : 'CMS action status is unavailable. The durable action continues independently.'}</p> : null}
          {events.data?.events.length ? <p className="mt-2 text-muted-foreground" dir="auto">{ar ? 'دورة الحياة:' : 'Lifecycle:'} {events.data.events.slice(-4).map((event) => event.event_type.replaceAll('_', ' ')).join(' · ')}</p> : null}
          {action.data?.verified_effects ? <div className="mt-3 space-y-2 rounded border border-emerald-500/25 bg-emerald-500/[0.05] p-3">
			<p className="font-medium text-emerald-800 dark:text-emerald-200">{ar ? 'آثار متحقق منها من CMS' : 'CMS-verified effects'}</p>
			<div className="flex flex-wrap gap-1.5">{action.data.verified_effects.affected_domains.map((domain) => <Badge key={domain} variant="outline"><bdi dir="ltr">{domain}</bdi></Badge>)}</div>
			{action.data.verified_effects.affected_subjects.length ? <div><p className="text-muted-foreground">{ar ? 'السجلات المتأثرة' : 'Affected records'}</p><div className="mt-1 flex flex-wrap gap-1.5">{action.data.verified_effects.affected_subjects.map((subject) => <Badge key={`${subject.type}:${subject.id}`} variant="outline"><bdi dir="ltr">{subject.type}:{subject.id}</bdi></Badge>)}</div></div> : null}
			{action.data.verified_effects.deep_links.map((href) => <Link key={href} href={href} className="inline-flex underline underline-offset-2">{ar ? 'فتح الدليل الأصلي' : 'Open native evidence'}</Link>)}
			<details><summary className="cursor-pointer text-muted-foreground">{ar ? 'إثبات المدقق' : 'Verifier proof'}</summary><pre className="mt-1 overflow-x-auto rounded bg-background/70 p-2 text-[10px] leading-4" dir="ltr">{JSON.stringify(action.data.verified_effects.proof, null, 2)}</pre></details>
		  </div> : null}
        </div>
      ) : null}
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="font-medium">{ar ? 'سجل الإجراءات الدائم' : 'Persisted action history'}</p>
        {history.isLoading ? <p role="status">{ar ? 'جارٍ تحميل السجل…' : 'Loading history…'}</p> : null}
        {history.error ? <p role="alert">{ar ? 'تعذّر تحميل سجل CMS. حدّث الصفحة لإعادة المحاولة.' : 'CMS action history is unavailable. Refresh to retry.'}</p> : null}
        {history.data?.items.map((record) => <button type="button" key={record.id} aria-pressed={record.id === actionID} className="mt-2 block w-full rounded-sm border border-border p-2 text-start focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setPreview(null); setActionID(record.id); }}><span>{supplyActionLabel(record.action_key, ar)} · {supplyActionStateLabel(record.state, ar)}</span><span className="mt-1 block break-all text-muted-foreground" dir="ltr">{record.id}</span></button>)}
        <div className="mt-2 flex flex-wrap gap-2">
          {historyPrevious.length ? <Button size="sm" variant="outline" onClick={() => { const previous = [...historyPrevious]; setHistoryCursor(previous.pop() ?? ''); setHistoryPrevious(previous); }}>{ar ? 'السجل السابق' : 'Previous actions'}</Button> : null}
          {history.data?.next_cursor ? <Button size="sm" variant="outline" onClick={() => { setHistoryPrevious((old) => [...old, historyCursor]); setHistoryCursor(history.data!.next_cursor); }}>{ar ? 'إجراءات أخرى' : 'More actions'}</Button> : null}
          {actionID && !actionIsLive && installed.length > 0 ? <Button size="sm" variant="outline" onClick={() => { setActionID(null); setPreview(null); }}>{ar ? 'معاينة استرداد جديد' : 'Preview new recovery'}</Button> : null}
        </div>
      </div>
      {mutationError ? <p className="mt-2 text-xs text-amber-700">{mutationError.message}</p> : null}
    </div>
  );
}

function supplyActionLabel(key: string, ar: boolean): string {
	const labels: Record<string, readonly [string, string]> = {
		'source_run.repair_missed_admission': ['Repair missed admission', 'إصلاح قبول المصدر الفائت'],
		'source_run.reclaim_dispatch_claim': ['Reclaim expired dispatch', 'استعادة إرسال منتهي الصلاحية'],
		'source_run.transfer_execution_unit_lease': ['Release expired unit lease', 'تحرير عقدة تنفيذ منتهية'],
		'source_run.adopt_unit_job': ['Adopt stranded coordinator', 'تبنّي منسّق عالق'],
		'source_run.redeliver_receipt': ['Redeliver retained receipt', 'إعادة تسليم إيصال محفوظ'],
		'source_run.verify_effect': ['Request verification', 'طلب التحقق'],
		'source_run.finalize_verified_no_change': ['Finalize verified no-change', 'إنهاء نتيجة بلا تغيير متحقق منها'],
		'source_run.cancel_unstarted': ['Cancel unstarted unit', 'إلغاء وحدة لم تبدأ'],
		'pipeline.resume_exact_stage': ['Resume verified exact stage', 'استئناف المرحلة الدقيقة المتحققة'],
		'artifact.request_transcript': ['Recover missing transcript', 'استرداد النص المفرغ المفقود'],
		'artifact.request_image_embedding': ['Recover image embedding', 'استرداد تضمين الصورة'],
		'artifact.request_text_embedding': ['Recover text embedding', 'استرداد تضمين النص'],
		'artifact.request_llm_metadata': ['Recover summary metadata', 'استرداد بيانات الملخص'],
		'atomization.execute_exact_parent': ['Atomize exact long parent', 'تجزئة الأصل الطويل المحدد'],
		'studio.clear_exact_children': ['Verify exact Studio clearance', 'التحقق من اعتماد Studio الدقيق'],
		'feed_generation.attach_verified_member': ['Attach verified feed member', 'إلحاق عنصر موثّق بالجيل النشط'],
	};
	const label = labels[key];
	return label ? label[ar ? 1 : 0] : (ar ? 'إجراء استرداد مسجّل' : 'Registered recovery action');
}

function supplyActionStateLabel(state: string, ar: boolean): string {
	const labels: Record<string, readonly [string, string]> = {
		queued: ['Queued', 'في الطابور'], claimed: ['Claimed', 'تم الاستلام'], running: ['Running', 'قيد التنفيذ'],
		verifying: ['Verifying effects', 'جارٍ التحقق من الآثار'], uncertain: ['Effect uncertain; verification continues', 'الأثر غير مؤكد؛ يستمر التحقق'],
		succeeded: ['Succeeded and verified', 'نجح وتم التحقق'], failed: ['Failed', 'فشل'], cancelled: ['Cancelled', 'أُلغي'],
	};
	return labels[state]?.[ar ? 1 : 0] ?? state.replaceAll('_', ' ');
}

function SupplyQualificationCard({ ar }: { ar: boolean }) {
	const qualification = useMediaSupplyQualificationState();
	if (qualification.isLoading) {
		return <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">{ar ? 'جارٍ تحميل حالة تأهيل Safe Auto…' : 'Loading Safe Auto qualification state…'}</div>;
	}
	if (!qualification.data) {
		return <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">{ar ? 'تعذّر التحقق من حالة التأهيل. يبقى Safe Auto معطلاً افتراضياً.' : 'Qualification state could not be verified. Safe Auto remains disabled by default.'}</div>;
	}
	const active = qualification.data.promotions.filter((promotion) => promotion.state === 'active').length;
	const sealed = qualification.data.reports.filter((report) => report.state === 'sealed').length;
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 text-xs">
			<div>
				<p className="font-medium">{ar ? 'تأهيل Safe Auto لكل إجراء' : 'Per-action Safe Auto qualification'}</p>
				<p className="mt-0.5 text-muted-foreground">{ar ? 'الافتراضي معطّل؛ ولا يمنح التقرير صلاحية إلا لمفتاح الإجراء الذي تم تأهيله.' : 'Default is disabled; a sealed report can authorize only its qualified action key.'}</p>
			</div>
			<div className="flex gap-2">
				<Badge variant="outline">{ar ? 'تقارير مختومة' : 'Sealed reports'} {sealed}</Badge>
				<Badge variant="outline">{ar ? 'ترقيات نشطة' : 'Active promotions'} {active}</Badge>
			</div>
		</div>
	);
}

function ProofSegment({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof RadioTower;
  label: string;
  value: number;
  detail: string;
  tone: 'amber' | 'sky' | 'emerald';
}) {
  const toneClass = {
    amber:
      'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    sky: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-700 dark:text-sky-300',
    emerald:
      'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
  }[tone];
  return (
    <div className={cn('rounded-lg border px-3 py-3', toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 opacity-80">{detail}</p>
    </div>
  );
}

function SupplySkeleton({ ar }: { ar: boolean }) {
  return (
    <section
      className="h-64 animate-pulse rounded-xl border border-border bg-muted/30"
      aria-label={ar ? 'جارٍ تحميل أدلة استمرارية الإمداد' : 'Loading Supply Continuity evidence'}
    />
  );
}
