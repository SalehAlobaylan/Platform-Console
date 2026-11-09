'use client';

import Link from '@/lib/console-link';
import {
    Boxes,
    Database,
    ExternalLink,
    Gauge,
    Loader2,
    MoreHorizontal,
    RefreshCw,
    Settings2,
    Workflow,
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import { formatBytes } from '@/hooks/use-storage';
import type { MediaCirculationCockpit } from '@/types/platform/media-circulation';
import { bucketBarClass, headlineClass } from './verdict-styles';

interface CockpitHeroProps {
    cockpit: MediaCirculationCockpit;
    fetching: boolean;
    generating: boolean;
    savingPolicy: boolean;
    activeBucket: string;
    onBucket: (bucket: string) => void;
    onGenerate: () => void;
    onToggleEngine: (enabled: boolean) => void;
    onOpenPolicy: () => void;
}

const DIAGNOSTIC_LINKS = [
    { href: '/platform/intelligence', label: 'Intelligence control room' },
    { href: '/platform/storage', label: 'Storage health' },
    { href: '/platform/media/atomization', label: 'Atomization runs' },
    { href: '/platform/quality', label: 'Quality profiles' },
];

export function CockpitHero({
    cockpit,
    fetching,
    generating,
    savingPolicy,
    activeBucket,
    onBucket,
    onGenerate,
    onToggleEngine,
    onOpenPolicy,
}: CockpitHeroProps) {
    const { health, storage, op_budget: op, atomization_backlog: backlog, summary } = cockpit;
    const utilization = Math.min(100, Math.max(0, storage.utilization_pct || 0));

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
                        <p className="brand-overline text-news">Media control room</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="font-editorial text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                Media Circulation
                            </h1>
                            <Badge variant="outline" className={cn('uppercase tracking-wide', headlineClass(health.headline))}>
                                {health.headline.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{health.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Updated {formatRelativeTime(health.generated_at)}
                            {fetching ? ' · refreshing' : ''}
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                            <Switch
                                checked={health.enabled}
                                disabled={savingPolicy}
                                onCheckedChange={onToggleEngine}
                                aria-label="Engine enabled"
                            />
                            <span className="text-sm font-medium text-slate-200">
                                {health.enabled ? 'Engine on' : 'Engine off'}
                            </span>
                        </label>
                        <Button
                            onClick={onGenerate}
                            disabled={generating || !health.enabled}
                            className="bg-news text-news-foreground hover:bg-news/90 active:scale-[0.98]"
                        >
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Generate recommendations
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">More actions</span>
                                </Button>} />
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={onOpenPolicy}>
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    Policy &amp; overrides
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Diagnostics</DropdownMenuLabel>
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

                {/* Vitals + library shelf */}
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Vital
                            icon={Database}
                            label="Storage pressure"
                            value={`${utilization.toFixed(1)}%`}
                            detail={`${formatBytes(storage.used_bytes)} of ${formatBytes(storage.quota_bytes)}`}
                        >
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-500',
                                        utilization >= 90 ? 'bg-news' : utilization >= 75 ? 'bg-amber-400' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${Math.max(2, utilization)}%` }}
                                />
                            </div>
                        </Vital>
                        <Vital
                            icon={Gauge}
                            label="Op budget"
                            value={op?.class_a_status === 'cap' ? 'At cap' : op?.class_a_status === 'warn' ? 'Warning' : 'OK'}
                            valueClass={op?.class_a_status === 'cap' ? 'text-news' : op?.class_a_status === 'warn' ? 'text-amber-300' : undefined}
                            detail={`${(op?.class_a_remaining ?? 0).toLocaleString()} Class A ops left`}
                        />
                        <Vital
                            icon={Workflow}
                            label="Atomization backlog"
                            value={`${backlog?.backlog_depth ?? 0}`}
                            detail={
                                (backlog?.intake_dampening_factor ?? 1) < 1
                                    ? `damping intake to ${Math.round((backlog?.intake_dampening_factor ?? 1) * 100)}%`
                                    : `${backlog?.transcript_wait_count ?? 0} waiting on transcripts`
                            }
                            valueClass={(backlog?.intake_dampening_factor ?? 1) < 1 ? 'text-amber-300' : undefined}
                        />
                        <Vital
                            icon={Boxes}
                            label="Pending decisions"
                            value={`${summary.pending}`}
                            detail={`${summary.needs_attention} need attention`}
                            valueClass={summary.needs_attention > 0 ? 'text-news' : undefined}
                        />
                    </div>

                    <LibraryShelf cockpit={cockpit} activeBucket={activeBucket} onBucket={onBucket} />
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
    icon: typeof Database;
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

/**
 * The library shelf — the six Pods duration buckets rendered as a
 * demand-vs-coverage skyline. In the measured regime each shelf shows two
 * bars: what listeners ask for (demand, measured serve-side) next to what the
 * shelf holds (coverage, value-weighted supply) — a demand bar towering over
 * its coverage bar is an under-stocked shelf. Before telemetry accumulates it
 * falls back to the single supply-scaled bar and the badge says "estimated".
 * Clicking a shelf filters the decision queue.
 */
function LibraryShelf({
    cockpit,
    activeBucket,
    onBucket,
}: {
    cockpit: MediaCirculationCockpit;
    activeBucket: string;
    onBucket: (bucket: string) => void;
}) {
    const thinCount = cockpit.buckets.filter((b) => b.state === 'thin').length;
    const measured = cockpit.buckets.some((b) => b.measured);
    // Fallback (estimated) regime: scale the single supply bar to the fullest
    // shelf so relative supply is readable; state color carries the judgment.
    const maxUnits = Math.max(1, ...cockpit.buckets.map((b) => b.visible_units));
    return (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Library shelf · demand vs coverage
                </p>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                    <span
                        className={cn(
                            'rounded-full border px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide',
                            measured
                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                                : 'border-white/15 bg-white/5 text-slate-400'
                        )}
                        title={
                            measured
                                ? 'Demand is measured from real feed serves (serve share, exhaustions, repeats)'
                                : 'Not enough serve telemetry yet — demand is estimated from supply counts'
                        }
                    >
                        {measured ? 'measured' : 'estimated'}
                    </span>
                    {thinCount > 0 ? `${thinCount} thin` : 'all stocked'}
                </span>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-2">
                {cockpit.buckets.map((bucket) => {
                    const active = activeBucket === bucket.bucket;
                    const demandH = Math.min(100, Math.max(6, bucket.demand_score * 100));
                    const coverageH = Math.min(100, Math.max(6, bucket.coverage_score * 100));
                    const supplyH = Math.min(100, Math.max(10, (bucket.visible_units / maxUnits) * 100));
                    return (
                        <button
                            key={bucket.bucket}
                            type="button"
                            onClick={() => onBucket(active ? 'all' : bucket.bucket)}
                            title={
                                bucket.measured
                                    ? `${bucket.bucket}: demand ${(bucket.demand_score * 100).toFixed(0)} vs coverage ${(bucket.coverage_score * 100).toFixed(0)} — gap ${bucket.gap >= 0 ? '+' : ''}${(bucket.gap * 100).toFixed(0)} (${bucket.state}); ${bucket.visible_units} visible units`
                                    : `${bucket.bucket}: ${bucket.visible_units} visible units (${bucket.state}, estimated)`
                            }
                            className={cn(
                                'group rounded-md border p-1.5 pt-2 transition-colors',
                                active
                                    ? 'border-news bg-news/10'
                                    : 'border-transparent hover:border-white/20 hover:bg-white/5'
                            )}
                        >
                            <div className="flex h-14 items-end justify-center gap-0.5">
                                {bucket.measured ? (
                                    <>
                                        {/* demand — what listeners ask for */}
                                        <div
                                            className="w-2.5 rounded-sm bg-slate-400/70 transition-all duration-300"
                                            style={{ height: `${demandH}%` }}
                                        />
                                        {/* coverage — what the shelf holds, value-weighted */}
                                        <div
                                            className={cn('w-2.5 rounded-sm transition-all duration-300', bucketBarClass(bucket.state))}
                                            style={{ height: `${coverageH}%` }}
                                        />
                                    </>
                                ) : (
                                    <div
                                        className={cn('w-5 rounded-sm transition-all duration-300', bucketBarClass(bucket.state))}
                                        style={{ height: `${supplyH}%` }}
                                    />
                                )}
                            </div>
                            <p className={cn('mt-1.5 text-center text-xs font-semibold', active ? 'text-news' : 'text-slate-300')}>
                                {bucket.bucket}
                            </p>
                            <p className="text-center text-[10px] tabular-nums text-slate-500">{bucket.visible_units}</p>
                        </button>
                    );
                })}
            </div>
            {measured && (
                <p className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-slate-400/70" /> demand
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> coverage (value-weighted)
                    </span>
                </p>
            )}
        </div>
    );
}
