'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { executeJourneyAction, journeyKeys, type JourneyAction } from '@/lib/api/cms/media-journey';
import type { MediaAtomizationPipelineItem } from '@/types/platform/media-atomization';
import { useJourneyLocale } from './media-journey';
import { journeyActionLabels, journeyNextAction, journeyReason } from '@/lib/studio/journey-guide';

export function JourneyActions({ item, compact = false }: { item: MediaAtomizationPipelineItem & { actions?: JourneyAction[] }; compact?: boolean }) {
    const ar = useJourneyLocale() === 'ar'; const client = useQueryClient(); const [message, setMessage] = useState('');
    const mutation = useMutation({ mutationFn: (code: string) => executeJourneyAction(code, item.id, item.processing_generation), onSuccess: result => setMessage(`${result.message ?? ''} · ${result.data?.state ?? result.data?.job?.status ?? result.data?.reason ?? (ar ? 'تم قبول الطلب' : 'Request accepted')}`), onSettled: () => { void client.invalidateQueries({ queryKey: journeyKeys.all }); void client.invalidateQueries({ queryKey: ['media-atomization'] }); } });
    const labels = Object.fromEntries(Object.entries(journeyActionLabels).map(([key,value]) => [key,value[ar ? 1 : 0]]));
    const enabled = item.actions?.filter(action => action.enabled) ?? [];
    const primary = enabled.find(action => action.code !== 'inspect') ?? enabled[0];
    const visible = compact ? (primary ? [primary] : []) : enabled;
    return <div className="space-y-2"><div className="flex flex-wrap gap-2">{visible.map(action => ['review','inspect'].includes(action.code) ? <Link key={action.code} className={compact ? 'inline-flex min-h-9 w-full items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-center text-xs font-medium hover:bg-accent' : 'text-sm underline'} href={`/platform/media/atomization?tab=${action.code === 'review' ? 'review' : 'studio'}&item=${item.id}`}>{labels[action.code]}</Link> : <Button key={action.code} size="sm" className={compact ? 'h-auto min-h-9 w-full whitespace-normal text-xs' : undefined} variant={compact ? 'default' : 'outline'} disabled={mutation.isPending} onClick={() => {
        const confirmation = action.code === 'approve_transcript_for_use' ? (ar ? 'اعتماد النص الموجود للاستخدام؟ لا يولّد هذا الإجراء نصاً جديداً ولا ينشر المقاطع فوراً.' : 'Approve the existing transcript for use? This does not generate new STT or immediately publish chapters.') : ar ? 'تقديم هذا الطلب؟ قد تنشأ تكاليف معالجة جديدة. تُحفظ الأعمال المتحققة والمنشورات الحالية. تبقى متطلبات المراجعة والنشر سارية. حجم التخزين غير معروف حتى فحص الوسائط.' : `Submit ${labels[action.code]}? New processing may incur charges. Verified work and current publications are preserved. Remaining review and publication checks still apply. Storage size is unknown until media probe.`;
        if (window.confirm(confirmation)) mutation.mutate(action.code);
    }}>{labels[action.code] ?? action.code}</Button>)}</div>
    {message && <p role="status" className="text-sm">{message}</p>}{mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message} {ar ? 'تم تحديث الرحلة؛ راجع المتطلبات الحالية.' : 'Journey refreshed; check the current requirements.'}</p>}
    {item.actions?.some(a => a.reason_code === 'effects_unresolved') && <p className="text-sm">{ar ? 'آثار غير محسومة: الاسترداد مطلوب قبل إعادة المحاولة.' : 'Unresolved effects require recovery before retrying.'}</p>}
    {!compact && item.actions?.some(a => !a.enabled) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{ar ? 'لماذا بعض الإجراءات غير متاحة؟' : 'Why are other actions unavailable?'}</summary><ul className="mt-2 space-y-3">{item.actions.filter(a => !a.enabled).map(a => <li key={a.code}><p><span className="font-medium text-foreground">{labels[a.code] ?? a.code}:</span> {journeyReason(a.reason_code ?? 'prerequisites_required', ar ? 'ar' : 'en')}</p><p className="mt-1"><span className="font-medium text-foreground">{ar ? 'الإجراء التالي' : 'Next action'}:</span> {journeyNextAction(a.reason_code ?? 'prerequisites_required', ar ? 'ar' : 'en', a.step)}</p></li>)}</ul></details>}
    </div>;
}
