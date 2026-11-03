'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Loader2, MoreHorizontal, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { sourceKeys } from '@/hooks/use-sources';
import { discoveryKeys } from '@/hooks/use-discovery';
import { applyNewsCollection, getNewsCollection, previewNewsCollection, type NewsPreview, type NewsRequest, type NewsResult } from '@/lib/api/cms/news-collection';

export const newsCollectionKey = ['news-collection'] as const;
const plural = (count: number) => `${count} source${count === 1 ? '' : 's'}`;
export const newsCollectionExplanation = (reason: string) => ({
    news_admission_unavailable: 'News is not set up in this environment yet.',
    tenant_intake_paused: 'Updates are stopped by an environment-wide control.',
    scheduler_unavailable: 'Automatic updates are unavailable right now.',
    provider_readiness_unavailable: 'The connection could not be checked. Try again.',
    telegram_not_configured: 'Connect Telegram in this environment to use these sources.',
    twitter_api_not_configured: 'Connect the X API in this environment to use these sources.',
    enrichment_unavailable: 'The extraction service is unavailable. Try again shortly.',
    source_address_missing: 'This source needs an address.',
    source_address_invalid: 'This source has an invalid address.',
    manual_source: 'This source accepts manual updates only.',
}[reason] ?? 'This source needs attention before it can update.');

function message(error: unknown) {
    return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : 'The change could not be confirmed. Try again.';
}
function uncertain(error: unknown) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    return status === 0 || status >= 500;
}
function actionLabel(result: NewsResult) {
    if (result.action === 'pause') return 'News updates paused';
    if (result.action === 'resume') return 'News updates resumed';
    return result.changed ? `${plural(result.changed)} ${result.action === 'enable' ? 'enabled' : 'disabled'}` : 'Sources are already up to date';
}

export function useNewsCollectionManagement(onChanged: () => void) {
    const client = useQueryClient();
    const status = useQuery({ queryKey: newsCollectionKey, queryFn: getNewsCollection, staleTime: 15_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
    const [reviewOpen, setReviewOpen] = useState(false);
    const [preview, setPreview] = useState<NewsPreview | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [applying, setApplying] = useState(false);
    const [reviewError, setReviewError] = useState<{ text: string; uncertain: boolean } | null>(null);
    const [expired, setExpired] = useState(false);
    const [working, setWorking] = useState<string | null>(null);
    const [directError, setDirectError] = useState<string | null>(null);
    const [connectionsOpen, setConnectionsOpen] = useState(false);
    const request = useRef<NewsRequest | null>(null);
    const reviewSequence = useRef(0);
    const retryOperation = useRef<{ id?: string; request: NewsRequest; target: string } | null>(null);
    const busyRef = useRef(false);

    const refresh = useCallback(async () => {
        await Promise.allSettled([
            client.invalidateQueries({ queryKey: newsCollectionKey }),
            client.invalidateQueries({ queryKey: sourceKeys.all }),
            client.invalidateQueries({ queryKey: discoveryKeys.all }),
        ]);
        onChanged();
    }, [client, onChanged]);

    const finish = async (result: NewsResult) => {
        toast({ title: actionLabel(result), description: result.excluded ? `${plural(result.excluded)} still need a connection.` : undefined, variant: 'success' });
        await refresh();
    };

    const review = async (next: NewsRequest) => {
        if (busyRef.current) return;
        const sequence = ++reviewSequence.current;
        request.current = { ...next, ids: next.ids ? [...next.ids] : undefined };
        setReviewOpen(true); setPreview(null); setReviewError(null); setExpired(false); setPreparing(true);
        try {
            const result = await previewNewsCollection(request.current);
            if (sequence === reviewSequence.current) setPreview(result);
        } catch (error) {
            if (sequence === reviewSequence.current) setReviewError({ text: message(error), uncertain: false });
        } finally {
            if (sequence === reviewSequence.current) setPreparing(false);
        }
    };

    const closeReview = () => {
        if (applying) return;
        reviewSequence.current++;
        setReviewOpen(false); setPreparing(false); setPreview(null); setReviewError(null);
    };

    const applyReview = async () => {
        if (!preview || busyRef.current) return;
        busyRef.current = true; setApplying(true); setReviewError(null);
        try {
            const result = await applyNewsCollection(preview.id);
            setReviewOpen(false); setPreview(null);
            await finish(result);
        } catch (error) {
            setReviewError({ text: message(error), uncertain: uncertain(error) });
        } finally { busyRef.current = false; setApplying(false); }
    };

    const perform = async (next: NewsRequest, target: string, existingId?: string) => {
        if (busyRef.current) return;
        busyRef.current = true; setWorking(target); setDirectError(null);
        let id = existingId;
        let sent = Boolean(id);
        try {
            if (!id) {
                const checked = await previewNewsCollection(next);
                const unavailable = checked.snapshot.sources.find(source => source.outcome === 'needs_configuration');
                if (unavailable) throw new Error(`${unavailable.name}: ${newsCollectionExplanation(unavailable.reason ?? '')}`);
                if (next.action === 'enable' || next.action === 'resume') {
                    if (!checked.snapshot.readiness.ready) throw new Error(newsCollectionExplanation(checked.snapshot.readiness.blockers[0]));
                }
                id = checked.id;
            }
            // Keep this exact receipt identity if the response becomes uncertain.
            retryOperation.current = { id, request: next, target };
            sent = true;
            const result = await applyNewsCollection(id);
            retryOperation.current = null;
            await finish(result);
        } catch (error) {
            retryOperation.current = { id: sent && uncertain(error) ? id : undefined, request: next, target };
            setDirectError(message(error));
            void refresh();
        } finally { busyRef.current = false; setWorking(null); }
    };

    useEffect(() => {
        if (!preview) return;
        const remaining = new Date(preview.expires_at).getTime() - Date.now();
        if (remaining <= 0) { setExpired(true); return; }
        const timer = setTimeout(() => setExpired(true), remaining);
        return () => clearTimeout(timer);
    }, [preview]);

    return {
        status, reviewOpen, preview, preparing, applying, reviewError, expired, working, directError,
        connectionsOpen, setConnectionsOpen,
        busy: preparing || applying || working !== null,
        review, closeReview, applyReview,
        refreshReview: () => request.current && review(request.current),
        setSource: (id: string, active: boolean) => perform({ action: active ? 'enable' : 'disable', scope: 'selected', ids: [id] }, id),
        setPaused: (paused: boolean) => perform({ action: paused ? 'pause' : 'resume', scope: 'all' }, 'collection'),
        retry: () => { const pending = retryOperation.current; if (pending) void perform(pending.request, pending.target, pending.id); },
        clearError: () => { setDirectError(null); retryOperation.current = null; },
    };
}
export type NewsCollectionManagement = ReturnType<typeof useNewsCollectionManagement>;

export function NewsCollectionControls({ collection, disabled = false, selectionActive = false }: { collection: NewsCollectionManagement; disabled?: boolean; selectionActive?: boolean }) {
    const data = collection.status.data;
    const idle = data?.enabled === 0;
    const paused = data?.readiness.paused;
    const unavailable = Boolean(collection.status.isError || (data && !data.readiness.ready));
    const canChange = data?.can_manage && !collection.busy && !disabled;
    const title = !data ? collection.status.isError ? 'Updates unavailable' : 'Checking updates…'
        : unavailable ? 'Updates need attention' : paused ? 'Updates paused' : idle ? 'No sources enabled' : 'Automatic updates on';
    return <section aria-label="News updates" className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 border-b pb-5">
        <div className="flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unavailable ? 'bg-warning' : paused || idle ? 'bg-muted-foreground/50' : data ? 'bg-success' : 'animate-pulse bg-muted-foreground/50'}`} />
            <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{!data ? 'Your source choices are saved here.' : unavailable ? collection.status.isError ? 'Connection status is unavailable. Refresh to try again.' : newsCollectionExplanation(data.readiness.blockers[0]) : paused ? 'Your source selections are saved. Resume when you’re ready.' : idle ? 'Enable sources to keep your News feed up to date.' : `${plural(data.enabled)} enabled. New items arrive on their regular schedules.`}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {unavailable && <Button asChild variant="outline" size="sm"><Link href="/platform/system-health">Check setup</Link></Button>}
            {idle ? !selectionActive && <Button size="sm" aria-label="Enable all sources" disabled={!canChange || unavailable || data?.total === 0} onClick={() => collection.review({ action: 'enable', scope: 'all' })}><span className="sm:hidden">Enable all</span><span className="hidden sm:inline">Enable all sources</span><ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>
                : data && <Button variant="outline" size="sm" disabled={!canChange || (Boolean(paused) && unavailable)} onClick={() => collection.setPaused(!paused)}>
                    {collection.working === 'collection' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : paused ? <Play className="mr-2 h-3.5 w-3.5" /> : <Pause className="mr-2 h-3.5 w-3.5" />}{paused ? 'Resume updates' : 'Pause updates'}
                </Button>}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More collection options" disabled={collection.busy}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                {!idle && <DropdownMenuItem disabled={!canChange || unavailable} onClick={() => collection.review({ action: 'enable', scope: 'all' })}>Enable all available sources</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => collection.setConnectionsOpen(true)}>Connections</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>
        </div>
    </section>;
}

export function NewsCollectionDialogs({ collection }: { collection: NewsCollectionManagement }) {
    const { preview } = collection;
    const data = collection.status.data;
    const environment = data?.environment ? data.environment.charAt(0).toUpperCase() + data.environment.slice(1) : 'this environment';
    const sources = preview?.snapshot.sources ?? [];
    const changed = sources.filter(source => source.outcome.startsWith('will_')).length;
    const excluded = sources.filter(source => source.outcome === 'needs_configuration');
    const blocked = preview?.action === 'enable' && !preview.snapshot.readiness.ready;
    const enable = preview?.action === 'enable';
    const retryUnknown = Boolean(collection.reviewError?.uncertain);
    const needRefresh = collection.expired && !retryUnknown || Boolean(collection.reviewError && !retryUnknown);
    const outcomeLabels: Record<string, string> = { will_enable: 'Enable', will_disable: 'Disable', will_schedule: 'Restore updates', already_enabled: 'Already enabled', already_disabled: 'Already disabled', needs_configuration: 'Connection needed' };
    const issueGroups = new Map<string, number>();
    for (const source of excluded) issueGroups.set(source.reason ?? '', (issueGroups.get(source.reason ?? '') ?? 0) + 1);
    return <>
        <Dialog open={collection.reviewOpen} onOpenChange={open => { if (!open) collection.closeReview(); }}>
            <DialogContent closeLabel="Close review" className="max-h-[85dvh] overflow-y-auto p-0 sm:max-w-[460px]">
                <div className="space-y-5 px-6 pb-5 pt-6">
                    <DialogHeader><DialogTitle>{collection.preparing || !preview ? 'Review sources' : blocked ? 'News updates need attention' : changed === 0 ? excluded.length ? 'No sources are ready to enable' : 'Sources are up to date' : `${enable ? 'Enable' : 'Disable'} ${plural(changed)}?`}</DialogTitle>
                        <DialogDescription>{preview && !blocked ? changed === 0 ? excluded.length ? 'Connect these sources before enabling updates.' : 'There are no changes to make.' : enable ? preview.snapshot.readiness.paused ? 'These sources will be enabled. Updates will stay paused.' : `Enable automatic updates for ${preview.snapshot.scope === 'all' ? 'all ready sources' : 'your selected sources'} in ${environment}.` : 'They’ll stop receiving new updates. Existing news stays available.' : 'Check the sources before making a change.'}</DialogDescription></DialogHeader>
                    {collection.preparing && <div role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking available sources…</div>}
                    {blocked && <div role="alert" className="space-y-2 text-sm">{preview?.snapshot.readiness.blockers.map(reason => <p key={reason}>{newsCollectionExplanation(reason)}</p>)}<Link className="inline-flex items-center gap-1 text-primary underline underline-offset-4" href="/platform/system-health">Check setup<ArrowRight className="h-3.5 w-3.5" /></Link></div>}
                    {excluded.length > 0 && <div className="border-l-2 border-warning/60 pl-3 text-sm"><p className="font-medium">{plural(excluded.length)} will stay disabled</p>{Array.from(issueGroups).map(([reason]) => <p key={reason} className="mt-1 text-muted-foreground">{newsCollectionExplanation(reason)}</p>)}<button type="button" className="mt-2 text-sm underline underline-offset-4" onClick={() => collection.setConnectionsOpen(true)}>Connection help</button></div>}
                    {sources.length > 0 && <details className="group text-sm"><summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground">View {plural(sources.length)}<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary><ul className="mt-3 max-h-48 divide-y overflow-auto">{sources.map(source => <li key={source.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate" dir="auto">{source.name}</span><span className="shrink-0 text-xs text-muted-foreground">{outcomeLabels[source.outcome] ?? 'Unavailable'}</span></li>)}</ul></details>}
                    {collection.reviewError && <p role="alert" className="text-sm text-destructive">{collection.reviewError.text}{retryUnknown && ' Retry to confirm the result; your change will not be duplicated.'}</p>}
                    {collection.expired && !retryUnknown && <p role="status" className="text-sm text-muted-foreground">This review is out of date. Refresh it to continue.</p>}
                </div>
                <DialogFooter className="border-t px-6 py-4">
                    <Button variant="ghost" disabled={collection.applying} onClick={collection.closeReview}>{preview && changed === 0 ? excluded.length ? 'Close' : 'Done' : 'Cancel'}</Button>
                    {preview && changed === 0 && excluded.length ? <Button disabled={collection.preparing} onClick={collection.refreshReview}>Check again</Button> : preview && changed === 0 ? null : needRefresh ? <Button disabled={collection.preparing} onClick={collection.refreshReview}>Refresh review</Button> : <Button disabled={collection.preparing || collection.applying || !preview || Boolean(blocked) || changed === 0 || !data?.can_manage} onClick={collection.applyReview}>
                        {collection.applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{collection.preparing || !preview ? 'Checking…' : `${retryUnknown ? 'Retry: ' : ''}${enable ? 'Enable' : 'Disable'} ${plural(changed)}`}
                    </Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Sheet open={collection.connectionsOpen} onOpenChange={collection.setConnectionsOpen}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>Source connections</SheetTitle><SheetDescription>Connections are configured separately for each environment.</SheetDescription></SheetHeader><div className="mt-6 space-y-5">{data?.configuration_issues?.length ? Array.from(new Set(data.configuration_issues.map(issue => issue.reason))).map(reason => <div key={reason}><p className="text-sm font-medium">{newsCollectionExplanation(reason)}</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{data.configuration_issues?.filter(issue => issue.reason === reason).map(issue => <li key={issue.id} dir="auto">{issue.name}</li>)}</ul></div>) : <p className="text-sm text-muted-foreground">{collection.status.isError ? 'Connections could not be checked. Refresh to try again.' : 'No connection issues were reported.'}</p>}<p className="text-sm text-muted-foreground">Add the required connection credentials to this environment’s configuration. Restart the environment to load them, then refresh this check.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => collection.status.refetch()}>Refresh connections</Button><Button size="sm" variant="ghost" asChild><Link href="/platform/database-migrations">View environment<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></div></div></SheetContent></Sheet>
    </>;
}

export function NewsCollectionOverview() {
    const status = useQuery({ queryKey: newsCollectionKey, queryFn: getNewsCollection, staleTime: 15_000 });
    const data = status.data;
    return <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div><span className="font-medium">News sources</span><span className="ml-3 text-muted-foreground">{!data ? 'Checking updates…' : data.readiness.paused ? 'Updates paused' : data.enabled ? `${plural(data.enabled)} enabled` : 'No sources enabled'}</span></div>
        <Link className="inline-flex items-center gap-1.5 font-medium hover:underline" href="/platform/news/sources">{data?.enabled ? 'Manage sources' : 'Set up sources'}<ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>;
}
