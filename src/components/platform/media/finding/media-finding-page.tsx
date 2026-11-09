'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from '@/lib/console-link';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import {
    Plus, Play, Trash2, Loader2, Radar, Check, X, Youtube, Podcast,
    Captions, Scissors, Settings2, Radio, Eye, AudioLines, Upload,
    ChevronDown, TrendingDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants/routes';
import {
    useProfiles,
    useSuggestions,
    useNewsSources,
    useRunProfile,
    useDeleteProfile,
    useApproveSuggestion,
    useRejectSuggestion,
    useBulkApprove,
    useBulkReject,
    useDiscoveryConfig,
    useUpdateDiscoveryConfig,
    useBuildGraph,
    useImportYouTubeFeed,
    useImportYouTubeLinks,
} from '@/hooks/use-discovery';
import type { DiscoveryProfile, SourceSuggestion, DiscoveryConfig, SuggestionRelationship } from '@/types/platform/discovery';
import { ProfileDialog } from '@/components/platform/news/finding/profile-dialog';

const ALL = '__all__';

function formatSubscribers(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
    return String(n);
}

function platformOf(type: string): { label: string; icon: typeof Youtube } {
    if (type === 'YOUTUBE') return { label: 'YouTube', icon: Youtube };
    return { label: 'Podcast', icon: Podcast };
}

function captionMeta(state?: string): { label: string; variant: 'success' | 'warning' | 'secondary' } | null {
    if (state === 'youtube_human') return { label: 'Captioned', variant: 'success' };
    if (state === 'youtube_auto') return { label: 'Auto-captions', variant: 'warning' };
    if (state === 'none') return { label: 'No transcript', variant: 'secondary' };
    return null;
}

function relationshipMeta(relationship?: SuggestionRelationship): {
    label: string;
    variant: 'secondary' | 'warning' | 'destructive' | 'success' | 'info';
} | null {
    if (!relationship || relationship.relationship === 'new') return null;
    if (relationship.relationship === 'duplicate') return { label: 'Duplicate', variant: 'destructive' };
    if (relationship.relationship === 'already_approved') return { label: 'Already live', variant: 'success' };
    if (relationship.relationship === 'improves_existing') return { label: 'Improves existing', variant: 'info' };
    return { label: 'Similar source', variant: 'warning' };
}

function MediaSuggestionCard({ suggestion, relationship, onApprove, onReject, onSelect, selected, busy }: {
    suggestion: SourceSuggestion;
    relationship?: SuggestionRelationship;
    onApprove: () => void;
    onReject: () => void;
    onSelect?: () => void;
    selected?: boolean;
    busy: boolean;
}) {
    const { label: platform, icon: Icon } = platformOf(suggestion.type);
    const ev = suggestion.evidence;
    const name = suggestion.health?.bio || suggestion.name;
    const caption = captionMeta(ev?.caption_state);
    const subs = ev?.subscribers ?? suggestion.health?.subscribers ?? 0;
    const sample = suggestion.sample_items ?? [];
    const relationshipBadge = relationshipMeta(relationship);
    const approveBlocked = relationship?.relationship === 'duplicate' || relationship?.relationship === 'already_approved';
    const approveLabel = relationship?.relationship === 'already_approved'
        ? 'Already added'
        : relationship?.relationship === 'duplicate'
          ? 'Duplicate'
          : 'Approve';
    const audioFirst = suggestion.type === 'YOUTUBE' ? suggestion.health?.audio_first : undefined;
    const category = suggestion.health?.category;
    const score = suggestion.relevance_score ?? suggestion.confidence;
    const topSignals = [
        subs > 0 ? `${formatSubscribers(subs)} subscribers` : null,
        suggestion.health?.episode_count ? `${suggestion.health.episode_count} episodes` : null,
        caption?.label,
        ev?.cocitation_count ? `${ev.cocitation_count} source links` : null,
    ].filter(Boolean).slice(0, 3);

    return (
        <Card
            className={cn(
                'flex flex-col overflow-hidden transition-colors',
                onSelect && 'cursor-pointer hover:border-gold/70 hover:bg-muted/20',
                selected && 'border-gold bg-gold/5 shadow-sm',
            )}
            onClick={onSelect}
        >
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-4">
                    {suggestion.image_url ? (
                        <img src={suggestion.image_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 truncate font-semibold leading-5" dir="auto">{name}</p>
                                {score !== undefined && score !== null && (
                                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                                        {(score * 100).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">{suggestion.feed_url}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="gap-1">
                                <Icon className="h-3 w-3" /> {platform}
                            </Badge>
                            {relationshipBadge && (
                                <Badge variant={relationshipBadge.variant}>
                                    {relationshipBadge.label}
                                </Badge>
                            )}
                            {suggestion.health?.is_podcast && (
                                <Badge variant="secondary" className="gap-1">
                                    <Podcast className="h-3 w-3" /> Podcast
                                </Badge>
                            )}
                            {audioFirst === false && (
                                <Badge variant="warning" className="gap-1">
                                    <Eye className="h-3 w-3" /> Visual{category ? ` · ${category}` : ''}
                                </Badge>
                            )}
                            {audioFirst === true && (
                                <Badge variant="success" className="gap-1">
                                    <AudioLines className="h-3 w-3" /> Audio-first
                                </Badge>
                            )}
                            {ev?.needs_chaptering && (
                                <Badge variant="warning" className="gap-1">
                                    <Scissors className="h-3 w-3" /> Needs trimming
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 text-xs sm:grid-cols-3">
                    {topSignals.length ? topSignals.map((signal) => (
                        <span key={signal} className="rounded-md border bg-background px-2.5 py-2 text-muted-foreground">
                            {signal}
                        </span>
                    )) : (
                        <span className="rounded-md border border-dashed px-2.5 py-2 text-muted-foreground sm:col-span-3">
                            Evidence will appear after enrichment runs.
                        </span>
                    )}
                </div>

                {sample.length > 0 && (
                    <ul className="space-y-1.5 border-l-2 border-gold/40 pl-3">
                        {sample.slice(0, 2).map((it, i) => (
                            <li key={i} className="truncate text-sm text-muted-foreground" dir="auto" title={it.title}>{it.title}</li>
                        ))}
                    </ul>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                    {relationship?.matched_source_id && approveBlocked ? (
                        <Button size="sm" className="min-w-32 flex-1" asChild>
                            <Link href={`/platform/media/sources?tab=sources&source=${relationship.matched_source_id}`}>
                                Open source
                            </Link>
                        </Button>
                    ) : (
                        <Button size="sm" className="min-w-32 flex-1" onClick={onApprove} disabled={busy || approveBlocked}>
                            <Check className="mr-1 h-4 w-4" /> {approveLabel}
                        </Button>
                    )}
                    <a href={suggestion.feed_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">Open</Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={onReject} disabled={busy} title="Dismiss">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function MediaSettings({ config }: { config: DiscoveryConfig }) {
    const update = useUpdateDiscoveryConfig();
    const set = (patch: Partial<DiscoveryConfig>) => update.mutate({ ...config, ...patch });
    const rows: { key: keyof DiscoveryConfig; label: string; hint: string }[] = [
        { key: 'intelligence_enabled', label: 'Source graph', hint: 'Master switch for relation-based discovery' },
        { key: 'youtube_discovery_enabled', label: 'YouTube (InnerTube)', hint: 'Watch-next channel graph — no API quota' },
        { key: 'podcast_discovery_enabled', label: 'Podcasts (iTunes/RSS)', hint: 'Topical adjacency + show-notes' },
        { key: 'youtube_related_enabled', label: 'YouTube featured', hint: 'Owner-curated featured channels (probe first)' },
        { key: 'apple_related_enabled', label: 'Apple “also subscribed”', hint: 'Co-listen graph (probe first)' },
        { key: 'automation_enabled', label: 'Scheduled sweeps', hint: 'Run discovery automatically on a cadence' },
    ];
    return (
        <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                {rows.map((r) => (
                    <label key={r.key} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium">{r.label}</p>
                            <p className="text-xs text-muted-foreground">{r.hint}</p>
                        </div>
                        <Switch
                            checked={Boolean(config[r.key])}
                            onCheckedChange={(v) => set({ [r.key]: v } as Partial<DiscoveryConfig>)}
                        />
                    </label>
                ))}
                {/* Storage guard — cap how much a newly-approved source pulls. */}
                <label className="flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-2">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Episodes pulled on approve</p>
                        <p className="text-xs text-muted-foreground">
                            When you approve a source, only the N most-recent episodes/videos are
                            ingested — protects storage from deep back-catalogs. 0 = pull everything.
                        </p>
                    </div>
                    <Input
                        type="number"
                        min={0}
                        defaultValue={config.media_initial_max_episodes ?? 5}
                        onBlur={(e) => {
                            const v = Math.max(0, Math.floor(Number(e.target.value)));
                            if (v !== config.media_initial_max_episodes) set({ media_initial_max_episodes: v });
                        }}
                        className="h-9 w-20"
                    />
                </label>
            </CardContent>
        </Card>
    );
}

function ClearItem({ icon: Icon, label, ids, onPick, destructive }: {
    icon: typeof Eye;
    label: string;
    ids: string[];
    onPick: (ids: string[]) => void;
    destructive?: boolean;
}) {
    return (
        <DropdownMenuItem
            disabled={ids.length === 0}
            onClick={() => onPick(ids)}
            className={cn('gap-2', destructive && 'text-destructive focus:text-destructive')}
        >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{ids.length}</span>
        </DropdownMenuItem>
    );
}

export function YouTubeImportPanel({ profiles, defaultProfileId, onDone }: {
    profiles: DiscoveryProfile[];
    defaultProfileId: string;
    onDone: () => void;
}) {
    // Links is the primary path (two taps off the Share button); JSON paste is the
    // advanced fallback (the personalized home-feed dump) kept for power users.
    const [mode, setMode] = useState<'links' | 'json'>('links');
    const [links, setLinks] = useState('');
    const [raw, setRaw] = useState('');
    const [profileId, setProfileId] = useState(defaultProfileId);
    const importLinks = useImportYouTubeLinks();
    const importFeed = useImportYouTubeFeed();
    const pending = importLinks.isPending || importFeed.isPending;

    useEffect(() => {
        if (!profileId && defaultProfileId) setProfileId(defaultProfileId);
    }, [defaultProfileId, profileId]);

    const submitLinks = () => {
        const inputs = links.split('\n').map((s) => s.trim()).filter(Boolean);
        if (inputs.length === 0) return;
        importLinks.mutate(
            { inputs, profileId: profileId || undefined },
            { onSuccess: () => { setLinks(''); onDone(); } },
        );
    };

    const submitJson = () => {
        const text = raw.trim();
        if (!text) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            toast({ title: 'Invalid JSON', description: 'Paste the full youtubei/v1 response body (valid JSON).', variant: 'destructive' });
            return;
        }
        importFeed.mutate(
            { raw: parsed, profileId: profileId || undefined },
            { onSuccess: () => { setRaw(''); onDone(); } },
        );
    };

    return (
        <Card>
            <CardContent className="space-y-3 py-4">
                <div className="flex items-start gap-2">
                    <Youtube className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Import channels from YouTube</p>
                        <p className="text-xs text-muted-foreground">
                            Paste YouTube links — a channel <span dir="ltr">@handle</span>, a channel URL, or any
                            video/share link (one per line). We resolve each to its channel via guest InnerTube, enrich
                            it, and queue it below for review. No credentials are stored.
                        </p>
                    </div>
                </div>

                {mode === 'links' ? (
                    <textarea
                        value={links}
                        onChange={(e) => setLinks(e.target.value)}
                        placeholder={'@thmanyahPodcasts\nhttps://www.youtube.com/@MicsPodc\nhttps://youtu.be/YowLeR_piTw'}
                        spellCheck={false}
                        dir="ltr"
                        className="h-32 w-full resize-y rounded-md border bg-muted/30 p-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                ) : (
                    <textarea
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        placeholder="Paste the raw youtubei/v1 JSON response here…"
                        spellCheck={false}
                        dir="ltr"
                        className="h-40 w-full resize-y rounded-md border bg-muted/30 p-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Attach to interest
                        <select
                            value={profileId}
                            onChange={(e) => setProfileId(e.target.value)}
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                            <option value="">— none —</option>
                            {profiles.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMode(mode === 'links' ? 'json' : 'links')}
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                            {mode === 'links' ? 'Advanced: paste JSON' : 'Back to links'}
                        </button>
                        {mode === 'links' ? (
                            <Button size="sm" disabled={!links.trim() || pending} onClick={submitLinks}>
                                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                                Import
                            </Button>
                        ) : (
                            <Button size="sm" disabled={!raw.trim() || pending} onClick={submitJson}>
                                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                                Import
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface MediaFindingPageProps {
    embedded?: boolean;
    relationships?: Record<string, SuggestionRelationship>;
    intelligence?: ReactNode;
}

export function MediaFindingPage({ embedded = false, relationships, intelligence }: MediaFindingPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { data: profilesData } = useProfiles();
    const { data: config } = useDiscoveryConfig();
    const { data: suggestionsData, isLoading } = useSuggestions(undefined, 'PENDING', 'media');
    // The active roster this hub feeds — approved media sources (the same rows the
    // Media Sources page manages), grouped by the interest they were found for.
    const { data: activeSources } = useNewsSources(undefined, 'media');

    const [activeProfile, setActiveProfile] = useState<string>(searchParams.get('profile') || ALL);
    const selectedSuggestionId = searchParams.get('suggestion');
    const [showProfile, setShowProfile] = useState(false);
    const [editProfile, setEditProfile] = useState<DiscoveryProfile | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showImport, setShowImport] = useState(false);

    const buildGraph = useBuildGraph();
    const runProfile = useRunProfile();
    const deleteProfile = useDeleteProfile();
    const approve = useApproveSuggestion();
    const reject = useRejectSuggestion();
    const bulkApprove = useBulkApprove();
    const bulkReject = useBulkReject();

    // Media-only profiles + suggestions (the spine is shared; isolate by category).
    const mediaProfiles = useMemo(
        () => (profilesData?.data ?? []).filter((p: DiscoveryProfile) => p.category === 'media'),
        [profilesData],
    );
    const mediaProfileIds = useMemo(() => new Set(mediaProfiles.map((p) => p.id)), [mediaProfiles]);

    const suggestions = useMemo(() => {
        const all = (suggestionsData?.data ?? []) as SourceSuggestion[];
        return all.filter((s) =>
            s.category === 'media' || (s.profile_id ? mediaProfileIds.has(s.profile_id) : false),
        );
    }, [suggestionsData, mediaProfileIds]);

    const visible = useMemo(
        () => (activeProfile === ALL ? suggestions : suggestions.filter((s) => s.profile_id === activeProfile)),
        [suggestions, activeProfile],
    );
    const approvableVisible = useMemo(
        () => visible.filter((s) => {
            const rel = relationships?.[s.id]?.relationship;
            return rel !== 'duplicate' && rel !== 'already_approved';
        }),
        [visible, relationships],
    );

    // Hand-imported channels (pasted links / JSON) are kept in their own section so
    // they don't get lost among the auto-discovered results — these are the ones the
    // admin deliberately seeded and most wants to find again.
    const isImported = (s: SourceSuggestion) => s.discovered_via === 'youtube-import';
    const imported = useMemo(() => visible.filter(isImported), [visible]);
    const discovered = useMemo(() => visible.filter((s) => !isImported(s)), [visible]);

    // One-click "clear" filters for the review queue (bulk-reject the matches).
    // "Weak" is relative to the current view's best score (with a small floor) so
    // it adapts to each topic's score distribution instead of a fixed cutoff.
    const clearGroups = useMemo(() => {
        const scoreOf = (s: SourceSuggestion) => s.relevance_score ?? s.confidence ?? 0;
        const maxScore = visible.reduce((m, s) => Math.max(m, scoreOf(s)), 0);
        const weakCutoff = Math.max(0.15, maxScore * 0.5);
        const ids = (pred: (s: SourceSuggestion) => boolean) => visible.filter(pred).map((s) => s.id);
        return {
            weak: ids((s) => scoreOf(s) < weakCutoff),
            visual: ids((s) => s.health?.audio_first === false),
            nonPodcast: ids((s) => !(s.type === 'PODCAST' || s.health?.is_podcast)),
            noTranscript: ids((s) => s.evidence?.caption_state === 'none'),
            needsTrim: ids((s) => Boolean(s.evidence?.needs_chaptering)),
            imported: ids(isImported),
            discovered: ids((s) => !isImported(s)),
            all: visible.map((s) => s.id),
        };
    }, [visible]);

    const clearWhere = (ids: string[]) => {
        if (ids.length && !bulkReject.isPending) bulkReject.mutate(ids);
    };

    // Active media source counts per interest (the roster the hub has built).
    const activeByProfile = useMemo(() => {
        const m = new Map<string, number>();
        for (const s of activeSources?.data ?? []) {
            if (s.discovery_profile_id) m.set(s.discovery_profile_id, (m.get(s.discovery_profile_id) ?? 0) + 1);
        }
        return m;
    }, [activeSources]);
    const totalActive = activeSources?.data?.length ?? 0;

    const busy = approve.isPending || reject.isPending;

    useEffect(() => {
        setActiveProfile(searchParams.get('profile') || ALL);
    }, [searchParams]);

    const updateUrl = (patch: Record<string, string | null>) => {
        if (!embedded) return;
        const params = new URLSearchParams(searchParams);
        params.set('tab', 'finding');
        for (const [key, value] of Object.entries(patch)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const selectProfile = (id: string) => {
        setActiveProfile(id);
        updateUrl({ profile: id === ALL ? null : id, suggestion: null });
    };

    const selectSuggestion = (id: string) => {
        updateUrl({ suggestion: id });
    };

    return (
        <div className="space-y-5">
            {!embedded && (
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <span className="brand-overline text-gold">Pods</span>
                    <h1 className="text-2xl font-bold">Media Finding</h1>
                    <p className="text-sm text-muted-foreground">
                        Auto-discovered podcasts &amp; YouTube channels, ranked for your roster.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={ROUTES.PLATFORM.MEDIA_SOURCES}>
                        <Button variant="outline" title="Manage the approved roster">
                            <Radio className="mr-1 h-4 w-4" /> Media Sources{totalActive ? ` · ${totalActive}` : ''}
                        </Button>
                    </Link>
                    <Button variant="outline" onClick={() => setShowImport((s) => !s)}>
                        <Upload className="mr-1 h-4 w-4" /> Import from YouTube
                    </Button>
                    <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
                        <Settings2 className="mr-1 h-4 w-4" /> Settings
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => buildGraph.mutate()}
                        disabled={buildGraph.isPending}
                    >
                        {buildGraph.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Radar className="mr-1 h-4 w-4" />}
                        Build graph
                    </Button>
                    <Button onClick={() => { setEditProfile(null); setShowProfile(true); }}>
                        <Plus className="mr-1 h-4 w-4" /> New interest
                    </Button>
                </div>
            </div>
            )}

            {!embedded && showSettings && config && <MediaSettings config={config} />}
            {!embedded && showImport && (
                <YouTubeImportPanel
                    profiles={mediaProfiles}
                    defaultProfileId={activeProfile === ALL ? (mediaProfiles[0]?.id ?? '') : activeProfile}
                    onDone={() => setShowImport(false)}
                />
            )}

            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                {/* Interests rail */}
                <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                    <div className="rounded-md border bg-card p-2">
                        <button
                            onClick={() => selectProfile(ALL)}
                            className={cn(
                                'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors',
                                activeProfile === ALL ? 'bg-gold/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                            )}
                        >
                            <span>All interests</span>
                            <Badge variant="secondary">{suggestions.length}</Badge>
                        </button>
                        <div className="my-2 h-px bg-border" />
                        <div className="space-y-1">
                            {mediaProfiles.map((p) => {
                                const count = suggestions.filter((s) => s.profile_id === p.id).length;
                                const active = activeByProfile.get(p.id) ?? 0;
                                const running = runProfile.isPending && runProfile.variables === p.id;
                                return (
                                    <div
                                        key={p.id}
                                        className={cn(
                                            'group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors',
                                            activeProfile === p.id ? 'bg-gold/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                                        )}
                                    >
                                        <button onClick={() => selectProfile(p.id)} className="min-w-0 flex-1 truncate text-left" dir="auto">
                                            {p.name}
                                            {active > 0 && <span className="ml-1.5 text-xs font-normal text-gold">· {active} live</span>}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => runProfile.mutate(p.id)}
                                                disabled={running}
                                                title="Run discovery"
                                                className="rounded p-1 opacity-70 transition-opacity hover:bg-background group-hover:opacity-100"
                                            >
                                                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => { setEditProfile(p); setShowProfile(true); }}
                                                title="Edit"
                                                className="rounded p-1 opacity-70 transition-opacity hover:bg-background group-hover:opacity-100"
                                            >
                                                <Settings2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => deleteProfile.mutate(p.id)}
                                                title="Delete"
                                                className="rounded p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                            <Badge variant="secondary">{count}</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {mediaProfiles.length === 0 && (
                            <p className="px-3 py-3 text-xs text-muted-foreground">
                                No media interests yet. Create one to start discovery.
                            </p>
                        )}
                    </div>
                    {intelligence}
                </div>

                {/* Review grid */}
                <div className="space-y-4">
                    {visible.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">{visible.length} pending candidates</p>
                                <p className="text-xs text-muted-foreground">
                                    {activeProfile === ALL ? 'Across every media interest' : 'For the selected interest'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" disabled={bulkReject.isPending}>
                                            {bulkReject.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                                            Clear <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60">
                                        <DropdownMenuLabel>Clear from this view</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <ClearItem icon={TrendingDown} label="Weak (low relevance)" ids={clearGroups.weak} onPick={clearWhere} />
                                        <ClearItem icon={Eye} label="Visual (not audio-first)" ids={clearGroups.visual} onPick={clearWhere} />
                                        <ClearItem icon={Podcast} label="Non-podcasts" ids={clearGroups.nonPodcast} onPick={clearWhere} />
                                        <ClearItem icon={Captions} label="No transcript" ids={clearGroups.noTranscript} onPick={clearWhere} />
                                        <ClearItem icon={Scissors} label="Needs trimming" ids={clearGroups.needsTrim} onPick={clearWhere} />
                                        <ClearItem icon={Youtube} label="Imported from YouTube" ids={clearGroups.imported} onPick={clearWhere} />
                                        <ClearItem icon={Radar} label="Auto-discovered (not imported)" ids={clearGroups.discovered} onPick={clearWhere} />
                                        <DropdownMenuSeparator />
                                        <ClearItem icon={X} label="Clear all shown" ids={clearGroups.all} onPick={clearWhere} destructive />
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={bulkApprove.isPending || approvableVisible.length === 0}
                                    onClick={() => bulkApprove.mutate(approvableVisible.map((s) => s.id))}
                                >
                                    <Check className="mr-1 h-4 w-4" /> Approve all
                                    {approvableVisible.length !== visible.length ? ` (${approvableVisible.length})` : ''}
                                </Button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : visible.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                                <Radar className="h-8 w-8 text-muted-foreground" />
                                <p className="font-medium">No suggestions yet</p>
                                <p className="max-w-sm text-sm text-muted-foreground">
                                    Create a media interest and run discovery, or build the source graph to surface
                                    channels related to your approved roster.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-5">
                            {imported.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Youtube className="h-4 w-4 text-gold" />
                                        <h3 className="text-sm font-semibold">Imported from YouTube</h3>
                                        <Badge variant="secondary">{imported.length}</Badge>
                                        <span className="text-xs text-muted-foreground">channels you pasted in</span>
                                    </div>
                                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                                        {imported.map((s) => (
                                            <MediaSuggestionCard
                                                key={s.id}
                                                suggestion={s}
                                                relationship={relationships?.[s.id]}
                                                selected={selectedSuggestionId === s.id}
                                                busy={busy}
                                                onSelect={() => selectSuggestion(s.id)}
                                                onApprove={() => approve.mutate(s.id)}
                                                onReject={() => reject.mutate({ id: s.id })}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {discovered.length > 0 && (
                                <section className="space-y-3">
                                    {imported.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Radar className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="text-sm font-semibold">Auto-discovered</h3>
                                            <Badge variant="secondary">{discovered.length}</Badge>
                                        </div>
                                    )}
                                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                                        {discovered.map((s) => (
                                            <MediaSuggestionCard
                                                key={s.id}
                                                suggestion={s}
                                                relationship={relationships?.[s.id]}
                                                selected={selectedSuggestionId === s.id}
                                                busy={busy}
                                                onSelect={() => selectSuggestion(s.id)}
                                                onApprove={() => approve.mutate(s.id)}
                                                onReject={() => reject.mutate({ id: s.id })}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ProfileDialog
                open={showProfile}
                onClose={() => setShowProfile(false)}
                profile={editProfile}
                category="media"
            />
        </div>
    );
}
