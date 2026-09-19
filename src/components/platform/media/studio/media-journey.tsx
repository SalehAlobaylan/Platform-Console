'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock3, ExternalLink, Search, List, Columns3, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchJourney, fetchJourneyList, fetchJourneyPage, journeyKeys, type JourneyChapter, type JourneyEvent } from '@/lib/api/cms/media-journey';
import { journeyGuide, journeyLane, journeyNextAction, journeyReason, journeyState, journeyStepSummary, journeyActionLabels, type JourneyLocale } from '@/lib/studio/journey-guide';
import type { AtomizationFilters, MediaAtomizationPipelineItem } from '@/types/platform/media-atomization';

export function useJourneyLocale(): JourneyLocale {
    const [locale, setLocale] = useState<JourneyLocale>('en');
    useEffect(() => { setLocale(document.documentElement.lang.startsWith('ar') ? 'ar' : 'en'); }, []);
    return locale;
}

export function MediaJourneyGuide() {
    const params = useSearchParams(); const router = useRouter(); const pathname = usePathname(); const locale = useJourneyLocale();
    const section = params.get('guide');
    const change = (key?: string) => { const next = new URLSearchParams(params.toString()); if (key) next.set('guide', key); else next.delete('guide'); router.replace(`${pathname}?${next}`, { scroll: false }); };
    return <>
        <Button variant="outline" size="sm" onClick={() => change('discovery')}>{locale === 'ar' ? 'كيف تعمل رحلة الوسائط؟' : 'How the media journey works'}</Button>
        <Dialog open={Boolean(section)} onOpenChange={open => { if (!open) change(); }}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader><DialogTitle>{locale === 'ar' ? 'دليل رحلة الوسائط' : 'Media journey guide'}</DialogTitle></DialogHeader>
                <nav className="flex flex-wrap gap-2" aria-label="Guide steps">{Object.entries(journeyGuide).map(([key, value]) => <Button key={key} size="sm" variant={key === section ? 'default' : 'outline'} onClick={() => change(key)}>{value[locale].title}</Button>)}</nav>
                {(() => { const help = (journeyGuide[section ?? ''] ?? journeyGuide.discovery)[locale]; return <section className="space-y-4"><h2 className="text-lg font-semibold">{help.title}</h2>{(['happens', 'waits', 'action', 'next'] as const).map((key, index) => <div key={key}><h3 className="font-medium">{(locale === 'ar' ? ['ما الذي يحدث؟', 'لماذا قد ينتظر؟', 'ما الذي يمكنك فعله؟', 'ما الخطوة التالية؟'] : ['What happens', 'Why it may wait', 'What you can do', 'What happens next'])[index]}</h3><p className="mt-1 text-sm text-muted-foreground">{help[key]}</p></div>)}</section>; })()}
            </DialogContent>
        </Dialog>
    </>;
}

export function PageEvidence({ id, section }: { id: string; section: 'chapters' | 'events' }) {
    const locale = useJourneyLocale(); const ar = locale === 'ar';
    const query = useInfiniteQuery({ queryKey: [...journeyKeys.detail(id), section], queryFn: ({ pageParam }) => fetchJourneyPage<JourneyChapter & JourneyEvent>(id, section, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.next_cursor || undefined, staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
    return <div className="space-y-3">
        {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message}{query.data && ` · ${ar ? 'آخر تحديث ناجح' : 'Last successful snapshot'}: ${new Date(query.dataUpdatedAt).toLocaleTimeString()}`}</p>}
        {query.isPending && <p>{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>}
        {query.data?.pages.flatMap(page => page.items).map(item => section === 'chapters' ? <article key={item.id} className="space-y-2 rounded-md border p-3">
            <h4 dir="auto" className="font-medium">{item.unit_index + 1}. {item.title}</h4>
            <p className="text-sm text-muted-foreground">{Math.round(item.start_ms / 1000)}s–{Math.round(item.end_ms / 1000)}s · {journeyState(item.state, locale)} · {item.feed_visibility ?? (ar ? 'لم ينتج مقطع بعد' : 'No child yet')}</p>
            {item.failure_class && <><p className="break-words text-sm text-destructive">{item.failure_class}</p><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{ar ? 'الإجراء التالي' : 'Next action'}:</span> {journeyNextAction(item.failure_class, locale, item.stage)}</p></>}
            <p className="text-sm text-muted-foreground">{item.ready_for_activation && item.feed_visibility !== 'visible' ? (ar ? 'جاهز للتفعيل؛ ينتظر فحوص بقية الفصول أو الإصدار الكامل.' : 'Ready for activation; waiting for sibling or complete-generation checks.') : `${ar ? 'المراجعة' : 'Review'}: ${item.review_status ?? (ar ? 'لم يصل إليها' : 'not reached')}`}</p>
            {item.child_id && <Link className="text-sm underline" href={`/platform/media/atomization?tab=studio&item=${id}&chapter=${item.child_id}`}>{ar ? 'معاينة الفصل وفحصه' : 'Preview and inspect chapter'}</Link>}
            {!!item.requirements?.length && <ul className="space-y-1 text-xs text-muted-foreground">{item.requirements.map(requirement => <li key={requirement.stage}>{requirement.stage} · {journeyState(requirement.state, locale)}{!requirement.required && ` · ${ar ? 'اختياري' : 'optional'}`}{requirement.failure_class && ` · ${requirement.failure_class}`}</li>)}</ul>}
        </article> : <p key={item.sequence} className="break-words border-b pb-2 text-xs">{new Date(item.created_at).toLocaleString()} · {ar ? 'الإصدار' : 'Generation'} {item.processing_generation} · {item.stage} · {item.event_type}</p>)}
        {query.hasNextPage && <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{ar ? 'تحميل المزيد' : 'Load more'}</Button>}
    </div>;
}

export function useEpisodeJourney(id: string) {
    return useQuery({ queryKey: journeyKeys.detail(id), queryFn: () => fetchJourney(id), refetchInterval: q => q.state.data?.steps.some(s => s.state === 'running' || s.state === 'queued') ? 5_000 : q.state.data?.steps.find(s => s.key === 'published')?.state === 'completed' ? 60_000 : 30_000, refetchIntervalInBackground: false, staleTime: 5_000 });
}

export function EpisodeJourney({ id, actions }: { id: string; actions?: (item: MediaAtomizationPipelineItem) => React.ReactNode }) {
    const locale = useJourneyLocale(); const params = useSearchParams(); const pathname = usePathname();
    const [chaptersOpen, setChaptersOpen] = useState(false); const [historyOpen, setHistoryOpen] = useState(false);
    const query = useEpisodeJourney(id);
    const data = query.data;
    const currentStep = data?.steps.find(step => ['running', 'failed', 'reconciling'].includes(step.state)) ?? data?.steps.find(step => step.required && !['completed', 'not_required'].includes(step.state));
    return <section className="min-w-0 space-y-4 rounded-md border bg-card p-4" aria-label="Episode journey" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {query.isPending && <p>Loading episode journey…</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message}{data ? ` · Showing the last successful snapshot (${new Date(query.dataUpdatedAt).toLocaleTimeString()})` : ''}</p>}
        {data && <>
            {data.progress_unavailable && <p role="status" className="text-sm text-muted-foreground">{locale === 'ar' ? 'تفاصيل توقيت التقدم غير متاحة مؤقتاً. هذا لا يعني توقف العمل، وتبقى الإجراءات الصالحة متاحة.' : 'Progress timing is temporarily unavailable. This does not mean work stopped; valid actions remain available.'}</p>}
            <header className="flex items-start justify-between gap-3 border-b pb-4"><div className="min-w-0"><h2 className="text-lg font-semibold leading-snug" dir="auto">{data.parent.title}</h2><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatEpisodeDuration(data.parent.duration_sec)} · {locale === 'ar' ? 'تحديث' : 'Updated'} {new Date(query.dataUpdatedAt).toLocaleTimeString()}</p></div><Link className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-2 text-xs text-primary" href={`${pathname}?tab=studio&item=${data.parent.id}`}>{locale === 'ar' ? 'فتح الحلقة' : 'Open episode'}<ExternalLink className="h-3.5 w-3.5" /></Link></header>
            <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">{locale === 'ar' ? 'إعدادات الحلقة ومصدر النص' : 'Episode settings and transcript source'}</summary><div className="space-y-2 pt-3">
            <p className="text-sm">{locale === 'ar' ? 'التنزيل' : 'Acquisition'}: {data.acquisition_mode} · {locale === 'ar' ? 'التفريغ المولّد' : 'Generated STT'}: {data.auto_stt_enabled ? 'automatic' : 'manual'}</p>
            <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'مصدر إعداد التنزيل' : 'Acquisition setting source'}: {data.acquisition_policy_source ?? 'unavailable'} · <Link className="underline" href="/platform/media/atomization?tab=policy">{locale === 'ar' ? 'السياسات' : 'Policies'}</Link></p>
            <p className="text-sm">{locale === 'ar' ? 'نتيجة جلب ترجمة المصدر' : 'Provider caption retrieval'}: {({ available: locale === 'ar' ? 'متاحة' : 'Available', unavailable: locale === 'ar' ? 'غير متاحة لدى المصدر' : 'Unavailable at provider', retrieval_failed: locale === 'ar' ? 'فشل الجلب؛ لا يعني غياب الترجمة' : 'Retrieval failed; this does not mean captions are absent' } as Record<string,string>)[data.caption_outcome ?? ''] ?? (locale === 'ar' ? 'لم يُفحص بعد أو لا توجد أدلة تاريخية' : 'Not checked yet or historical evidence unavailable')}</p>
            {data.transcript && <p className="text-sm">{locale === 'ar' ? 'النص' : 'Transcript'}: {data.transcript.verified ? (locale === 'ar' ? 'متحقق' : 'Verified') : (locale === 'ar' ? 'التحقق غير مثبت' : 'Verification not confirmed')} · {data.transcript.approved_at ? (locale === 'ar' ? 'معتمد للاستخدام' : 'Approved for use') : (locale === 'ar' ? 'دون اعتماد تحريري مسجل' : 'No recorded editorial approval')}</p>}
            <p className="text-sm text-muted-foreground">{data.transcript ? `${locale === 'ar' ? 'مصدر النص' : 'Transcript source'}: ${data.transcript.source ?? data.transcript.provider ?? 'Origin unavailable'}` : `${locale === 'ar' ? 'حالة ترجمة المصدر' : 'Provider caption evidence'}: ${data.caption_state ?? 'Not checked / evidence unavailable'}`}</p>
            </div></details>
            {data.capacity.waiting && <p className="text-sm">{journeyReason('shared_capacity', locale)} {data.capacity.episode_id && <Link className="underline" href={`${pathname}?tab=workflow&item=${data.capacity.episode_id}`}>{data.capacity.title}</Link>}</p>}
            {data.published_generation && data.candidate_generation?.id !== data.published_generation.id && <p className="rounded bg-muted p-2 text-sm">{locale === 'ar' ? 'يبقى الإصدار السابق منشوراً أثناء تجهيز البديل.' : 'The previous generation remains published while its replacement is prepared.'}</p>}
            <h3 className="text-sm font-semibold">{locale === 'ar' ? 'رحلة الوسائط' : 'Media journey'}</h3>
            <ol>{data.steps.map((step, index) => { const help = journeyGuide[step.key]?.[locale]; const next = new URLSearchParams(params.toString()); next.set('guide', step.key); const active = step === currentStep; const stamp = step.completed_at ?? step.last_progress_at; return <li key={step.key} aria-current={active ? 'step' : undefined} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-1.5 before:absolute before:bottom-[-6px] before:start-[13px] before:top-9 before:w-px before:bg-border last:before:hidden">
                <span className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground bg-card'}`}>{index + 1}</span>
                <div className="min-w-0 border-b pb-1.5"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><Link href={`${pathname}?${next}`} scroll={false} className="text-sm font-medium hover:underline">{help?.title ?? step.key}</Link><span className={`inline-flex items-center gap-1.5 text-xs ${step.state === 'completed' ? 'text-green-500' : step.state === 'failed' ? 'text-destructive' : active ? 'text-amber-500' : 'text-muted-foreground'}`}>{step.state === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : active ? <Clock3 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{journeyState(step.state, locale)}</span></div>
                <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{['waiting', 'failed', 'reconciling', 'queued', 'blocked'].includes(step.state) ? <><span>{journeyReason(step.reason_code, locale)}</span><span className="mt-1 block"><span className="font-medium text-foreground">{locale === 'ar' ? 'التالي' : 'Next'}:</span> {journeyNextAction(step.reason_code, locale, step.key)}</span></> : step.required ? journeyStepSummary[step.key]?.[locale === 'ar' ? 1 : 0] : (locale === 'ar' ? 'اختياري أو متجاوز' : 'Optional / bypassed')}</span><span className="shrink-0" title={stamp ? new Date(stamp).toLocaleString() : undefined}>{step.completed !== undefined ? `${step.completed}/${step.total} ${locale === 'ar' ? 'مقاطع متحققة' : 'cuts verified'}` : stamp ? new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</span></div>
                </div>
            </li>; })}</ol>
            {data.item && <div className="[&_button]:flex-1 [&_a]:flex-1">{actions?.(data.item)}</div>}
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{locale === 'ar' ? 'توقيتات الخطوات ومتطلباتها' : 'Step timing and dependencies'}</summary><dl className="mt-3 space-y-3">{data.steps.map(step => <div key={step.key}><dt className="font-medium">{journeyGuide[step.key]?.[locale].title ?? step.key} · {step.required ? (locale === 'ar' ? 'مطلوب' : 'Required') : (locale === 'ar' ? 'اختياري أو متجاوز' : 'Optional / bypassed')}</dt><dd>{locale === 'ar' ? 'بدأ' : 'Started'}: {step.started_at ? new Date(step.started_at).toLocaleString() : '—'} · {locale === 'ar' ? 'اكتمل' : 'Completed'}: {step.completed_at ? new Date(step.completed_at).toLocaleString() : '—'}</dd><dd>{locale === 'ar' ? 'آخر تقدم مؤكد' : 'Last confirmed progress'}: {step.last_progress_at ? new Date(step.last_progress_at).toLocaleString() : '—'}</dd>{!!step.depends_on?.length && <dd>{locale === 'ar' ? 'المتطلبات السابقة' : 'Depends on'}: {step.depends_on.map(key => journeyGuide[key]?.[locale].title ?? key).join(', ')}</dd>}</div>)}</dl></details>
            {data.steps.some(step => step.actions?.some(action => !action.enabled)) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{locale === 'ar' ? 'لماذا بعض الإجراءات غير متاحة؟' : 'Why are other actions unavailable?'}</summary><ul className="mt-2 space-y-2">{data.steps.flatMap(step => step.actions ?? []).filter(action => !action.enabled).map(action => <li key={`${action.step}-${action.code}`}>{journeyActionLabels[action.code]?.[locale === 'ar' ? 1 : 0] ?? action.code}: {journeyReason(action.reason_code ?? 'prerequisites_required', locale)}</li>)}</ul></details>}
            <details onToggle={e => setChaptersOpen(e.currentTarget.open)}><summary className="cursor-pointer py-2 font-medium">{locale === 'ar' ? 'تقدم الفصول' : 'Chapter progress and publication requirements'}</summary>{chaptersOpen && <PageEvidence id={data.parent.id} section="chapters" />}</details>
            <details onToggle={e => setHistoryOpen(e.currentTarget.open)}><summary className="cursor-pointer py-2 font-medium">{locale === 'ar' ? 'السجل التقني' : 'Technical history'}</summary>{historyOpen && <><p className="mb-2 text-xs text-muted-foreground">{locale === 'ar' ? 'تجديد الحجز يثبت الاتصال وليس تقدم المعالجة.' : 'Lease renewal confirms worker contact, not processing progress.'}</p>{data.active_execution?.map(execution => <p key={execution.request_id} className="mb-2 break-words text-xs">{execution.stage} · {execution.state} · {execution.worker} · {execution.lease_expires_at ?? '—'}</p>)}<PageEvidence id={data.parent.id} section="events" /></>}</details>
        </>}
    </section>;
}

function formatEpisodeDuration(seconds?: number | null) {
    if (seconds == null) return '—';
    const h = Math.floor(seconds / 3600); const m = Math.floor(seconds % 3600 / 60); const s = String(seconds % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function MediaJourneyList({ filters, actions }: { filters: AtomizationFilters; actions: (item: MediaAtomizationPipelineItem) => React.ReactNode }) {
    const locale = useJourneyLocale(); const ar = locale === 'ar';
    const router = useRouter(); const params = useSearchParams(); const pathname = usePathname();
    const lane = params.get('lane') ?? 'all'; const id = params.get('item');
    const query = useInfiniteQuery({ queryKey: [...journeyKeys.all, 'list', filters, lane], queryFn: ({ pageParam }) => fetchJourneyList(filters, lane, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.next_cursor || undefined, refetchInterval: q => q.state.data?.pages.some(page => page.items.some(item => [item.atomization_stage_state, item.media_stage_state, item.transcript_stage_state].some(state => ['queued', 'claimed', 'running', 'verifying'].includes(state ?? '')))) ? 5_000 : lane === 'published' ? 60_000 : 30_000, refetchIntervalInBackground: false, staleTime: 5_000 });
    const update = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); next.set(key, value); router.push(`${pathname}?${next}`, { scroll: false }); };
    const first = query.data?.pages[0];
    const rows = [...new Map(query.data?.pages.flatMap(page => page.items).map(item => [item.id, item]) ?? []).values()];
    return <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
        <section className="rounded-md border bg-card"><header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="flex items-center gap-2 text-base font-semibold"><Waves className="h-4 w-4 text-primary" />{ar ? 'رحلة معالجة الحلقات' : 'Atomization workflow'}</h2><p className="mt-1 text-sm text-muted-foreground">{ar ? 'تابع الحلقات من التنزيل إلى النشر. اختر حلقة لعرض رحلتها والإجراء التالي.' : 'Manage episodes from download to publication. Select an episode to view its journey and take the next action.'}</p></div><MediaJourneyGuide /></header>
        <nav className="flex gap-2 overflow-x-auto p-3" aria-label="Workflow stages"><Button size="sm" variant={lane === 'all' ? 'default' : 'outline'} onClick={() => update('lane', 'all')}>{ar ? 'الكل' : 'All'}<span className="ms-2 rounded bg-background/20 px-1.5 py-0.5 text-xs">{first?.counts.reduce((total,c) => total+c.count,0) ?? '—'}</span></Button>{first?.counts.map(count => <Button key={count.key} className="shrink-0" size="sm" variant={lane === count.key ? 'default' : 'outline'} onClick={() => update('lane', count.key)}>{journeyLane(count.key, count.label, locale)}<span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{count.count}</span></Button>)}</nav></section>
        {first?.progress_unavailable && <p role="status" className="text-sm text-muted-foreground">{ar ? 'توقيتات التقدم غير متاحة مؤقتاً؛ حالات الحلقات وإجراءاتها متاحة.' : 'Progress timestamps are temporarily unavailable; episode states and actions remain available.'}</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message} {first && 'Showing cached episodes.'}</p>}
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <section className="min-w-0 overflow-hidden rounded-md border bg-card" aria-label="Episodes">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3"><form className="relative min-w-48 flex-1" onSubmit={event => { event.preventDefault(); update('q', String(new FormData(event.currentTarget).get('q') ?? '')); }}><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><input key={filters.q} name="q" aria-label={ar ? 'بحث الحلقات' : 'Search episodes'} defaultValue={filters.q ?? ''} placeholder={ar ? 'بحث الحلقات…' : 'Search episodes…'} className="h-9 w-full rounded-md border bg-background pe-3 ps-9 text-sm" /></form><div className="flex shrink-0 gap-1"><Button size="sm" aria-pressed><List className="me-1.5 h-4 w-4" />{ar ? 'قائمة' : 'List'}</Button><Button size="sm" variant="outline" onClick={() => update('view','board')}><Columns3 className="me-1.5 h-4 w-4" />{ar ? 'لوحة' : 'Board'}</Button></div></div>
                {query.isPending && <p className="p-4">{ar ? 'جارٍ تحميل الحلقات…' : 'Loading episodes…'}</p>}
                {!query.isPending && !query.isError && rows.length === 0 && <p className="p-4 text-muted-foreground">{ar ? 'لا توجد حلقات في هذه المرحلة.' : 'No episodes in this stage.'}</p>}
                <div className="overflow-x-auto"><table className="w-full min-w-[610px] table-fixed text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="w-[35%] px-4 py-3 text-start font-medium">{ar ? 'العنوان' : 'Title'}</th><th className="w-[15%] px-2 py-3 text-start font-medium">{ar ? 'المصدر' : 'Source'}</th><th className="w-[12%] px-2 py-3 text-start font-medium">{ar ? 'المدة' : 'Duration'}</th><th className="w-[16%] px-2 py-3 text-start font-medium">{ar ? 'الحالة' : 'Status'}</th><th className="w-[22%] px-2 py-3 text-start font-medium">{ar ? 'الإجراء التالي' : 'Next action'}</th></tr></thead><tbody>
                {rows.map(item => <tr key={item.id} aria-selected={id === item.id} className={`border-b transition-colors hover:bg-muted/40 ${id === item.id ? 'bg-primary/15' : ''}`}>
                    <td className="px-4 py-3"><button type="button" aria-pressed={id === item.id} className="w-full text-start font-medium leading-5 focus-visible:outline focus-visible:outline-2" onClick={() => update('item', item.id)}><span className="line-clamp-2" dir="auto">{item.title}</span></button>{(item.latest_error || item.blocking_reason) && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">{ar ? 'سبب الحالة' : 'Why this status?'}</summary><p className="mt-1 break-words">{item.latest_error ?? item.blocking_reason}</p><p className="mt-1">{item.last_progress_at ? new Date(item.last_progress_at).toLocaleString() : (ar ? 'لا يوجد تقدم مؤكد مسجل' : 'No confirmed progress recorded')}</p></details>}</td>
                    <td className="px-2 py-3 text-xs text-muted-foreground"><span dir="auto" className="line-clamp-2">{item.source_name ?? '—'}</span></td>
                    <td className="px-2 py-3 text-xs tabular-nums text-muted-foreground">{formatEpisodeDuration(item.duration_sec)}</td>
                    <td className="px-2 py-3"><Badge variant={item.lane === 'published' ? 'success' : item.lane === 'failed' ? 'destructive' : item.lane === 'review' ? 'warning' : 'secondary'} className="text-[11px] leading-4">{journeyLane(item.lane ?? 'unknown', first?.counts.find(c => c.key === item.lane)?.label ?? item.lane ?? (ar ? 'غير معروف' : 'Unknown'), locale)}</Badge></td>
                    <td className="px-2 py-3 [&_button]:h-auto [&_button]:min-h-8 [&_button]:whitespace-normal [&_button]:px-2 [&_button]:text-xs [&_a]:text-xs">{actions(item)}</td>
                </tr>)}
                </tbody></table></div>
                {first && <footer className="flex items-center justify-between gap-3 p-4 text-sm"><span>{ar ? `${rows.length} معروضة · ${first.total} حلقة` : `${rows.length} shown · ${first.total} episodes`}</span>{query.hasNextPage && <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{ar ? 'تحميل المزيد' : 'Load more'}</Button>}</footer>}
                {first && <p className="px-4 pb-3 text-xs text-muted-foreground">{ar ? 'آخر لقطة' : 'Snapshot'}: {new Date(first.updated_at).toLocaleTimeString()}</p>}
            </section>
            {id ? <EpisodeJourney key={id} id={id} actions={actions} /> : <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">{ar ? 'اختر حلقة لمتابعة رحلتها والإجراء التالي.' : 'Select an episode to follow its journey and see the next action.'}</p>}
        </div>
    </div>;
}
