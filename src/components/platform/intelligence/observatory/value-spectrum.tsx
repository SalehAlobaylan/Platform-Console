'use client';

import { useMemo } from 'react';
import { ExternalLink, Loader2, MoreHorizontal, RefreshCw, SlidersHorizontal } from 'lucide-react';
import Link from '@/lib/console-link';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ObservatorySnapshot } from '@/types/platform/intelligence';

interface ValueSpectrumProps {
    snapshot?: ObservatorySnapshot;
    fetching: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onTune: () => void;
}

// Filament tints on the dark deck — deliberately fixed so worth always reads
// gold and auditioning items read as a cool cap over the golden mass.
const SETTLED = '#e0a92e'; // established worth
const AUDITION = '#7dd3fc'; // exploring / re-trial

const RELATED = [
    { href: '/platform/media/circulation', label: 'Media circulation' },
    { href: '/platform/intelligence/analytics', label: 'Content analytics' },
    { href: '/platform/intelligence/flags', label: 'Content flags' },
    { href: '/platform/intelligence/preview', label: 'Feed preview' },
];

// SVG canvas geometry.
const W = 1000;
const H = 300;
const PAD_L = 44;
const PAD_R = 24;
const TOP = 46;
const BASE = 250;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = BASE - TOP;

/**
 * The Value Spectrum — the signature visualization. The whole library's worth
 * rendered as a luminous spectrograph: one filament per value bin, height =
 * item count, the golden settled mass capped by the cool auditioning cohort,
 * with hairline reference guides at the P25 intake gate and the median. The
 * title states the insight, not the chart type.
 */
export function ValueSpectrum({ snapshot, fetching, refreshing, onRefresh, onTune }: ValueSpectrumProps) {
    const model = useMemo(() => buildModel(snapshot), [snapshot]);

    return (
        <section
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100"
            style={{
                backgroundImage:
                    'radial-gradient(120% 140% at 78% -30%, rgba(224,169,46,0.14), transparent 55%), radial-gradient(90% 130% at 0% 120%, rgba(125,211,252,0.06), transparent 60%)',
            }}
        >
            <div className="flex flex-col gap-5 p-5 md:p-6">
                {/* Identity + insight + actions */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <p className="brand-overline text-[#e0a92e]">The library, appraised</p>
                        <h1 className="mt-1 max-w-2xl font-editorial text-2xl font-semibold leading-tight tracking-tight text-white md:text-[28px]">
                            {model.insight}
                        </h1>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                            {model.scored.toLocaleString()} items appraised
                            {fetching ? ' · refreshing' : ''}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        <Button
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="bg-[#e0a92e] text-slate-950 hover:bg-[#e0a92e]/90 active:scale-[0.98]"
                        >
                            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Re-appraise
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onTune}
                            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                        >
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Tune
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Related surfaces</span>
                                </Button>} />
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Related surfaces</DropdownMenuLabel>
                                {RELATED.map((r) => (
                                    <DropdownMenuItem key={r.href} render={<Link href={r.href}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            {r.label}
                                        </Link>} nativeButton={false} />
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* The spectrograph */}
                <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Distribution of media value across the library">
                        {/* baseline */}
                        <line x1={PAD_L} y1={BASE} x2={W - PAD_R} y2={BASE} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

                        {/* x ticks */}
                        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                            const x = PAD_L + t * PLOT_W;
                            return (
                                <g key={t}>
                                    <line x1={x} y1={BASE} x2={x} y2={BASE + 5} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                                    <text x={x} y={BASE + 20} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
                                        {t.toFixed(2)}
                                    </text>
                                </g>
                            );
                        })}
                        <text x={PAD_L} y={H - 4} className="fill-slate-600" style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                            durable value →
                        </text>

                        {/* filaments */}
                        {model.bins.map((b, i) => {
                            const x = PAD_L + (i / model.bins.length) * PLOT_W;
                            const bw = (PLOT_W / model.bins.length) * 0.62;
                            const cx = x + (PLOT_W / model.bins.length - bw) / 2;
                            if (b.total === 0) {
                                // faint tick so empty regions still read as axis
                                return <rect key={i} x={cx} y={BASE - 2} width={bw} height={2} fill="rgba(255,255,255,0.05)" rx={1} />;
                            }
                            const h = Math.max(3, (b.total / model.maxBin) * PLOT_H);
                            const explH = (b.exploring / b.total) * h;
                            const settH = h - explH;
                            return (
                                <g key={i}>
                                    {/* settled (gold) base */}
                                    {settH > 0 && (
                                        <rect x={cx} y={BASE - settH} width={bw} height={settH} fill={SETTLED} rx={1.5} opacity={0.92} />
                                    )}
                                    {/* auditioning (sky) cap */}
                                    {explH > 0 && (
                                        <rect x={cx} y={BASE - h} width={bw} height={explH} fill={AUDITION} rx={1.5} opacity={0.85} />
                                    )}
                                </g>
                            );
                        })}

                        {/* reference guides: P25 gate + median */}
                        {model.scored > 0 && (
                            <>
                                <Guide x={PAD_L + model.p25 * PLOT_W} color="#ff6b6b" label={`P25 ${model.p25.toFixed(2)}`} sub="intake gate" />
                                <Guide x={PAD_L + model.median * PLOT_W} color="rgba(255,255,255,0.85)" label={`median ${model.median.toFixed(2)}`} sub="" align="end" />
                            </>
                        )}
                    </svg>
                </div>

                {/* Readout rail + legend */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <Readout label="Scored" value={model.scored.toLocaleString()} />
                        <Readout label="Auditioning" value={model.exploring.toLocaleString()} tint={AUDITION} />
                        <Readout label="Settled" value={model.established.toLocaleString()} tint={SETTLED} />
                        <Readout label="Median" value={model.median.toFixed(2)} />
                        <Readout label="Mean" value={model.mean.toFixed(2)} />
                    </div>
                    <div className="flex items-center gap-4 font-mono text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SETTLED }} /> settled worth
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: AUDITION }} /> auditioning
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Guide({ x, color, label, sub, align = 'start' }: { x: number; color: string; label: string; sub?: string; align?: 'start' | 'end' }) {
    const anchor = align === 'end' ? 'end' : 'start';
    const dx = align === 'end' ? -6 : 6;
    return (
        <g>
            <line x1={x} y1={TOP - 6} x2={x} y2={BASE} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
            <circle cx={x} cy={TOP - 6} r={2.5} fill={color} />
            <text x={x + dx} y={TOP + 4} textAnchor={anchor} fill={color} style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                {label}
            </text>
            {sub && (
                <text x={x + dx} y={TOP + 20} textAnchor={anchor} className="fill-slate-500" style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                    {sub}
                </text>
            )}
        </g>
    );
}

function Readout({ label, value, tint }: { label: string; value: string; tint?: string }) {
    return (
        <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {tint && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: tint }} />}
                {label}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">{value}</p>
        </div>
    );
}

interface SpectrumModel {
    bins: { total: number; exploring: number; established: number }[];
    maxBin: number;
    scored: number;
    exploring: number;
    established: number;
    median: number;
    p25: number;
    mean: number;
    insight: string;
}

function buildModel(snapshot?: ObservatorySnapshot): SpectrumModel {
    const bins = (snapshot?.value_histogram ?? []).map((b) => ({
        total: b.total,
        exploring: b.exploring,
        established: b.established,
    }));
    const maxBin = Math.max(1, ...bins.map((b) => b.total));
    const scored = snapshot?.scored_count ?? 0;
    const exploring = snapshot?.exploring_count ?? 0;
    const established = snapshot?.established_count ?? 0;
    const median = snapshot?.value_median ?? 0;
    const p25 = snapshot?.value_p25 ?? 0;
    const mean = snapshot?.value_mean ?? 0;

    // Count below 0.4 for the insight.
    const below = (snapshot?.value_histogram ?? [])
        .filter((b) => b.max <= 0.4)
        .reduce((s, b) => s + b.total, 0);

    let insight: string;
    if (scored === 0) {
        insight = 'No items appraised yet — the engine scores the library as impressions accumulate.';
    } else if (exploring / Math.max(1, scored) > 0.6) {
        insight = `${exploring.toLocaleString()} of ${scored.toLocaleString()} items are still auditioning — the library's worth is provisional until exposure accumulates.`;
    } else if (below / scored > 0.5) {
        insight = `${below.toLocaleString()} of ${scored.toLocaleString()} items sit below 0.40 — the library skews low-value, so intake quality is what moves the needle.`;
    } else {
        insight = `The settled library centres on a value of ${median.toFixed(2)} — most items clear the P25 intake gate.`;
    }

    return { bins, maxBin, scored, exploring, established, median, p25, mean, insight };
}
