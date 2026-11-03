'use client';

import { useEffect, useMemo, useState } from 'react';
import { newsSourceHealth } from '@/lib/sources/news-health';
import { useQueryClient } from '@tanstack/react-query';
import {
    Plus, Play, Pencil, Trash2, Loader2, Radar, Check, X, Eye, Lightbulb, Filter,
    CheckCircle2, ChevronRight, Network,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useRunSource, useDeleteSource } from '@/hooks/use-sources';
import { usePreviewSource } from '@/hooks/use-source-preview';
import { SourceRowActions } from '@/components/platform/sources/list/source-row-actions';
import { PreviewTable } from '@/components/platform/sources/wizard/preview-table';
import type { ContentSource } from '@/types/platform/source';
import {
    useProfiles,
    useNewsSources,
    useSuggestions,
    useRunProfile,
    useDeleteProfile,
    useCreateProfile,
    useSuggestProfiles,
    useApproveSuggestion,
    useRejectSuggestion,
    useBulkApprove,
    useBulkReject,
    useDiscoveryConfig,
    useAuthorities,
    discoveryKeys,
} from '@/hooks/use-discovery';
import type { DiscoveryProfile, NewsSource, SourceSuggestion } from '@/types/platform/discovery';
import { NewsSectionNav } from '@/components/platform/news/news-section-nav';
import { ProfileDialog } from './profile-dialog';
import { ClassBadge, ClassFilter, sourceClassOf, type SourceClass } from './source-class-badge';
import { DiscoverySettingsDialog } from './discovery-settings-dialog';
import { DiscoveryEnginePanel } from './discovery-engine-panel';
import { TwitterCard } from './twitter-card';

const ALL = '__all__';
const LOW_RELEVANCE = 0.1;

function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeAgo(iso?: string | null): string {
    if (!iso) return 'never';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return '—';
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function domainOf(url?: string): string {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Cross-Arabic-news cosine peaks ~0.25, so map relevance onto a friendly,
// labeled strength meter rather than showing a confusing low raw number.
function relevanceMeta(r?: number | null): {
    label: string;
    variant: 'success' | 'info' | 'warning' | 'secondary';
    bar: string;
    pct: number;
} {
    if (r == null) return { label: 'Unscored', variant: 'secondary', bar: 'bg-muted-foreground/30', pct: 0 };
    const pct = Math.max(6, Math.min(100, Math.round((r / 0.25) * 100)));
    if (r >= 0.18) return { label: 'Strong match', variant: 'success', bar: 'bg-success', pct };
    if (r >= 0.12) return { label: 'Good match', variant: 'info', bar: 'bg-info', pct };
    if (r >= 0.07) return { label: 'Fair match', variant: 'warning', bar: 'bg-warning', pct };
    return { label: 'Weak match', variant: 'secondary', bar: 'bg-muted-foreground/40', pct };
}

export function FindingPage() {
    const qc = useQueryClient();
    const { data: profilesData, isLoading: profilesLoading } = useProfiles();
    const profiles = profilesData?.data ?? [];
    const { data: discoveryConfig } = useDiscoveryConfig();

    const [selected, setSelected] = useState<string>(ALL);
    const [tab, setTab] = useState<'review' | 'sources' | 'network'>('review');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<DiscoveryProfile | null>(null);
    const [hideLow, setHideLow] = useState(false);
    const [classFilter, setClassFilter] = useState<SourceClass | 'all'>('all');
    const [previewTarget, setPreviewTarget] = useState<SourceSuggestion | null>(null);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Fetch ALL pending suggestions + ALL news sources once, then derive the
    // per-profile views + rail counts client-side.
    const { data: suggestionsData, isLoading: suggestionsLoading } = useSuggestions(undefined, 'PENDING');
    const { data: sourcesData, isLoading: sourcesLoading } = useNewsSources(undefined);
    const allSuggestions = useMemo(() => suggestionsData?.data ?? [], [suggestionsData]);
    const allSources = useMemo(() => sourcesData?.data ?? [], [sourcesData]);

    const suggCountByProfile = useMemo(() => {
        const m: Record<string, number> = {};
        for (const s of allSuggestions) if (s.profile_id) m[s.profile_id] = (m[s.profile_id] ?? 0) + 1;
        return m;
    }, [allSuggestions]);
    const srcCountByProfile = useMemo(() => {
        const m: Record<string, number> = {};
        for (const s of allSources) if (s.discovery_profile_id) m[s.discovery_profile_id] = (m[s.discovery_profile_id] ?? 0) + 1;
        return m;
    }, [allSources]);

    const selectedProfile = profiles.find((p) => p.id === selected) ?? null;
    const lowThreshold = discoveryConfig?.min_relevance ?? LOW_RELEVANCE;

    const scopedBase = useMemo(
        () => (selected === ALL ? allSuggestions : allSuggestions.filter((s) => s.profile_id === selected)),
        [allSuggestions, selected],
    );
    const classCounts = useMemo(() => {
        const m: Partial<Record<SourceClass | 'all', number>> = { all: scopedBase.length };
        for (const s of scopedBase) {
            const c = sourceClassOf(s);
            if (c) m[c] = (m[c] ?? 0) + 1;
        }
        return m;
    }, [scopedBase]);
    const scopedSuggestions = useMemo(() => {
        let filtered = hideLow ? scopedBase.filter((s) => (s.relevance_score ?? 1) >= lowThreshold) : scopedBase;
        if (classFilter !== 'all') filtered = filtered.filter((s) => sourceClassOf(s) === classFilter);
        return [...filtered].sort((a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1));
    }, [scopedBase, hideLow, lowThreshold, classFilter]);
    const scopedSources = useMemo(
        () => (selected === ALL ? allSources : allSources.filter((s) => s.discovery_profile_id === selected)),
        [allSources, selected]
    );

    const runProfile = useRunProfile();
    const deleteProfile = useDeleteProfile();
    const approve = useApproveSuggestion();
    const reject = useRejectSuggestion();
    const bulkApprove = useBulkApprove();
    const bulkReject = useBulkReject();

    const deleteSourceHook = useDeleteSource();
    const handleDeleteSource = (id: string, name: string) => {
        if (!confirm(`Remove source "${name}"?`)) return;
        deleteSourceHook.mutate(id, { onSuccess: () => qc.invalidateQueries({ queryKey: [...discoveryKeys.all, 'sources'] }) });
    };

    const pendingIds = useMemo(() => scopedSuggestions.map((s) => s.id), [scopedSuggestions]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <span className="brand-overline text-news">News Center</span>
                    <h1 className="font-editorial text-3xl font-bold tracking-tight">Feeds Finding</h1>
                    <p className="text-muted-foreground">Define interests, discover sources, and review suggestions.</p>
                </div>
                <Button className="flex-shrink-0" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New interest
                </Button>
            </div>

            <NewsSectionNav />

            {/* Discovery control bar — slim automation/intelligence strip */}
            <DiscoveryEnginePanel
                pending={allSuggestions.length}
                sources={allSources.length}
                interests={profiles.length}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            {/* First-run / empty state */}
            {!profilesLoading && profiles.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="rounded-full bg-news/10 p-3 text-news"><Radar className="h-7 w-7" /></div>
                        <div>
                            <h3 className="text-lg font-semibold">Start discovering sources</h3>
                            <p className="mx-auto max-w-md text-sm text-muted-foreground">
                                Create an interest (e.g. “Saudi economy”) with a few keywords. Wahb hunts the web for
                                matching Arabic news feeds and ranks them pods to approve.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> New interest
                            </Button>
                            <Button variant="outline" onClick={() => setSuggestOpen(true)}>
                                <Lightbulb className="mr-2 h-4 w-4" /> Suggest from stories
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
                    {/* Interests rail */}
                    <aside className="space-y-1.5">
                        <RailItem
                            label="All interests"
                            active={selected === ALL}
                            pending={allSuggestions.length}
                            sources={allSources.length}
                            onClick={() => setSelected(ALL)}
                        />
                        {profilesLoading && <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>}
                        {profiles.map((p) => (
                            <RailItem
                                key={p.id}
                                label={p.name}
                                active={selected === p.id}
                                pending={suggCountByProfile[p.id] ?? 0}
                                sources={srcCountByProfile[p.id] ?? 0}
                                disabled={!p.enabled}
                                onClick={() => setSelected(p.id)}
                            />
                        ))}
                        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground" onClick={() => setSuggestOpen(true)}>
                            <Lightbulb className="mr-2 h-4 w-4" /> Suggest from stories
                        </Button>
                    </aside>

                    {/* Main */}
                    <div className="space-y-4">
                        {/* Selected interest header — Review/Sources are interest-scoped;
                            Network is global so the header is hidden there. */}
                        {selectedProfile && tab !== 'network' && (
                            <Card>
                                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                                    <div className="mr-auto min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="truncate text-lg font-semibold">{selectedProfile.name}</h2>
                                            {!selectedProfile.enabled && <Badge variant="secondary">disabled</Badge>}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {selectedProfile.keywords.slice(0, 6).map((k) => (
                                                <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{k}</span>
                                            ))}
                                            <span className="px-1 text-xs text-muted-foreground">· last run {timeAgo(selectedProfile.last_run_at)}</span>
                                        </div>
                                    </div>
                                    <Button onClick={() => runProfile.mutate(selectedProfile.id)} disabled={runProfile.isPending}>
                                        {runProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Run discovery
                                    </Button>
                                    <Button variant="outline" size="icon" title="Edit" onClick={() => { setEditing(selectedProfile); setDialogOpen(true); }}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        title="Delete"
                                        onClick={() => {
                                            if (confirm(`Delete interest "${selectedProfile.name}"? Its sources stay, just ungrouped.`)) {
                                                deleteProfile.mutate(selectedProfile.id);
                                                setSelected(ALL);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Tabs */}
                        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                            <TabsList>
                                <TabsTrigger value="review">
                                    Review
                                    {scopedSuggestions.length > 0 && <CountBadge className="ml-2">{scopedSuggestions.length}</CountBadge>}
                                </TabsTrigger>
                                <TabsTrigger value="sources">
                                    Sources
                                    {scopedSources.length > 0 && <span className="ml-2 text-muted-foreground">{scopedSources.length}</span>}
                                </TabsTrigger>
                                <TabsTrigger value="network">Network</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {tab === 'review' && (
                            <div className="space-y-3">
                                {scopedBase.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button size="sm" variant={hideLow ? 'default' : 'outline'} onClick={() => setHideLow((v) => !v)}>
                                                <Filter className="mr-1 h-3.5 w-3.5" />
                                                {hideLow ? 'Showing strong only' : 'Hide weak matches'}
                                            </Button>
                                            <ClassFilter value={classFilter} onChange={setClassFilter} counts={classCounts} />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => bulkApprove.mutate(pendingIds)} disabled={bulkApprove.isPending || pendingIds.length === 0}>
                                                <Check className="mr-1 h-3.5 w-3.5" /> Approve all
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => bulkReject.mutate(pendingIds)} disabled={bulkReject.isPending || pendingIds.length === 0}>
                                                Dismiss all
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {suggestionsLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}

                                {!suggestionsLoading && scopedBase.length > 0 && scopedSuggestions.length === 0 && (
                                    <p className="py-8 text-center text-sm text-muted-foreground">No sources in this filter.</p>
                                )}

                                {!suggestionsLoading && scopedBase.length === 0 && (
                                    <Card>
                                        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                                            <CheckCircle2 className="h-8 w-8 text-success" />
                                            <p className="font-medium">Nothing to review</p>
                                            <p className="text-sm text-muted-foreground">
                                                {selectedProfile ? 'Run discovery to find new sources for this interest.' : 'All caught up — approved or dismissed everything.'}
                                            </p>
                                            {selectedProfile && (
                                                <Button className="mt-1" onClick={() => runProfile.mutate(selectedProfile.id)} disabled={runProfile.isPending}>
                                                    <Play className="mr-2 h-4 w-4" /> Run discovery
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                    {scopedSuggestions.map((s) => (
                                        <SuggestionCard
                                            key={s.id}
                                            suggestion={s}
                                            onApprove={() => approve.mutate(s.id)}
                                            onReject={() => reject.mutate({ id: s.id })}
                                            onPreview={() => setPreviewTarget(s)}
                                            busy={approve.isPending || reject.isPending}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === 'sources' && (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Source</TableHead>
                                            <TableHead className="text-right">Items</TableHead>
                                            <TableHead className="text-right">Failed</TableHead>
                                            <TableHead>Last item</TableHead>
                                            <TableHead>Collection / health</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sourcesLoading && (
                                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                                        )}
                                        {!sourcesLoading && scopedSources.length === 0 && (
                                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No sources in this interest yet. Approve a suggestion to add one.</TableCell></TableRow>
                                        )}
                                        {scopedSources.map((s) => (
                                            <ActiveSourceRow key={s.id} source={s} onDelete={() => handleDeleteSource(s.id, s.name)} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {tab === 'network' && (
                            <div className="space-y-4">
                                <NetworkAuthorities />
                                <TwitterCard />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ProfileDialog open={dialogOpen} onClose={() => setDialogOpen(false)} profile={editing} />
            {previewTarget && <PreviewDialog suggestion={previewTarget} onClose={() => setPreviewTarget(null)} />}
            {suggestOpen && <SuggestProfilesDialog onClose={() => setSuggestOpen(false)} />}
            <DiscoverySettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
}

// NetworkAuthorities — the "top voices in your network" insight (PageRank
// authorities across RSS/Telegram/X), relocated from the engine panel into the
// Network tab. Null when the graph hasn't surfaced any valid authorities yet.
function NetworkAuthorities() {
    const { data } = useAuthorities();
    const top = (data?.data ?? []).filter((a) => a.feed_valid).slice(0, 8);
    if (top.length === 0) return null;
    return (
        <Card>
            <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Network className="h-3.5 w-3.5 text-news" /> Top voices in your network
                </span>
                {top.map((a) => (
                    <span
                        key={`${a.kind ?? ''}:${a.domain}`}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs"
                        title={`authority ${a.authority}`}
                    >
                        {a.kind === 'twitter' ? '@' : ''}
                        {a.domain}
                    </span>
                ))}
            </CardContent>
        </Card>
    );
}

function CountBadge({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-news px-1.5 text-xs font-medium text-news-foreground', className)}>
            {children}
        </span>
    );
}

function RailItem({ label, active, pending, sources, disabled, onClick }: {
    label: string; active: boolean; pending: number; sources: number; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors',
                active ? 'border-news/40 bg-news/5' : 'border-transparent hover:bg-muted'
            )}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className={cn('truncate text-sm', active && 'font-medium', disabled && 'text-muted-foreground')}>{label}</span>
                    {disabled && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" title="disabled" />}
                </div>
                <span className="text-xs text-muted-foreground">{sources} source{sources === 1 ? '' : 's'}</span>
            </div>
            {pending > 0 && <CountBadge className="shrink-0">{pending}</CountBadge>}
            <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')} />
        </button>
    );
}

function provenanceLabel(via?: string): string {
    if (via === 'x-retweet') return 'Retweeted by your network';
    if (via === 'x-quote') return 'Quoted by your network';
    if (via === 'x-mention' || via === 'x-graph') return 'Mentioned by your network';
    if (via === 'telegram-forward') return 'From your channels';
    if (via === 'telegram-mention') return 'Mentioned by your network';
    if (via === 'telegram-graph' || via === 'telegram-search') return 'From your channels';
    if (via === 'graph' || via === 'corpus' || via === 'linkgraph') return 'From your network';
    if (via === 'tavily' || via === 'crawl' || via === 'auto') return 'Web search';
    return '';
}

function formatSubscribers(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

function EvidenceLine({ suggestion }: { suggestion: SourceSuggestion }) {
    const ev = suggestion.evidence;
    const prov = provenanceLabel(suggestion.discovered_via);
    const facts: string[] = [];
    if (ev?.subscribers) facts.push(`${formatSubscribers(ev.subscribers)} subscribers`);
    if (ev?.citation_count) facts.push(`Cited ${ev.citation_count}×`);
    if (ev?.cocitation_count) facts.push(`Linked by ${ev.cocitation_count} source${ev.cocitation_count === 1 ? '' : 's'}`);
    if (typeof ev?.authority === 'number' && ev.authority > 0) facts.push(`Authority ${ev.authority.toFixed(2)}`);
    if (ev?.trend === 'rising') facts.push('↑ Rising');
    if (!prov && facts.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {prov && (
                <span className="inline-flex items-center gap-1 rounded bg-news/10 px-1.5 py-0.5 text-news">
                    <Network className="h-3 w-3" /> {prov}
                </span>
            )}
            {facts.map((f, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5">{f}</span>
            ))}
        </div>
    );
}

function SuggestionCard({ suggestion, onApprove, onReject, onPreview, busy }: {
    suggestion: SourceSuggestion; onApprove: () => void; onReject: () => void; onPreview: () => void; busy: boolean;
}) {
    const sample = suggestion.sample_items ?? [];
    const rel = relevanceMeta(suggestion.relevance_score);
    return (
        <Card className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="truncate font-semibold" dir="auto">{suggestion.name}</span>
                            <ClassBadge value={suggestion.evidence?.source_class} />
                            <Badge variant="outline" className="shrink-0">{suggestion.type}</Badge>
                        </div>
                        <a href={suggestion.feed_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
                            {domainOf(suggestion.feed_url)}
                            {suggestion.health?.items_count ? ` · ${suggestion.health.items_count} items` : ''}
                        </a>
                    </div>
                    <Badge variant={rel.variant} className="shrink-0">{rel.label}</Badge>
                </div>

                {/* Relevance meter */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', rel.bar)} style={{ width: `${rel.pct}%` }} />
                </div>

                <EvidenceLine suggestion={suggestion} />

                {/* Sample headlines — the value: see what it actually produces */}
                {sample.length > 0 && (
                    <ul className="space-y-1">
                        {sample.slice(0, 3).map((it, i) => (
                            <li key={i} className="truncate text-sm text-muted-foreground" dir="auto" title={it.title}>· {it.title}</li>
                        ))}
                    </ul>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button size="sm" className="flex-1" onClick={onApprove} disabled={busy}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={onPreview}>
                        <Eye className="mr-1 h-4 w-4" /> Preview
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onReject} disabled={busy} title="Dismiss">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ActiveSourceRow({ source, onDelete }: { source: NewsSource; onDelete: () => void }) {
    const run = useRunSource();
    const health = newsSourceHealth(source);
    const running = run.isPending && run.variables === source.id;
    return (
        <TableRow>
            <TableCell>
                <div className="font-medium" dir="auto">{source.name}</div>
                <div className="text-xs text-muted-foreground">{domainOf(source.feed_url)}</div>
            </TableCell>
            <TableCell className="text-right">{source.items_count}</TableCell>
            <TableCell className={cn('text-right', source.failed > 0 && 'text-destructive')}>{source.failed}</TableCell>
            <TableCell>{formatDate(source.last_item_at)}</TableCell>
            <TableCell><p className="mb-1 text-xs text-muted-foreground">{source.is_active ? 'Enabled' : 'Paused'}</p><Badge variant={health.variant}>{health.label}</Badge></TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => run.mutate(source.id)} disabled={running || !source.is_active}>
                        {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                        Run
                    </Button>
                    <SourceRowActions source={source as unknown as ContentSource} onDelete={onDelete} />
                </div>
            </TableCell>
        </TableRow>
    );
}

function PreviewDialog({ suggestion, onClose }: { suggestion: SourceSuggestion; onClose: () => void }) {
    const isTelegram = suggestion.type === 'TELEGRAM';
    const preview = usePreviewSource();
    useEffect(() => {
        // Telegram channels have no RSS feed — show the stored sample messages.
        if (!isTelegram) preview.mutate({ sourceType: 'RSS', url: suggestion.feed_url });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestion.feed_url]);

    const items = preview.data?.items;
    const sample = suggestion.sample_items ?? [];

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle dir="auto">Preview — {suggestion.name}</DialogTitle>
                </DialogHeader>
                {isTelegram ? (
                    <div className="space-y-1">
                        <p className="pb-1 text-xs text-muted-foreground">Recent messages from this channel</p>
                        {sample.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No messages captured.</p>}
                        {sample.map((it, i) => (
                            <div key={i} className="border-b py-1.5 text-sm last:border-0" dir="auto">{it.title}</div>
                        ))}
                    </div>
                ) : (
                    <>
                        {preview.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Fetching recent items…</p>}
                        {!preview.isPending && items && items.length > 0 && <PreviewTable items={items} />}
                        {!preview.isPending && (!items || items.length === 0) && (
                            <div className="space-y-1">
                                {sample.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No items to preview.</p>}
                                {sample.map((it, i) => (
                                    <div key={i} className="border-b py-1 text-sm last:border-0" dir="auto">{it.title}</div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function SuggestProfilesDialog({ onClose }: { onClose: () => void }) {
    const suggest = useSuggestProfiles();
    const create = useCreateProfile();
    const [added, setAdded] = useState<Set<string>>(new Set());

    useEffect(() => {
        suggest.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const drafts = suggest.data?.data ?? [];

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Suggested interests from your stories</DialogTitle>
                </DialogHeader>
                {suggest.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Reading your stories…</p>}
                {!suggest.isPending && drafts.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No new story-based suggestions.</p>
                )}
                <div className="space-y-2">
                    {drafts.map((d) => (
                        <div key={d.name} className="flex items-center justify-between gap-3 rounded-md border p-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium" dir="auto">{d.name}</p>
                                <p className="truncate text-xs text-muted-foreground" dir="auto">{d.keywords.join(', ') || '—'} · {d.article_count} articles</p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={added.has(d.name) || create.isPending}
                                onClick={async () => {
                                    await create.mutateAsync({ name: d.name, description: d.description, keywords: d.keywords, languages: ['ar', 'en'] });
                                    setAdded((p) => new Set(p).add(d.name));
                                }}
                            >
                                {added.has(d.name) ? 'Added' : 'Create'}
                            </Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
