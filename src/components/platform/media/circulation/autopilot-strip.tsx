'use client';

import { useState } from 'react';
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
import type {
    MediaAutopilotElevatedMode,
    MediaAutopilotStatus,
    MediaCirculationPolicy,
} from '@/types/platform/media-circulation';
import {
    useElevateMediaAutopilot,
    usePauseMediaAutopilot,
    useRunMediaAutopilotNow,
} from '@/hooks/use-media-circulation';
import { AutopilotRunsSheet } from './autopilot-runs-sheet';

const STATE_STYLES: Record<string, string> = {
    off: 'bg-muted text-muted-foreground',
    observe: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    safe_auto: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    elevated: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    paused: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
};

const STATE_LABELS: Record<string, string> = {
    off: 'Off',
    observe: 'Observe',
    safe_auto: 'Safe Auto',
    elevated: 'Elevated',
    paused: 'Paused',
};

const ELEVATED_MODES: { value: MediaAutopilotElevatedMode; label: string; hint: string }[] = [
    { value: 'storage_relief', label: 'Storage relief', hint: 'Evict caps up, intake paused' },
    { value: 'quality_repair', label: 'Quality repair', hint: 'Re-encode throughput up' },
    { value: 'atomization_catchup', label: 'Atomization catch-up', hint: 'Atomize cap ×3' },
];

function formatWhen(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface AutopilotStripProps {
    autopilot: MediaAutopilotStatus;
    policy: MediaCirculationPolicy;
    savingPolicy: boolean;
    onSavePolicy: (data: Partial<MediaCirculationPolicy>) => void;
}

export function AutopilotStrip({ autopilot, policy, savingPolicy, onSavePolicy }: AutopilotStripProps) {
    const [runsOpen, setRunsOpen] = useState(false);
    const runNow = useRunMediaAutopilotNow();
    const pause = usePauseMediaAutopilot();
    const elevate = useElevateMediaAutopilot();

    const paused = autopilot.state === 'paused';
    const earned = autopilot.trust.filter((t) => t.earned);

    const enableAutopilot = () => onSavePolicy({ ...policy, autopilot_enabled: true, autopilot_mode: 'observe' });
    const enableSafeAuto = () => onSavePolicy({ ...policy, autopilot_enabled: true, autopilot_mode: 'safe_auto' });
    const backToObserve = () => onSavePolicy({ ...policy, autopilot_mode: 'observe' });
    const disableAutopilot = () => onSavePolicy({ ...policy, autopilot_enabled: false });

    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Autopilot</span>
                    <Badge className={cn('border-transparent', STATE_STYLES[autopilot.state] ?? STATE_STYLES.off)}>
                        {STATE_LABELS[autopilot.state] ?? autopilot.state}
                        {autopilot.state === 'elevated' && autopilot.elevated_mode
                            ? ` · ${autopilot.elevated_mode.replace(/_/g, ' ')}`
                            : ''}
                    </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                        Last run:{' '}
                        {autopilot.last_run
                            ? `${formatWhen(autopilot.last_run.started_at)} — ${autopilot.last_run.summary || autopilot.last_run.status}`
                            : 'never'}
                    </span>
                    {autopilot.enabled && !paused && <span>Next: {formatWhen(autopilot.next_run_at)}</span>}
                    {paused && <span>Paused until {formatWhen(autopilot.paused_until)}</span>}
                    <span>
                        Trust: {earned.length}/{autopilot.trust.length || 0} verdict types earned
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRunsOpen(true)}>
                        Runs & ledger
                    </Button>
                    {autopilot.enabled && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={runNow.isPending}
                                onClick={() => runNow.mutate()}
                            >
                                {runNow.isPending ? 'Running…' : 'Run now'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pause.isPending}
                                onClick={() => pause.mutate(paused ? 0 : 360)}
                            >
                                {paused ? 'Resume' : 'Pause 6h'}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={elevate.isPending || savingPolicy}>
                                        More
                                    </Button>} />
                                <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuLabel>Elevated modes (time-boxed 2h)</DropdownMenuLabel>
                                    {ELEVATED_MODES.map((m) => (
                                        <DropdownMenuItem
                                            key={m.value}
                                            onClick={() => elevate.mutate({ mode: m.value })}
                                        >
                                            <div>
                                                <div className="text-sm">{m.label}</div>
                                                <div className="text-xs text-muted-foreground">{m.hint}</div>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                    {autopilot.elevated_mode ? (
                                        <DropdownMenuItem onClick={() => elevate.mutate({ mode: '' })}>
                                            Clear elevated mode
                                        </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                    {autopilot.mode === 'safe_auto' ? (
                                        <DropdownMenuItem onClick={backToObserve}>
                                            Drop to Observe (shadow mode)
                                        </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuItem className="text-destructive" onClick={disableAutopilot}>
                                        Disable Autopilot
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                    {!autopilot.enabled && (
                        <Button size="sm" disabled={savingPolicy} onClick={enableAutopilot}>
                            Enable (Observe)
                        </Button>
                    )}
                    {autopilot.enabled && autopilot.mode === 'observe' && earned.length > 0 && (
                        <Button size="sm" disabled={savingPolicy} onClick={enableSafeAuto}>
                            Enable Safe Auto
                        </Button>
                    )}
                </div>
            </div>

            {autopilot.recommended_action ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Recommended:</span>{' '}
                    {autopilot.recommended_action}
                </p>
            ) : null}

            {autopilot.trust.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {autopilot.trust.map((t) => (
                        <span
                            key={t.verdict}
                            title={`${t.decisions} decisions · ${t.reverts} reverts (${t.revert_pct.toFixed(0)}%)`}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                                t.earned
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-border bg-muted/40 text-muted-foreground'
                            )}
                        >
                            {t.verdict}
                            <span className="opacity-70">{t.earned ? '✓' : `${t.decisions}`}</span>
                        </span>
                    ))}
                </div>
            ) : null}

            <AutopilotRunsSheet open={runsOpen} onOpenChange={setRunsOpen} />
        </div>
    );
}
