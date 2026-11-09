'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Twitter, Plus, Loader2, Eye, Check, X, Play, Trash2, Sparkles,
    Settings2, Network, AlertTriangle, ChevronDown, MessageSquare,
    Repeat2, UserPlus, Search, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    useDiscoveryConfig, useUpdateDiscoveryConfig, useBuildGraph,
    useSuggestions, useNewsSources, useApproveSuggestion, useRejectSuggestion,
    useBulkApprove, useBulkReject, useAuthorities,
} from '@/hooks/use-discovery';
import { useCreateSource, useUpdateSource, useDeleteSource, useRunSource } from '@/hooks/use-sources';
import { usePreviewSource } from '@/hooks/use-source-preview';
import type { DiscoveryConfig, NewsSource, SourceSuggestion } from '@/types/platform/discovery';
import { ClassBadge, ClassFilter, sourceClassOf, type SourceClass } from './source-class-badge';

// ── helpers ────────────────────────────────────────────────────────────────
const fmtFollowers = (n?: number) =>
    !n ? '' : n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

function xHandle(raw?: string): string {
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.)?(x|twitter|mobile\.twitter)\.com\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0]
        ?.trim() ?? '';
}

function xProvenance(via?: string): string {
    switch (via) {
        case 'x-retweet': return 'Retweeted by your network';
        case 'x-quote': return 'Quoted by your network';
        case 'x-mention': return 'Mentioned by your network';
        case 'x-recommend': return 'Recommended by X for your sources';
        default: return 'From your X network';
    }
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
    return (
        <button
            type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onChange}
            className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
                on ? 'bg-news' : 'bg-muted-foreground/30')}
        >
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
        </button>
    );
}

// Account avatar with graceful monogram fallback (Twitter CDN image may 404 or
// be missing). Plain <img> — pbs.twimg.com is public, no next/image domain config.
function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string; size?: number }) {
    const [err, setErr] = useState(false);
    const initial = (name?.trim()?.replace(/^@/, '')?.[0] ?? '@').toUpperCase();
    if (src && !err) {
        return (
            <img
                src={src} alt="" width={size} height={size} loading="lazy"
                onError={() => setErr(true)}
                className="shrink-0 rounded-full bg-muted object-cover"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full bg-news/10 font-medium text-news"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
            dir="auto"
        >
            {initial}
        </div>
    );
}

// One selectable discovery method (a signal that surfaces account suggestions).
function MethodRow({ icon, title, desc, on, onChange, disabled }: {
    icon: React.ReactNode; title: string; desc: string;
    on: boolean; onChange: () => void; disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 p-2.5">
            <div className={cn('rounded p-1.5', on ? 'bg-news/10 text-news' : 'bg-muted text-muted-foreground')}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground" dir="auto">{desc}</p>
            </div>
            <Toggle on={on} onChange={onChange} disabled={disabled} />
        </div>
    );
}

// Inline preview of an account's recent tweets — a compact, source-grounded
// glance rendered directly under a row (no dialog). `loading`/`empty` cover the
// lazy-fetch states for active accounts; discovered accounts pass cached samples.
function InlineTweets({ items, loading, empty }: {
    items: { title: string }[]; loading?: boolean; empty?: string;
}) {
    if (loading) {
        return (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading tweets…
            </div>
        );
    }
    if (!items || items.length === 0) {
        return empty ? (
            <div className="mt-1.5 rounded-md bg-muted/40 px-2 py-2 text-xs text-muted-foreground" dir="auto">{empty}</div>
        ) : null;
    }
    return (
        <ul className="mt-1.5 space-y-1 rounded-md bg-muted/40 p-2">
            {items.slice(0, 4).map((it, i) => (
                <li key={i} dir="auto" className="flex gap-1.5 text-xs text-muted-foreground leading-relaxed">
                    <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-news/60" />
                    <span className="line-clamp-2">{it.title}</span>
                </li>
            ))}
        </ul>
    );
}

// ── main card ───────────────────────────────────────────────────────────────
export function TwitterCard() {
    const { data: cfg } = useDiscoveryConfig();
    const update = useUpdateDiscoveryConfig();
    const build = useBuildGraph();

    const networkOn = cfg?.twitter_discovery_enabled ?? false;
    const recommendOn = cfg?.twitter_recommend_enabled ?? false;
    const anyOn = networkOn || recommendOn;

    const { data: suggData } = useSuggestions(undefined, 'PENDING');
    const { data: srcData } = useNewsSources();
    const { data: authData } = useAuthorities('twitter');

    const xSuggestions = useMemo(
        () => (suggData?.data ?? []).filter((s) => s.type === 'TWITTER'),
        [suggData],
    );
    const xSources = useMemo(
        () => (srcData?.data ?? []).filter((s) => s.type === 'TWITTER'),
        [srcData],
    );
    const topVoices = (authData?.data ?? []).slice(0, 6);

    const [preview, setPreview] = useState<SourceSuggestion | string | null>(null);

    // Each X discovery method toggles independently. Enabling ANY method also
    // turns on Source intelligence (the scheduled graph build that runs them);
    // disabling one never touches intelligence — the other method may still need it.
    const setMethod = (
        key: 'twitter_discovery_enabled' | 'twitter_recommend_enabled',
        val: boolean,
    ) => {
        if (!cfg) return;
        const next: DiscoveryConfig = { ...cfg, [key]: val };
        if (val) next.intelligence_enabled = true;
        update.mutate(next);
    };

    const activeLabel = [networkOn && 'network activity', recommendOn && 'recommendations']
        .filter(Boolean)
        .join(' + ');

    return (
        <Card>
            <CardContent className="space-y-4 p-4">
                {/* header */}
                <div className="flex items-start gap-3">
                    <div className={cn('rounded-md p-2', anyOn ? 'bg-news/10 text-news' : 'bg-muted text-muted-foreground')}>
                        <Twitter className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-none">X / Twitter discovery</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {anyOn
                                ? `On · ${activeLabel}`
                                : 'Off — pick a method below to auto-discover related accounts (no login needed)'}
                        </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => build.mutate()} disabled={build.isPending || !anyOn}>
                        {build.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                        Find now
                    </Button>
                </div>

                {/* discovery methods — pick which signals surface account suggestions */}
                <div className="overflow-hidden rounded-md border">
                    <div className="border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Discovery methods
                    </div>
                    <div className="divide-y">
                        <MethodRow
                            icon={<Repeat2 className="h-4 w-4" />}
                            title="Network activity"
                            desc="Accounts your trusted accounts retweet, quote & mention"
                            on={networkOn}
                            onChange={() => setMethod('twitter_discovery_enabled', !networkOn)}
                            disabled={update.isPending}
                        />
                        <MethodRow
                            icon={<UserPlus className="h-4 w-4" />}
                            title="X recommendations"
                            desc={'“Who to follow” / قد يعجبك — accounts X considers similar to your sources'}
                            on={recommendOn}
                            onChange={() => setMethod('twitter_recommend_enabled', !recommendOn)}
                            disabled={update.isPending}
                        />
                    </div>
                </div>

                {/* direct add */}
                <AddAccount onPreview={(h) => setPreview(h)} />

                {/* discovered accounts */}
                {xSuggestions.length > 0 && (
                    <DiscoveredAccounts suggestions={xSuggestions} onPreview={(s) => setPreview(s)} />
                )}

                {/* active sources */}
                {xSources.length > 0 && <ActiveAccounts sources={xSources} />}

                {/* insight strip */}
                {(topVoices.length > 0 || xSources.length > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs">
                        {topVoices.length > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Network className="h-3.5 w-3.5 text-news" />
                                <span>Top voices in your X network:</span>
                                {topVoices.map((v) => (
                                    <span key={v.domain} className="rounded bg-muted px-1.5 py-0.5" title={`cited by ${v.cocitation_count}`}>
                                        @{v.domain}
                                    </span>
                                ))}
                            </div>
                        )}
                        <SourcesHealth sources={xSources} className="ml-auto" />
                    </div>
                )}

                {preview && (
                    <TweetPreviewDialog
                        target={preview}
                        onClose={() => setPreview(null)}
                    />
                )}
            </CardContent>
        </Card>
    );
}

// ── direct "add account" with live preview ───────────────────────────────────
function AddAccount({ onPreview }: { onPreview: (handle: string) => void }) {
    const [value, setValue] = useState('');
    const create = useCreateSource();
    const handle = xHandle(value);

    const add = () => {
        if (!handle) return;
        create.mutate(
            {
                name: `@${handle}`,
                type: 'TWITTER',
                category: 'news',
                feed_url: `https://x.com/${handle}`,
                api_config: { mode: 'scrape', username: handle },
                is_active: true,
                fetch_interval_minutes: 60,
            },
            { onSuccess: () => setValue('') },
        );
    };

    return (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <Twitter className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Add an account directly — @handle or x.com/handle"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button size="sm" variant="ghost" disabled={!handle} onClick={() => onPreview(handle)}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Preview
            </Button>
            <Button size="sm" disabled={!handle || create.isPending} onClick={add}>
                {create.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                Add
            </Button>
        </div>
    );
}

// ── discovered accounts: avatars, evidence, filter + sort, bulk approve ───────
type SortKey = 'match' | 'followers' | 'sources';
const SORTS: { k: SortKey; label: string }[] = [
    { k: 'match', label: 'Match' },
    { k: 'sources', label: 'Sources' },
    { k: 'followers', label: 'Followers' },
];

function DiscoveredAccounts({
    suggestions, onPreview,
}: { suggestions: SourceSuggestion[]; onPreview: (s: SourceSuggestion) => void }) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('match');
    const [classFilter, setClassFilter] = useState<SourceClass | 'all'>('all');
    const approve = useApproveSuggestion();
    const reject = useRejectSuggestion();
    const bulkApprove = useBulkApprove();
    const bulkReject = useBulkReject();

    const classCounts = useMemo(() => {
        const m: Partial<Record<SourceClass | 'all', number>> = { all: suggestions.length };
        for (const s of suggestions) {
            const c = sourceClassOf(s);
            if (c) m[c] = (m[c] ?? 0) + 1;
        }
        return m;
    }, [suggestions]);

    const view = useMemo(() => {
        const q = query.trim().toLowerCase();
        let filtered = q
            ? suggestions.filter((s) => (s.name ?? '').toLowerCase().includes(q) || xHandle(s.feed_url).toLowerCase().includes(q))
            : suggestions;
        if (classFilter !== 'all') filtered = filtered.filter((s) => sourceClassOf(s) === classFilter);
        const key = (s: SourceSuggestion) =>
            sortBy === 'followers' ? (s.evidence?.subscribers ?? 0)
                : sortBy === 'sources' ? (s.evidence?.cocitation_count ?? 0)
                    : (s.relevance_score ?? 0);
        return [...filtered].sort((a, b) => key(b) - key(a));
    }, [suggestions, query, sortBy, classFilter]);

    const allSelected = view.length > 0 && view.every((s) => selected.has(s.id));
    const toggle = (id: string) => setSelected((p) => {
        const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
    const toggleExpand = (id: string) => setExpanded((p) => {
        const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
    const clear = () => setSelected(new Set());

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? new Set(view.map((s) => s.id)) : new Set())}
                    />
                    <span className="text-sm font-medium">Discovered accounts</span>
                    <Badge variant="outline">{suggestions.length}</Badge>
                </div>
                {selected.size > 0 ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                        <Button size="sm" variant="outline" disabled={bulkReject.isPending}
                            onClick={() => { bulkReject.mutate([...selected]); clear(); }}>
                            Dismiss
                        </Button>
                        <Button size="sm" disabled={bulkApprove.isPending}
                            onClick={() => { bulkApprove.mutate([...selected]); clear(); }}>
                            {bulkApprove.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                            Approve {selected.size}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter accounts"
                                className="h-8 w-36 pl-7 text-xs sm:w-44"
                            />
                        </div>
                        <div className="flex items-center overflow-hidden rounded-md border text-xs">
                            {SORTS.map((s) => (
                                <button
                                    key={s.k} type="button" onClick={() => setSortBy(s.k)}
                                    className={cn('px-2 py-1.5 transition-colors', sortBy === s.k ? 'bg-news/10 text-news' : 'text-muted-foreground hover:bg-muted')}
                                    title={`Sort by ${s.label.toLowerCase()}`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <ClassFilter value={classFilter} onChange={setClassFilter} counts={classCounts} />

            <div className="divide-y rounded-md border">
                {view.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">No accounts match this view.</p>
                )}
                {view.map((s) => {
                    const subs = s.evidence?.subscribers;
                    const corec = s.evidence?.cocitation_count ?? 0;
                    const isOpen = expanded.has(s.id);
                    const samples = s.sample_items ?? [];
                    return (
                        <div key={s.id} className="p-2.5">
                            <div className="flex items-center gap-3">
                                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                                <Avatar src={s.image_url} name={s.name} size={40} />
                                {/* Row body toggles the inline tweet preview (cached samples). */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(s.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium" dir="auto">{s.name}</span>
                                            <ClassBadge value={s.evidence?.source_class} />
                                            <span className="hidden shrink-0 items-center gap-1 rounded bg-news/10 px-1.5 py-0.5 text-[11px] text-news sm:inline-flex">
                                                {xProvenance(s.discovered_via)}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                            <span>@{xHandle(s.feed_url)}</span>
                                            {subs ? <span>· {fmtFollowers(subs)} followers</span> : null}
                                            {corec >= 2 && (
                                                <span className="inline-flex items-center gap-0.5 text-news/80" title="Co-recommended by this many of your trusted sources">
                                                    · <Users className="h-3 w-3" /> {corec} sources
                                                </span>
                                            )}
                                            {typeof s.relevance_score === 'number' && s.relevance_score > 0 && (
                                                <span>· {Math.round(s.relevance_score * 100)}% match</span>
                                            )}
                                            {samples.length > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-news/70">
                                                    · <MessageSquare className="h-3 w-3" /> {samples.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                                </button>
                                <Button size="sm" variant="ghost" title="Live preview" onClick={() => onPreview(s)}>
                                    <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate({ id: s.id })}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(s.id)}>
                                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                                </Button>
                            </div>
                            {isOpen && <InlineTweets items={samples} empty="No sample tweets captured — use live preview." />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── active accounts with per-source ingestion controls ────────────────────────
function ActiveAccounts({ sources }: { sources: NewsSource[] }) {
    return (
        <div className="space-y-1.5">
            <span className="text-sm font-medium">Active accounts</span>
            <div className="divide-y rounded-md border">
                {sources.map((s) => <ActiveAccountRow key={s.id} source={s} />)}
            </div>
        </div>
    );
}

function ActiveAccountRow({ source }: { source: NewsSource }) {
    const [open, setOpen] = useState(false);
    const [showTweets, setShowTweets] = useState(false);
    const run = useRunSource();
    const del = useDeleteSource();
    const preview = usePreviewSource();
    const tweetPreview = usePreviewSource();
    const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const running = preview.isPending || (run.isPending && run.variables === source.id);
    const stale = source.failed > 0;

    // Lazy inline preview: fetch the account's recent tweets the first time it's expanded.
    const toggleTweets = () => {
        setShowTweets((o) => !o);
        if (!showTweets && !tweetPreview.data && !tweetPreview.isPending) {
            tweetPreview.mutate({ sourceType: 'TWITTER', url: source.feed_url || `https://x.com/${xHandle(source.feed_url)}` });
        }
    };

    // Fetch now = a synchronous test-fetch that REPORTS the outcome (X 429, etc.)
    // inline on the row, then triggers the real async ingest only if tweets came
    // back. Outcome shows in the inline strip below; usePreviewSource already
    // toasts on a hard error, so we don't double-toast here.
    const fetchNow = () => {
        setLastResult(null);
        preview.mutate(
            { sourceType: 'TWITTER', url: source.feed_url || `https://x.com/${xHandle(source.feed_url)}` },
            {
                onSuccess: (res) => {
                    if (res.fetched > 0) {
                        setLastResult({ ok: true, msg: `Found ${res.fetched} recent tweet${res.fetched === 1 ? '' : 's'} — ingesting…` });
                        run.mutate(source.id);
                    } else {
                        setLastResult({ ok: false, msg: res.message });
                    }
                },
                onError: (err: Error) => setLastResult({ ok: false, msg: err.message }),
            },
        );
    };

    return (
        <div className="p-2.5">
            <div className="flex items-center gap-3">
                <Avatar src={source.image_url} name={source.name} size={36} />
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium" dir="auto">{source.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>@{xHandle(source.feed_url)}</span>
                        <span>· {source.items_count} tweets</span>
                        {stale && <span className="text-destructive">· {source.failed} failed</span>}
                        <span>· every {source.fetch_interval_minutes}m</span>
                    </div>
                </div>
                <Badge variant={stale ? 'warning' : source.items_count > 0 ? 'success' : 'secondary'}>
                    {stale ? 'check' : source.items_count > 0 ? 'healthy' : 'new'}
                </Badge>
                <Button size="sm" variant="ghost" title="Preview tweets" onClick={toggleTweets}>
                    <MessageSquare className={cn('h-3.5 w-3.5', showTweets && 'text-news')} />
                </Button>
                <Button size="sm" variant="ghost" title="Settings" onClick={() => setOpen((o) => !o)}>
                    <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" disabled={running} onClick={fetchNow}>
                    {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                    Fetch now
                </Button>
                <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => del.mutate(source.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {lastResult && (
                <div className={cn('mt-1.5 flex items-start gap-1.5 text-xs',
                    lastResult.ok ? 'text-emerald-600' : 'text-destructive')}>
                    {lastResult.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span dir="auto">{lastResult.msg}</span>
                </div>
            )}
            {showTweets && (
                <InlineTweets
                    items={tweetPreview.data?.items ?? []}
                    loading={tweetPreview.isPending}
                    empty={tweetPreview.data?.message || 'No tweets available right now.'}
                />
            )}
            {open && <IngestionControls source={source} onClose={() => setOpen(false)} />}
        </div>
    );
}

function IngestionControls({ source, onClose }: { source: NewsSource; onClose: () => void }) {
    const cfg = (source as unknown as { api_config?: Record<string, unknown> }).api_config ?? {};
    const update = useUpdateSource();
    const [skipRetweets, setSkipRetweets] = useState(Boolean(cfg.skipRetweets));
    const [skipReplies, setSkipReplies] = useState(Boolean(cfg.skipReplies));
    const [minEngagement, setMinEngagement] = useState(Number(cfg.minEngagement ?? 0));
    const [interval, setIntervalVal] = useState(source.fetch_interval_minutes);

    const save = () => {
        update.mutate(
            {
                id: source.id,
                data: {
                    fetch_interval_minutes: interval,
                    api_config: { ...cfg, mode: 'scrape', username: xHandle(source.feed_url), skipRetweets, skipReplies, minEngagement },
                },
            },
            { onSuccess: onClose },
        );
    };

    return (
        <div className="mt-2 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-4">
            <label className="flex items-center gap-2">
                <Checkbox checked={skipRetweets} onCheckedChange={(v) => setSkipRetweets(!!v)} /> Skip retweets
            </label>
            <label className="flex items-center gap-2">
                <Checkbox checked={skipReplies} onCheckedChange={(v) => setSkipReplies(!!v)} /> Skip replies
            </label>
            <div className="flex items-center gap-2">
                <Label className="text-xs">Min engagement</Label>
                <Input type="number" min={0} value={minEngagement}
                    onChange={(e) => setMinEngagement(Number(e.target.value))} className="h-7 w-20" />
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-xs">Every (min)</Label>
                <Input type="number" min={5} value={interval}
                    onChange={(e) => setIntervalVal(Number(e.target.value))} className="h-7 w-20" />
            </div>
            <div className="col-span-2 flex justify-end gap-2 sm:col-span-4">
                <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={update.isPending} onClick={save}>
                    {update.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save
                </Button>
            </div>
        </div>
    );
}

function SourcesHealth({ sources, className }: { sources: NewsSource[]; className?: string }) {
    if (sources.length === 0) return null;
    const failing = sources.filter((s) => s.failed > 0).length;
    return (
        <span className={cn('flex items-center gap-1.5 text-muted-foreground', className)}>
            {failing > 0
                ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {failing} account{failing === 1 ? '' : 's'} need attention</>
                : <>{sources.length} account{sources.length === 1 ? '' : 's'} healthy · syndication</>}
        </span>
    );
}

// ── live tweet preview (suggestion or a bare handle) ──────────────────────────
function TweetPreviewDialog({
    target, onClose,
}: { target: SourceSuggestion | string; onClose: () => void }) {
    const preview = usePreviewSource();
    const isSuggestion = typeof target !== 'string';
    const handle = isSuggestion ? xHandle((target as SourceSuggestion).feed_url) : (target as string);
    const title = isSuggestion ? (target as SourceSuggestion).name : `@${handle}`;
    const stored = isSuggestion ? (target as SourceSuggestion).sample_items ?? [] : [];

    useEffect(() => {
        preview.mutate({ sourceType: 'TWITTER', url: `https://x.com/${handle}` });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handle]);

    const items = preview.data?.items;

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle dir="auto">Recent tweets — {title}</DialogTitle>
                </DialogHeader>
                {preview.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Fetching recent tweets…</p>}
                {!preview.isPending && items && items.length > 0 && (
                    <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                        {items.map((it, i) => (
                            <div key={i} className="border-b py-2 text-sm last:border-0" dir="auto">{it.title}</div>
                        ))}
                    </div>
                )}
                {!preview.isPending && (!items || items.length === 0) && (
                    <div className="space-y-1">
                        {stored.length === 0
                            ? <p className="py-6 text-center text-sm text-muted-foreground">No tweets available (X may be rate-limiting — try again shortly).</p>
                            : stored.map((it, i) => <div key={i} className="border-b py-2 text-sm last:border-0" dir="auto">{it.title}</div>)}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
