'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { applyDraft, fetchDrafts, fetchJourney, journeyKeys, saveDraft, type ChapterDraft } from '@/lib/api/cms/media-journey';
import type { StudioChapter } from '@/types/platform/studio';
import { useJourneyLocale } from './media-journey';
import { journeyReason } from '@/lib/studio/journey-guide';

export function ChapterDraftControls({ id, chapters, dirty, onSaved, onLoad }: { id: string; chapters: StudioChapter[]; dirty: boolean; onSaved: () => void; onLoad: (chapters: StudioChapter[]) => void }) {
    const locale = useJourneyLocale(); const ar = locale === 'ar'; const client = useQueryClient();
    const drafts = useQuery({ queryKey: journeyKeys.drafts(id), queryFn: () => fetchDrafts(id), staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false, refetchOnWindowFocus: false });
    const journey = useQuery({ queryKey: journeyKeys.detail(id), queryFn: () => fetchJourney(id), staleTime: 5_000 });
    const editingRevision = useRef<number | null>(null);
    useEffect(() => {
        if (drafts.data && (!dirty || editingRevision.current === null)) editingRevision.current = drafts.data.items[0]?.revision ?? 0;
    }, [drafts.data, dirty]);
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState<ChapterDraft | null>(null);
    const refresh = () => { void client.invalidateQueries({ queryKey: journeyKeys.all }); void client.invalidateQueries({ queryKey: ['media-atomization'] }); };
    const save = useMutation({ mutationFn: () => saveDraft(id, chapters, editingRevision.current ?? 0), onSuccess: () => { onSaved(); setMessage(ar ? 'حُفظت المسودة دون تغيير المعالجة.' : 'Draft saved. Running and published media are unchanged.'); refresh(); }, onError: refresh });
    // One immutable revision has one application identity, including after a
    // lost response, remount, or refresh. Never create a fresh retry identity.
    const apply = useMutation({ mutationFn: (draft: ChapterDraft) => applyDraft(id, draft, draft.id), onSuccess: result => { setMessage(`${ar ? 'حالة الطلب' : 'Request state'}: ${result.state}. ${ar ? 'يبقى المنشور متاحاً حتى جاهزية البديل.' : 'Published media stays available until replacement is ready.'}`); setConfirmation(null); refresh(); }, onError: refresh });
    const current = drafts.data?.items[0]; const executed = journey.data?.candidate_generation;
    return <section className="space-y-3 rounded-md border p-3" aria-label="Versioned chapter plans">
        <h2 className="font-semibold">{ar ? 'مسودات الفصول' : 'Versioned chapter drafts'}</h2>
        <p className="text-sm text-muted-foreground">{ar ? 'حفظ المسودة لا يقص الوسائط. التطبيق الصريح يستخدم هذه الحدود في تشغيل لاحق. لا تنتظر المعالجة التلقائية المسودات.' : 'Saving a draft does not cut media. Explicit application uses these boundaries in a future run. Automatic processing does not wait for drafts.'}</p>
        {drafts.isError && <p role="alert" className="text-sm text-destructive">{drafts.error.message}</p>}
        {(save.error || apply.error) && <p role="alert" className="break-words text-sm text-destructive">{save.error?.message ?? apply.error?.message}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <div className="flex flex-wrap gap-2">
            <Button disabled={!dirty || !drafts.data || save.isPending} onClick={() => save.mutate()}>{ar ? 'حفظ مسودة' : 'Save draft'}</Button>
            {current && <Button variant="outline" onClick={() => { if (!dirty || window.confirm(ar ? 'استبدال التعديلات غير المحفوظة بالمسودة؟' : 'Replace unsaved edits with this draft?')) { editingRevision.current = current.revision; onLoad(current.plan); } }}>{ar ? 'تحميل آخر مسودة' : `Load draft ${current.revision}`}</Button>}
            {current && !current.applied_request_id && <Button variant="outline" disabled={dirty || current.validation.length > 0 || !drafts.data?.worker_supported || drafts.data?.apply_action?.enabled !== true || apply.isPending} onClick={() => setConfirmation(current)}>{ar ? 'تطبيق الخطة ومعالجتها' : 'Apply plan and process'}</Button>}
        </div>
        {drafts.data && !drafts.data.worker_supported && <p className="text-sm text-muted-foreground">{ar ? 'يلزم عامل يدعم المسودات لتطبيق الخطة.' : 'A draft-aware worker must be online before a plan can be applied.'}</p>}
        {drafts.data?.apply_action?.reason_code && <p className="text-sm text-muted-foreground">{journeyReason(drafts.data.apply_action.reason_code, locale)}</p>}
        {dirty && <p className="text-sm text-muted-foreground">{ar ? 'احفظ التعديلات كمسودة قبل تطبيقها.' : 'Save your edits as a draft before applying them.'}</p>}
        {current?.validation.map((issue, i) => <p key={i} className="text-sm text-destructive">{issue}</p>)}
        {current?.applied_request_id && <p className="text-sm">{ar ? 'طُبقت المسودة' : 'Applied draft'} {current.revision} · {current.applied_request_id}</p>}
        <p className="text-sm text-muted-foreground">{ar ? 'مصدر الخطة المنفذة' : 'Executed plan origin'}: {executed?.plan_origin && executed.plan_origin !== 'unavailable' ? executed.plan_origin : (ar ? 'المصدر غير متاح' : 'Origin unavailable')}</p>
        {confirmation && <div role="region" aria-label="Confirm plan application" className="space-y-3 rounded-md border p-3">
            <p>{confirmation.plan.length} {ar ? 'فصول' : 'chapters'} · {Math.round(confirmation.plan.reduce((sum, chapter) => sum + chapter.end_ms - chapter.start_ms, 0) / 60000)} min</p>
            <ul className="max-h-64 list-disc overflow-y-auto ps-5 text-sm">{confirmation.plan.map((chapter, index) => { const previous = executed?.plan?.[index]; return <li key={index} dir="auto">{previous ? `${previous.title} (${previous.start_ms / 1000}–${previous.end_ms / 1000}s) → ` : ''}{chapter.title} ({chapter.start_ms / 1000}–{chapter.end_ms / 1000}s)</li>; })}</ul>
            <p className="text-sm">{ar ? 'قد تتطلب الحدود المعدلة قصاً ورفعاً وتضمينات جديدة. التكلفة وحجم التخزين غير معروفين. يبقى الإصدار المنشور حتى اكتمال فحوص البديل.' : 'Changed boundaries may require new cuts, uploads, and embeddings. Cost and storage size are unknown. The published generation remains until all replacement checks pass.'}</p>
            <Button disabled={apply.isPending || dirty || drafts.data?.apply_action?.enabled !== true} onClick={() => apply.mutate(confirmation)}>{ar ? 'تأكيد وتقديم الطلب' : 'Confirm and submit request'}</Button>{' '}<Button variant="outline" disabled={apply.isPending} onClick={() => setConfirmation(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
        </div>}
        <details><summary className="cursor-pointer text-sm">{ar ? 'مقارنة المسودة والخطة المنفذة والمنشورة' : 'Compare draft, executed, and published plans'}</summary><div className="mt-3 grid gap-3 lg:grid-cols-3">{[{ label: ar ? 'المسودة' : 'Draft', plan: current?.plan }, { label: ar ? 'المخطط المثبت للتنفيذ' : 'Frozen execution plan', plan: executed?.plan }, { label: ar ? 'المنشور' : 'Published plan', plan: journey.data?.published_generation?.plan }].map(column => <div key={column.label}><h3 className="font-medium">{column.label}</h3>{column.plan?.map((chapter, i) => <div key={i} className="mt-2 text-sm" dir="auto"><p>{chapter.title} · {chapter.start_ms / 1000}s–{chapter.end_ms / 1000}s</p><p className="text-muted-foreground">{chapter.boundary_reason ?? (ar ? 'سبب الحدود غير متاح' : 'Boundary reason unavailable')}</p></div>) ?? <p className="text-sm text-muted-foreground">{ar ? 'غير متاح' : 'Not available'}</p>}</div>)}</div></details>
    </section>;
}
