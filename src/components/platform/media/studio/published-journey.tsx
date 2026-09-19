'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { fetchPublishedJourney, type PublishedUnit } from '@/lib/api/cms/media-journey';
import { useJourneyLocale } from './media-journey';
import type { AtomizationFilters } from '@/types/platform/media-atomization';

function Playback({ item }: { item: PublishedUnit }) {
    const [fallback, setFallback] = useState(false);
    const src = fallback ? item.fallback_playback_url : item.playback_url;
    if (!src) return <p>Playback unavailable</p>;
    const props = { src, controls: true, preload: 'none' as const, onError: () => setFallback(true), className: 'w-full max-h-80' };
    return item.has_video === false || item.playback_type === 'audio' ? <audio {...props} /> : <video {...props} playsInline />;
}

export function PublishedJourney({ filters }: { filters: AtomizationFilters }) {
    const locale = useJourneyLocale();
    const params = useSearchParams(); const router = useRouter(); const pathname = usePathname();
    const path = params.get('path') ?? 'all';
    const setPath = (value: string) => { const next = new URLSearchParams(params.toString()); if (value === 'all') next.delete('path'); else next.set('path', value); router.push(`${pathname}?${next}`, { scroll: false }); };
    const [preview, setPreview] = useState<string>();
    const query = useInfiniteQuery({ queryKey: ['media-journey', 'published', filters.source, filters.q, path], queryFn: ({ pageParam }) => fetchPublishedJourney(filters, path, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.next_cursor || undefined, refetchInterval: 60_000, refetchIntervalInBackground: false });
    const first = query.data?.pages[0];
    const items = [...new Map(query.data?.pages.flatMap(page => page.items).map(item => [item.id, item])).values()];
    return <section className="space-y-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <h2 className="text-xl font-semibold">{first ? (locale === 'ar' ? `${first.total} مقطع منشور من ${first.parent_count} حلقة` : `${first.total} published units from ${first.parent_count} episodes`) : (locale === 'ar' ? 'المنشور' : 'Published')}</h2>
        <div className="flex flex-wrap gap-2">{[['all', 'All', 'الكل'], ['atomized', 'Chapters', 'فصول'], ['direct_transcript', 'Direct with transcript', 'مباشر مع نص'], ['direct_no_transcript', 'Direct without transcript', 'مباشر دون نص']].map(([key, en, ar]) => <Button key={key} variant={path === key ? 'default' : 'outline'} size="sm" onClick={() => setPath(key)}>{locale === 'ar' ? ar : en}</Button>)}</div>
        {query.isError && <p role="alert">{query.error.message} {first && `Last snapshot: ${first.updated_at}`}</p>}
        {query.isPending && <p>{locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>}
        <div className="divide-y">{items.map(item => <article key={item.id} className="space-y-2 py-4">
            <h3 className="font-medium" dir="auto">{item.title}</h3>
            <p className="text-sm text-muted-foreground" dir="auto">{item.parent_title ?? item.source_name} · {Math.round((item.duration_sec ?? 0) / 60)} min{item.chapter_start_ms != null && ` · ${Math.round(item.chapter_start_ms / 1000)}–${Math.round((item.chapter_end_ms ?? 0) / 1000)}s`}</p>
            <p className="text-xs text-muted-foreground">{item.publication_at ? new Date(item.publication_at).toLocaleString() : (locale === 'ar' ? 'وقت النشر غير متاح' : 'Publication time unavailable')}</p>
            <div className="flex gap-3"><Link className="text-sm underline" href={`/platform/media/atomization?tab=studio&item=${item.parent_id ?? item.id}&chapter=${item.id}`}>{locale === 'ar' ? 'فتح الحلقة' : 'Open episode'}</Link><Button size="sm" variant="outline" onClick={() => setPreview(preview === item.id ? undefined : item.id)}>{locale === 'ar' ? 'تشغيل' : 'Playback'}</Button></div>
            {preview === item.id && <Playback item={item} />}
        </article>)}</div>
        {first && !items.length && <p>{locale === 'ar' ? 'لا توجد مقاطع منشورة لهذا الفلتر.' : 'No published units match this filter.'}</p>}
        {query.hasNextPage && <Button disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{locale === 'ar' ? 'تحميل المزيد' : 'Load more'}</Button>}
    </section>;
}
