'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import Link from '@/lib/console-link';
import { cmsClient, type ApiError } from '@/lib/api/client';
import { deliveryHref, isRecordId, canReadConsole } from '@/lib/operator-destinations';
import { useAuthStore } from '@/lib/stores/auth';
import { useWorkspaceSession, workspaceHref } from '@/lib/stores/workspace-session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyConsoleLink } from '@/components/shared/copy-console-link';

type Row = { status: string; detail: string; owner?: string; observed_at?: string };
type Observation = { boundary: 'feed_return' | 'page_render'; scope: string; observed_at: string; generation?: string; historical: boolean };
type Summary = {
    version: 'delivery-summary/v1';
    id: string;
    title: string;
    item_type: string;
    as_of: string;
    processing_generation: number;
    active_feed_generation?: string;
    source: Row;
    processing: Row;
    eligibility: Row;
    publication: Row;
    delivery: Row;
    observations: Observation[];
    links: { label: string; href: string }[];
};
type HistoryPage = { items: { id: string; stage: string; owner: string; state: string; at: string; processing_generation: number }[]; next: string };
type Ranking = { as_of: string; raw_rank?: number | null; final_rank?: number | null; assembly_mode: string };

const rows = [
    ['source', 'Source'], ['processing', 'Processing'], ['eligibility', 'Feed eligibility'],
    ['publication', 'Publication'], ['delivery', 'Observed delivery'],
] as const;
const itemLabels: Record<string, string> = { NEWS: 'News item', PODS_CHAPTER: 'Pods chapter', PODS_PARENT: 'Parent episode', VIDEO: 'Video', PODCAST: 'Podcast' };
const text = (value: string) => value.replaceAll('_', ' ');
const date = (value: string) => new Date(value).toLocaleString();

function readTrace<T>(id: string, resource: 'trace-summary' | 'trace-evidence', signal: AbortSignal, params?: object) {
    return cmsClient.get<{ data: T }>('/admin/content-stages/items/' + encodeURIComponent(id) + '/' + resource, params, signal).then(response => response.data);
}

export function DeliveryTrace({ id }: { id: string }) {
    const owner = useWorkspaceSession(state => state.owner);
    const user = useAuthStore(state => state.user);
    const allowed = canReadConsole(user, 'aggregation:read');
    const query = useQuery({
        queryKey: ['delivery-summary', owner, id],
        queryFn: async ({ signal }) => {
            const snapshot = await readTrace<Summary>(id, 'trace-summary', signal);
            if (snapshot?.version !== 'delivery-summary/v1' || !isRecordId(snapshot.id) || snapshot.id.toLowerCase() !== id.toLowerCase()) {
                throw new Error('Unexpected delivery summary');
            }
            return snapshot;
        },
        enabled: Boolean(owner) && isRecordId(id) && allowed,
        retry: false,
    });
    const status = (query.error as unknown as ApiError | null)?.status;
    const result = owner && allowed && status !== 403 && status !== 404 && query.data?.id.toLowerCase() === id.toLowerCase() ? query.data : undefined;
    const back = canReadConsole(user, 'content:read') && isRecordId(id) ? '/platform/content/' + encodeURIComponent(id) : '/platform/pipeline';

    return <div className="mx-auto max-w-4xl space-y-5">
        <Link href={back} className="inline-flex min-h-9 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />{back === '/platform/pipeline' ? 'Back to Pipeline' : 'Back to item'}
        </Link>
        <header className="space-y-2">
            <p className="brand-overline text-muted-foreground">Delivery trace</p>
            <h1 dir="auto" className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{result?.title ?? 'Delivery evidence'}</h1>
            {result && <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{itemLabels[result.item_type] ?? result.item_type} · <time dateTime={result.as_of}>{date(result.as_of)}</time></p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
                        <RefreshCw aria-hidden="true" className="me-2 size-4" />{query.isFetching ? 'Refreshing…' : 'Refresh evidence'}
                    </Button>
                    <CopyConsoleLink key={owner + id} href={deliveryHref(id)} />
                </div>
            </div>}
        </header>
        {!isRecordId(id) ? <p role="alert">Enter a valid content ID.</p> : !owner ? <Skeleton className="h-32" /> : !allowed ? (
            <p role="alert">Your account does not have permission to read delivery evidence.</p>
        ) : result ? (
            <>
                {query.isError && <p role="status" className="rounded-md border border-warning p-3 text-sm">Showing the last successful evidence. Refresh to check again.</p>}
                <Card className="space-y-3 border-s-4 border-s-primary p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CMS evidence</p>
                    <h2 className="text-lg font-semibold">{result.publication.status} · {result.delivery.status}</h2>
                    <p className="text-sm text-muted-foreground">{result.processing.status}. {text(result.processing.detail)}</p>
                    {result.links.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {result.links.filter(link => workspaceHref(link.href, false)).map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-9 items-center gap-2 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                            {link.label}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
                        </Link>)}
                    </div>}
                </Card>
                <Card className="p-4 sm:p-5">
                    <h2 className="mb-2 text-sm font-semibold">Delivery steps</h2>
                    <ol className="divide-y">
                        {rows.map(([key, label], index) => {
                            const row = result[key];
                            return <li key={key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-3">
                                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-muted text-xs font-medium tabular-nums">{index + 1}</span>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <h3 className="text-sm font-semibold">{label}</h3><Badge variant="outline">{row.status}</Badge>
                                    </div>
                                    <p dir="auto" className="break-words text-sm text-muted-foreground">{key === 'processing' ? text(row.detail) : row.detail}</p>
                                    {(row.owner || row.observed_at) && <p className="text-xs text-muted-foreground">
                                        {row.owner && <bdi>{text(row.owner)}</bdi>}{row.owner && row.observed_at && ' · '}
                                        {row.observed_at && <time dateTime={row.observed_at}>{date(row.observed_at)}</time>}
                                    </p>}
                                    {key === 'delivery' && result.observations.length > 0 && <ul className="space-y-1 text-xs">
                                        {result.observations.map(observation => <li key={observation.boundary + String(observation.historical)}>
                                            {observation.boundary === 'feed_return' ? 'Feed return' : 'Client render'} · {text(observation.scope)} · <time dateTime={observation.observed_at}>{date(observation.observed_at)}</time>{observation.historical && ' · Historical'}
                                        </li>)}
                                    </ul>}
                                </div>
                            </li>;
                        })}
                    </ol>
                </Card>
                <TraceDetails key={owner + ':' + id} id={id} owner={owner} generation={result.processing_generation} pods={['PODS_PARENT', 'PODS_CHAPTER', 'VIDEO', 'PODCAST'].includes(result.item_type)} />
            </>
        ) : query.isPending ? <Skeleton className="h-32" /> : (
            <Card className="space-y-3 p-4">
                <p role="alert">{status === 404 ? 'This item is unavailable.' : status === 403 ? 'Your account cannot read this item’s delivery evidence.' : 'Delivery evidence could not be loaded.'}</p>
                {status !== 404 && status !== 403 && <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Try again</Button>}
            </Card>
        )}
    </div>;
}

function TraceDetails({ id, owner, generation, pods }: { id: string; owner: string; generation: number; pods: boolean }) {
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<'attempts' | 'receipts'>('attempts');
    const [rankOpen, setRankOpen] = useState(false);
    const history = useInfiniteQuery({
        queryKey: ['delivery-history', owner, id, section],
        queryFn: ({ pageParam, signal }) => readTrace<HistoryPage>(id, 'trace-evidence', signal, { section, before: pageParam }),
        initialPageParam: '0',
        getNextPageParam: page => page.next || undefined,
        enabled: open,
        retry: false,
    });
    const historyStatus = (history.error as unknown as ApiError | null)?.status;
    const historyUnavailable = historyStatus === 403 || historyStatus === 404;
    const visibleHistory = historyUnavailable ? undefined : history.data;
    const ranking = useQuery({
        queryKey: ['delivery-ranking', owner, id],
        queryFn: ({ signal }) => readTrace<Ranking>(id, 'trace-evidence', signal, { section: 'ranking' }),
        enabled: rankOpen,
        retry: false,
    });
    return <Card className="space-y-3 p-4 sm:p-5">
        <details onToggle={event => setOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring">Evidence details</summary>
            {open && <div className="mt-3 space-y-3">
                <div className="text-xs text-muted-foreground">Processing attempts and receipt summaries by generation.</div>
                <div className="flex gap-2">
                    {(['attempts', 'receipts'] as const).map(value => <Button key={value} size="sm" variant={section === value ? 'default' : 'outline'} aria-pressed={section === value} onClick={() => setSection(value)}>{value === 'attempts' ? 'Attempts' : 'Receipts'}</Button>)}
                </div>
                {history.isPending && <Skeleton className="h-12" />}
                {historyUnavailable && <p role="status" className="text-sm">Evidence history is unavailable.</p>}
                {history.isError && !historyUnavailable && !history.isFetchNextPageError && (
                    <p role="status" className="text-sm">{visibleHistory ? 'Showing the last loaded history.' : 'Evidence history is unavailable.'} <button className="underline" type="button" onClick={() => void history.refetch()}>Retry</button></p>
                )}
                {visibleHistory && (visibleHistory.pages[0]?.items.length === 0 ? <p className="text-sm text-muted-foreground">No evidence recorded.</p> : (
                    <ul className="divide-y">{visibleHistory.pages.flatMap(page => page.items).map(row => <li key={row.id} className="py-2 text-sm">
                        <strong>{text(row.stage)}</strong> · {text(row.state)}
                        <p className="text-xs text-muted-foreground">
                            Generation {row.processing_generation}{row.processing_generation !== generation && ' · Historical'} · {text(row.owner)} · <time dateTime={row.at}>{date(row.at)}</time>
                        </p>
                    </li>)}</ul>
                ))}
                {!historyUnavailable && history.isFetchNextPageError && <p role="status" className="text-sm">Could not load the next page.</p>}
                {visibleHistory && history.hasNextPage && <Button size="sm" variant="outline" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
                    {history.isFetchNextPageError ? 'Retry next page' : 'Load more'}
                </Button>}
            </div>}
        </details>
        {pods && <div className="space-y-2">
            <Button variant="outline" size="sm" disabled={ranking.isFetching} onClick={() => rankOpen ? void ranking.refetch() : setRankOpen(true)}>Check current Pods ranking</Button>
            {rankOpen && (ranking.isError ? <p role="status" className="text-sm">Ranking evidence is unavailable.</p> : ranking.data ? (
                <p className="text-sm text-muted-foreground">Anonymous assembly · {text(ranking.data.assembly_mode)} · Rank {ranking.data.final_rank ?? 'unavailable'} · <time dateTime={ranking.data.as_of}>{date(ranking.data.as_of)}</time></p>
            ) : <p role="status" className="text-sm text-muted-foreground">Checking ranking…</p>)}
        </div>}
    </Card>;
}
