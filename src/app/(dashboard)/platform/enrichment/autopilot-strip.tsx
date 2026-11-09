'use client';

import { useState } from 'react';
import { Bot, Play, Pause, Settings2, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  EnrichmentAutopilotPolicy,
  EnrichmentAutopilotStatus,
} from '@/types/platform/enrichment';
import {
  useEnrichmentAutopilot,
  useUpdateEnrichmentAutopilotPolicy,
  useRunEnrichmentAutopilotNow,
  usePauseEnrichmentAutopilot,
  useElevateEnrichmentAutopilot,
  useResetEnrichmentAutopilotTrust,
} from '@/hooks/use-enrichment';
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

const TRUST_STYLES: Record<string, string> = {
  trusted:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  probation: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  demoted: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EnrichmentAutopilotStrip() {
  const { data: autopilot, isLoading } = useEnrichmentAutopilot();
  const savePolicy = useUpdateEnrichmentAutopilotPolicy();
  const runNow = useRunEnrichmentAutopilotNow();
  const pause = usePauseEnrichmentAutopilot();
  const elevate = useElevateEnrichmentAutopilot();
  const resetTrust = useResetEnrichmentAutopilotTrust();

  const [runsOpen, setRunsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading || !autopilot) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
    );
  }

  const paused = autopilot.state === 'paused';
  const trusted = autopilot.trust.filter((t) => t.state === 'trusted');

  const patch = (data: Partial<EnrichmentAutopilotPolicy>) =>
    savePolicy.mutate(data);
  const enableObserve = () => patch({ enabled: true, mode: 'observe' });
  const enableSafeAuto = () => patch({ enabled: true, mode: 'safe_auto' });
  const backToObserve = () => patch({ mode: 'observe' });
  const disable = () => patch({ enabled: false });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Enrichment Autopilot</span>
          <Badge
            className={cn(
              'border-transparent',
              STATE_STYLES[autopilot.state] ?? STATE_STYLES.off
            )}
          >
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
          {autopilot.enabled && !paused && (
            <span>Next: {formatWhen(autopilot.next_run_at)}</span>
          )}
          {paused && (
            <span>Paused until {formatWhen(autopilot.paused_until)}</span>
          )}
          <span>
            Trust: {trusted.length}/{autopilot.trust.length || 0} classes earned
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRunsOpen(true)}>
            <ListChecks className="mr-1 h-4 w-4" />
            Runs &amp; ledger
          </Button>
          {autopilot.enabled && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={runNow.isPending}
                onClick={() => runNow.mutate()}
              >
                <Play className="mr-1 h-4 w-4" />
                {runNow.isPending ? 'Running…' : 'Run now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pause.isPending}
                onClick={() => pause.mutate(paused ? 0 : 360)}
              >
                <Pause className="mr-1 h-4 w-4" />
                {paused ? 'Resume' : 'Pause 6h'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                    variant="outline"
                    size="sm"
                    disabled={elevate.isPending || savePolicy.isPending}
                  >
                    More
                  </Button>} />
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Elevated mode</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => elevate.mutate({ mode: 'backfill_catchup' })}
                  >
                    <div>
                      <div className="text-sm">Backfill catch-up</div>
                      <div className="text-xs text-muted-foreground">
                        Item caps ×5 for 24h
                      </div>
                    </div>
                  </DropdownMenuItem>
                  {autopilot.elevated_mode ? (
                    <DropdownMenuItem
                      onClick={() => elevate.mutate({ mode: '' })}
                    >
                      Clear elevated mode
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Settings &amp; trust
                  </DropdownMenuItem>
                  {autopilot.mode === 'safe_auto' ? (
                    <DropdownMenuItem onClick={backToObserve}>
                      Drop to Observe (shadow)
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={disable}
                  >
                    Disable Autopilot
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {!autopilot.enabled && (
            <Button
              size="sm"
              disabled={savePolicy.isPending}
              onClick={enableObserve}
            >
              Enable (Observe)
            </Button>
          )}
          {autopilot.enabled &&
            autopilot.mode === 'observe' &&
            trusted.length > 0 && (
              <Button
                size="sm"
                disabled={savePolicy.isPending}
                onClick={enableSafeAuto}
              >
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
              key={t.artifact}
              title={`${t.attempts} attempts · ${t.failures} failures (${t.failure_pct.toFixed(0)}%) · ${t.state}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                TRUST_STYLES[t.state] ??
                  'border-border bg-muted/40 text-muted-foreground'
              )}
            >
              {t.artifact}
              <span className="opacity-70">
                {t.state === 'trusted'
                  ? '✓'
                  : t.state === 'demoted'
                    ? '✗'
                    : `${t.attempts}`}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <AutopilotRunsSheet open={runsOpen} onOpenChange={setRunsOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        autopilot={autopilot}
        saving={savePolicy.isPending}
        onSave={patch}
        onResetTrust={(artifact) => resetTrust.mutate(artifact)}
      />
    </div>
  );
}

// ── Settings & trust sheet ──────────────────────────────────

const KNOBS: {
  key: keyof EnrichmentAutopilotPolicy;
  label: string;
  hint: string;
}[] = [
  {
    key: 'interval_minutes',
    label: 'Interval (minutes)',
    hint: 'How often a run fires (15–1440).',
  },
  {
    key: 'max_items_per_run',
    label: 'Max items / run',
    hint: 'Total across all classes (10–2000).',
  },
  {
    key: 'max_items_per_class',
    label: 'Max items / class',
    hint: 'Per artifact class per run.',
  },
  {
    key: 'max_transcripts_per_run',
    label: 'Max transcripts / run',
    hint: 'Billable STT triggers per run.',
  },
  {
    key: 'max_queue_depth',
    label: 'Max ai-queue depth',
    hint: 'Skip embed/image above this backlog.',
  },
  {
    key: 'failure_breaker_pct',
    label: 'Failure breaker %',
    hint: 'Stop the run above this error rate.',
  },
  {
    key: 'stall_window_runs',
    label: 'Stall window (runs)',
    hint: 'Runs of no drain before autopilot embeds.',
  },
  {
    key: 'age_floor_minutes',
    label: 'Age floor (minutes)',
    hint: 'Never touch items newer than this.',
  },
  {
    key: 'trust_min_attempts',
    label: 'Trust: min attempts',
    hint: 'Attempts before a class is trusted.',
  },
  {
    key: 'trust_max_failure_pct',
    label: 'Trust: max failure %',
    hint: 'Demote a class above this rate.',
  },
];

function SettingsSheet({
  open,
  onOpenChange,
  autopilot,
  saving,
  onSave,
  onResetTrust,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  autopilot: EnrichmentAutopilotStatus;
  saving: boolean;
  onSave: (data: Partial<EnrichmentAutopilotPolicy>) => void;
  onResetTrust: (artifact: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<EnrichmentAutopilotPolicy>>({});
  const value = (key: keyof EnrichmentAutopilotPolicy) =>
    (draft[key] as number | undefined) ?? (autopilot.policy[key] as number);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-5 sm:max-w-md"
      >
        <SheetHeader className="mb-4 text-left">
          <SheetTitle>Autopilot settings &amp; trust</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3">
          {KNOBS.map((k) => (
            <div key={k.key} className="space-y-1">
              <Label htmlFor={k.key} className="text-xs">
                {k.label}
              </Label>
              <Input
                id={k.key}
                type="number"
                value={value(k.key)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = Number(raw);
                  if (raw === '' || !Number.isFinite(n)) return;
                  setDraft((d) => ({ ...d, [k.key]: n }));
                }}
              />
              <p className="text-[11px] text-muted-foreground">{k.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft({})}>
            Reset
          </Button>
          <Button
            size="sm"
            disabled={saving || Object.keys(draft).length === 0}
            onClick={() => onSave(draft)}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">
            Trust per artifact class
          </h3>
          <div className="space-y-1.5">
            {autopilot.trust.map((t) => (
              <div
                key={t.artifact}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
              >
                <span className="font-medium">{t.artifact}</span>
                <span className="text-muted-foreground">
                  {t.attempts} attempts · {t.failure_pct.toFixed(0)}% fail
                </span>
                <Badge
                  className={cn(
                    'border-transparent',
                    TRUST_STYLES[t.state] ?? 'bg-muted text-muted-foreground'
                  )}
                >
                  {t.state}
                </Badge>
                {t.state === 'demoted' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResetTrust(t.artifact)}
                  >
                    Reset trust
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
