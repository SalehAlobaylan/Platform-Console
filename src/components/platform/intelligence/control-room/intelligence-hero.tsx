'use client';

import Link from '@/lib/console-link';
import { Boxes, Compass, ExternalLink, Loader2, MoreHorizontal, RefreshCw, SlidersHorizontal, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type { IntelligenceDiagnostics } from '@/types/platform/media-circulation';

interface IntelligenceHeroProps {
    diagnostics?: IntelligenceDiagnostics;
    fetching: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onOpenTuning: () => void;
}

const DIAGNOSTIC_LINKS = [
    { href: '/platform/media/circulation', label: 'Media circulation' },
    { href: '/platform/intelligence/flags', label: 'Content flags' },
    { href: '/platform/intelligence/analytics', label: 'Analytics' },
    { href: '/platform/intelligence/preview', label: 'Feed preview' },
];

/**
 * The Intelligence control-room hero — the media-value engine's vital signs +
 * primary actions, in the dark cockpit language shared with Media Circulation.
 */
export function IntelligenceHero({ diagnostics, fetching, refreshing, onRefresh, onOpenTuning }: IntelligenceHeroProps) {
    const d = diagnostics;
    const totalTracked = d ? d.scored_count + d.unscored_count : 0;
    const coverage = totalTracked > 0 ? (d!.scored_count / totalTracked) * 100 : 0;

    return (
        <section
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100"
            style={{
                backgroundImage:
                    'radial-gradient(110% 160% at 88% -20%, hsl(var(--news) / 0.16), transparent 55%), radial-gradient(90% 120% at 0% 110%, rgba(148,163,184,0.08), transparent 60%)',
            }}
        >
            <div className="flex flex-col gap-6 p-5 md:p-6">
                {/* Identity + actions */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <p className="brand-overline text-news">Media value control room</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="font-editorial text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                Intelligence
                            </h1>
                            {d && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'uppercase tracking-wide',
                                        d.demand_measured
                                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                                            : 'border-white/15 bg-white/5 text-slate-300'
                                    )}
                                >
                                    {d.demand_measured ? 'demand measured' : 'demand estimated'}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                            The durable value engine behind every circulation and storage decision — which items are
                            earning their exposure, how fresh the scores are, and what listeners actually pull on.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {d?.oldest_computed_at ? `Oldest score ${formatRelativeTime(d.oldest_computed_at)}` : 'No scores computed yet'}
                            {fetching ? ' · refreshing' : ''}
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <Button
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="bg-news text-news-foreground hover:bg-news/90 active:scale-[0.98]"
                        >
                            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh scores
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onOpenTuning}
                            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                        >
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Tune engine
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">More</span>
                                </Button>} />
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Related surfaces</DropdownMenuLabel>
                                {DIAGNOSTIC_LINKS.map((link) => (
                                    <DropdownMenuItem key={link.href} render={<Link href={link.href}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            {link.label}
                                        </Link>} nativeButton={false} />
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Vitals */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Vital
                        icon={Boxes}
                        label="Score coverage"
                        value={`${coverage.toFixed(0)}%`}
                        detail={d ? `${d.scored_count.toLocaleString()} of ${totalTracked.toLocaleString()} scored` : '—'}
                    >
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-500',
                                    coverage >= 75 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-amber-400' : 'bg-news'
                                )}
                                style={{ width: `${Math.max(2, coverage)}%` }}
                            />
                        </div>
                    </Vital>
                    <Vital
                        icon={Compass}
                        label="Exploring"
                        value={`${d?.exploring_count ?? 0}`}
                        detail="earning their first exposure"
                        valueClass="text-sky-300"
                    />
                    <Vital
                        icon={RefreshCw}
                        label="Stale scores"
                        value={`${d?.stale_count ?? 0}`}
                        detail={(d?.unscored_count ?? 0) > 0 ? `${d!.unscored_count.toLocaleString()} never scored` : 'all fresh'}
                        valueClass={(d?.stale_count ?? 0) > 0 ? 'text-amber-300' : undefined}
                    />
                    <Vital
                        icon={TrendingDown}
                        label="Demoted"
                        value={`${d?.demoted_count ?? 0}`}
                        detail="soft-evicted, decaying back"
                        valueClass={(d?.demoted_count ?? 0) > 0 ? 'text-amber-300' : undefined}
                    />
                </div>
            </div>
        </section>
    );
}

function Vital({
    icon: Icon,
    label,
    value,
    detail,
    valueClass,
    children,
}: {
    icon: typeof Boxes;
    label: string;
    value: string;
    detail: string;
    valueClass?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p className={cn('mt-1.5 text-xl font-semibold tabular-nums text-white', valueClass)}>{value}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>
            {children}
        </div>
    );
}
