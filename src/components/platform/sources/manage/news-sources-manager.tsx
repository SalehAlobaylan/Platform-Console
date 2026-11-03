'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNewsSources, useProfiles } from '@/hooks/use-discovery';
import { useSourceManagement } from '@/components/platform/sources/shared/use-source-management';
import { SourceManagementDialogs } from '@/components/platform/sources/shared/source-management-dialogs';
import { SourceActionMenu } from '@/components/platform/sources/shared/source-action-menu';
import { SourceAvatar } from '@/components/platform/sources/shared/source-avatar';
import { NewsSectionNav } from '@/components/platform/news/news-section-nav';
import { domainOf, newsSourceHealth } from '@/lib/sources/news-health';
import { formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { SOURCE_TYPE_LABELS, type ContentSource, type SourceType } from '@/types/platform/source';
import { NewsCollectionControls, NewsCollectionDialogs, useNewsCollectionManagement } from './news-collection-controls';

import { NewsActivityRail } from './news-activity-rail';

type View = 'all' | 'enabled' | 'attention';
type Sort = 'name' | 'checked' | 'items';
const relative = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? formatDistanceToNow(new Date(value), { addSuffix: true }) : null;

export function NewsSourcesManager({ onBusyChange, returnTo, standalone = false }: { onBusyChange: (busy: boolean) => void; returnTo: string; standalone?: boolean }) {
    const news = useNewsSources();
    const profiles = useProfiles();
    const sources = useMemo(() => news.data?.data ?? [], [news.data]);
    const [legacyBusy, setLegacyBusy] = useState(false);
    const mgmt = useSourceManagement({ sources: sources as unknown as ContentSource[], refetch: news.refetch, onBusyChange: setLegacyBusy });
    const { clear: clearSelection } = mgmt;
    const { refetch: refetchSources } = news;
    const changed = useCallback(() => { clearSelection(); void refetchSources(); }, [clearSelection, refetchSources]);
    const collection = useNewsCollectionManagement(changed);
    const busy = mgmt.bulkBusy || collection.busy;
    useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
    const [view, setView] = useState<View>('all');
    const [search, setSearch] = useState('');
    const [provider, setProvider] = useState('all');
    const [interest, setInterest] = useState('all');
    const [sort, setSort] = useState<Sort>('name');
    const [ascending, setAscending] = useState(true);
    const data = collection.status.data;
    const issues = useMemo(() => new Map(data?.configuration_issues?.map(issue => [issue.id, issue]) ?? []), [data?.configuration_issues]);
    const attention = useMemo(() => new Set(sources.filter(source => issues.has(source.id) || newsSourceHealth(source).status === 'stale').map(source => source.id)), [sources, issues]);
    const enabled = sources.filter(source => source.is_active).length;
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return sources.filter(source => (view !== 'enabled' || source.is_active) && (view !== 'attention' || attention.has(source.id))
            && (provider === 'all' || source.type === provider) && (interest === 'all' || source.discovery_profile_id === interest)
            && (!query || `${source.name} ${source.feed_url ?? ''}`.toLocaleLowerCase().includes(query)))
            .sort((a, b) => {
                let result = sort === 'name' ? a.name.localeCompare(b.name) : sort === 'items' ? a.items_count - b.items_count : new Date(a.last_attempted_at ?? 0).getTime() - new Date(b.last_attempted_at ?? 0).getTime();
                if (!ascending) result *= -1;
                return result;
            });
    }, [sources, search, view, provider, interest, sort, ascending, attention]);
    useEffect(() => { clearSelection(); }, [search, view, provider, interest, clearSelection]);
    const ids = filtered.map(source => source.id);
    const selectedCount = ids.filter(id => mgmt.selected.has(id)).length;
    const headerChecked = selectedCount === 0 ? false : selectedCount === ids.length ? true : 'indeterminate';
    const canManage = data?.can_manage === true;
    const addHref = `/platform/sources/new?category=news&from=${encodeURIComponent(returnTo)}`;
    const filterCount = Number(provider !== 'all') + Number(interest !== 'all');
    const providerTypes = Array.from(new Set(sources.map(source => source.type))).sort();
    const sortBy = (field: Sort) => { if (sort === field) setAscending(value => !value); else { setSort(field); setAscending(field === 'name'); } };
    const sortIcon = (field: Sort) => sort === field ? ascending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />;
    const reset = () => { setView('all'); setSearch(''); setProvider('all'); setInterest('all'); };
    const showAttention = () => { reset(); setView('attention'); };
    const connectionCount = data?.configuration_issues?.length ?? data?.needs_configuration ?? 0;
    const connectionTypes = Array.from(new Set(data?.configuration_issues?.map(issue => issue.type) ?? []));
    const connectionUnknown = data?.configuration_issues?.every(issue => ['provider_readiness_unavailable', 'enrichment_unavailable'].includes(issue.reason));
    const issueTitle = connectionUnknown ? 'Connection checks are incomplete' : connectionTypes.length === 1 && connectionTypes[0] === 'TELEGRAM' ? `${connectionCount} source${connectionCount === 1 ? ' needs' : 's need'} a Telegram connection` : `${connectionCount} source${connectionCount === 1 ? ' needs' : 's need'} attention`;
    const noSources = !news.isLoading && !news.isError && sources.length === 0;

    return <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
            <div>
                {standalone && <h1 className="font-editorial text-2xl font-semibold tracking-tight sm:text-3xl">News sources</h1>}
                <p className={cn('text-sm text-muted-foreground', standalone && 'mt-2')}>{news.isLoading && !sources.length ? 'Loading sources…' : `${sources.length} sources`}{data?.environment && <><span className="mx-2 text-muted-foreground/40">/</span><span className="capitalize">{data.environment}</span></>}</p>
            </div>
            {busy || !canManage ? <Button variant="outline" size="sm" disabled><Plus className="mr-2 h-3.5 w-3.5" />Add source</Button> : <Button asChild variant="outline" size="sm"><Link href={addHref}><Plus className="mr-2 h-3.5 w-3.5" />Add source</Link></Button>}
        </div>
        {standalone && <NewsSectionNav />}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_3rem]">
        <NewsActivityRail status={collection.status} />
        <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
        <NewsCollectionControls collection={collection} disabled={legacyBusy || mgmt.selected.size > 0} selectionActive={mgmt.selected.size > 0} />
        {connectionCount > 0 && <button type="button" aria-label={`View ${connectionCount} sources needing a connection`} className="flex w-full items-center justify-between gap-3 text-left text-sm transition-colors hover:text-foreground/70" onClick={showAttention}>
            <span className="flex items-center gap-2.5"><AlertCircle className="h-4 w-4 shrink-0 text-warning" /><span>{issueTitle}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>}
        {collection.directError && <div role="alert" className="flex flex-wrap items-center gap-3 border-l-2 border-destructive pl-3 text-sm"><p className="flex-1">{collection.directError}</p><Button size="sm" variant="outline" disabled={busy} onClick={collection.retry}>Retry</Button><button type="button" aria-label="Dismiss error" onClick={collection.clearError}><X className="h-4 w-4" /></button></div>}

        <div className="min-h-10">
            {mgmt.selected.size > 0 ? <div role="toolbar" aria-label="Selected sources" className="flex min-h-10 flex-wrap items-center gap-2">
                <button type="button" aria-label="Clear selection" className="mr-1 rounded p-1 hover:bg-muted" disabled={busy} onClick={mgmt.clear}><X className="h-4 w-4" /></button>
                <span className="mr-auto text-sm font-medium">{mgmt.selected.size} selected</span>
                <Button size="sm" disabled={busy || !canManage || !data?.readiness.ready || !sources.some(source => mgmt.selected.has(source.id) && (!source.is_active || !source.next_due_at) && !issues.has(source.id))} onClick={() => collection.review({ action: 'enable', scope: 'selected', ids: [...mgmt.selected] })}>Enable selected</Button>
                <Button size="sm" variant="outline" disabled={busy || !canManage || !mgmt.selectedSources.some(source => source.is_active)} onClick={() => collection.review({ action: 'disable', scope: 'selected', ids: [...mgmt.selected] })}>Disable selected</Button>
                <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" disabled={busy} aria-label="More selected source actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={!canManage} onClick={mgmt.actions.runSelected}>Run once</DropdownMenuItem>
                    <DropdownMenuItem disabled={!canManage} onClick={mgmt.actions.openChangeInterval}>Change update interval</DropdownMenuItem>
                    <DropdownMenuSeparator /><DropdownMenuItem disabled={!canManage} onClick={mgmt.actions.moveSelectedToMedia}>Move to Media</DropdownMenuItem>
                    <DropdownMenuItem disabled={!canManage} className="text-destructive" onClick={mgmt.actions.openBulkDelete}>Delete selected</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu>
            </div> : <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex items-center gap-5" aria-label="Source views">{([{ key: 'all', label: 'All sources', count: sources.length }, { key: 'enabled', label: 'Enabled', count: enabled }, { key: 'attention', label: 'Needs attention', count: attention.size }] as const).map(tab => <button type="button" key={tab.key} aria-pressed={view === tab.key} onClick={() => setView(tab.key)} className={cn('border-b-2 py-2 text-sm transition-colors', view === tab.key ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab.label}<span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{tab.count}</span></button>)}</div>
                <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[240px]"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search sources" placeholder="Search sources…" value={search} onChange={event => setSearch(event.target.value)} className="h-9 bg-transparent pl-8 text-sm" /></div>
                <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-9 gap-2" aria-label="Filter sources"><SlidersHorizontal className="h-3.5 w-3.5" />Filters{filterCount > 0 && <span className="text-xs text-muted-foreground">({filterCount})</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuSub><DropdownMenuSubTrigger>Source type</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={provider} onValueChange={setProvider}><DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>{providerTypes.map(type => <DropdownMenuRadioItem key={type} value={type}>{SOURCE_TYPE_LABELS[type as SourceType] ?? type}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>
                    <DropdownMenuSub><DropdownMenuSubTrigger>Interest</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={interest} onValueChange={setInterest}><DropdownMenuRadioItem value="all">All interests</DropdownMenuRadioItem>{profiles.data?.data?.map(profile => <DropdownMenuRadioItem key={profile.id} value={profile.id}>{profile.name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>
                    {filterCount > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => { setProvider('all'); setInterest('all'); }}>Clear filters</DropdownMenuItem></>}
                </DropdownMenuContent></DropdownMenu>
            </div>}
        </div>
        {(filterCount > 0 || search) && <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{filtered.length} matching source{filtered.length === 1 ? '' : 's'}</span><button type="button" className="underline underline-offset-4" onClick={() => { setSearch(''); setProvider('all'); setInterest('all'); }}>Clear filters</button></div>}

        <div className="overflow-x-auto border-y">
            <Table className="w-full table-fixed [&_td]:px-3 [&_th]:px-3">
                <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-3"><Checkbox aria-label={`Select all ${filtered.length} matching sources`} checked={headerChecked} disabled={busy || filtered.length === 0} onCheckedChange={checked => mgmt.toggleMany(ids, Boolean(checked))} /></TableHead>
                    <TableHead><button className="flex items-center gap-2 py-3 text-xs" onClick={() => sortBy('name')}>Source{sortIcon('name')}</button></TableHead>
                    <TableHead className="w-20 text-xs sm:w-28">Enabled</TableHead>
                    <TableHead className="hidden w-40 md:table-cell"><button className="flex items-center gap-2 text-xs" onClick={() => sortBy('checked')}>Last check{sortIcon('checked')}</button></TableHead>
                    <TableHead className="hidden w-20 text-right sm:table-cell"><button className="ml-auto flex items-center gap-2 text-xs" onClick={() => sortBy('items')}>Items{sortIcon('items')}</button></TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {news.isLoading && !sources.length ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="my-2 h-10 w-full" /></TableCell></TableRow>)
                        : news.isError ? <TableRow><TableCell colSpan={6} className="py-12 text-center"><p className="text-sm">Sources couldn’t be loaded.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => news.refetch()}>Try again</Button></TableCell></TableRow>
                        : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="py-14 text-center"><p className="text-sm font-medium">{noSources ? 'Add your first News source' : 'No matching sources'}</p><p className="mt-1 text-sm text-muted-foreground">{noSources ? 'Add a feed or discover sources from your interests.' : 'Try a different search or clear the filters.'}</p>{!noSources && <Button className="mt-3" size="sm" variant="ghost" onClick={reset}>Show all sources</Button>}</TableCell></TableRow>
                        : filtered.map(source => {
                            const issue = issues.get(source.id);
                            const health = newsSourceHealth(source);
                            const checking = collection.working === source.id;
                            const canEnable = !issue && data?.readiness.ready;
                            const checkTime = relative(source.last_attempted_at ?? source.last_provider_success_at);
                            return <TableRow key={source.id} data-state={mgmt.selected.has(source.id) ? 'selected' : undefined} className="group">
                                <TableCell className="pl-3"><Checkbox checked={mgmt.selected.has(source.id)} aria-label={`Select ${source.name}`} disabled={busy} onCheckedChange={() => mgmt.toggleOne(source.id)} /></TableCell>
                                <TableCell className="py-3"><div className="flex min-w-0 items-center gap-3">
                                    <SourceAvatar source={{ ...source, name: source.name.replace(/^@/, '') } as unknown as ContentSource} className="hidden h-9 w-9 rounded-md bg-muted/60 text-sm text-foreground sm:inline-flex" />
                                    <div className="min-w-0 flex-1"><Link className="block max-w-full truncate text-left text-sm font-medium hover:underline sm:max-w-[350px]" dir="auto" href={`/platform/sources/${source.id}?from=${encodeURIComponent(returnTo)}`}>{source.name}</Link>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{SOURCE_TYPE_LABELS[source.type as SourceType] ?? source.type}{domainOf(source.feed_url) && <><span className="mx-1.5 text-muted-foreground/40">·</span>{domainOf(source.feed_url)}</>}</p>
                                        {issue && <button type="button" onClick={() => collection.setConnectionsOpen(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-warning hover:underline"><AlertCircle className="h-3 w-3" />{issue.reason === 'telegram_not_configured' || issue.reason === 'twitter_api_not_configured' ? 'Connection needed' : 'Needs attention'}</button>}
                                    </div>
                                </div></TableCell>
                                <TableCell><div className="flex items-center gap-2"><Switch className="after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']" checked={source.is_active} aria-label={`Enable ${source.name}`} disabled={busy || !canManage || (!source.is_active && !canEnable)} onCheckedChange={active => collection.setSource(source.id, active)} />{checking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}</div></TableCell>
                                <TableCell className="hidden text-sm md:table-cell"><p className={cn('text-xs', health.status === 'stale' ? 'text-warning' : 'text-muted-foreground')}>{health.status === 'new' ? 'Not checked yet' : health.status === 'unknown' ? 'Result pending' : health.status === 'stale' ? 'Needs attention' : 'Successful'}</p>{checkTime && <p className="mt-1 text-xs text-muted-foreground">{checkTime}</p>}</TableCell>
                                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">{formatNumber(source.items_count)}</TableCell>
                                <TableCell><SourceActionMenu source={source as unknown as ContentSource} returnTo={returnTo} onRequestDelete={mgmt.requestDelete} onChanged={changed} disabled={busy || !canManage} hideActivation /></TableCell>
                            </TableRow>;
                        })}
                </TableBody>
            </Table>
        </div>
        </div>
        </div>
        <SourceManagementDialogs dialogs={mgmt.dialogs} />
        <NewsCollectionDialogs collection={collection} />
    </div>;
}
