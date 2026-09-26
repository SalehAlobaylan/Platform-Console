'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  Eye,
  History,
  ListTree,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useCloseSystemIncidentEpisode,
  usePauseSystemAutopilotContainment,
  useRunSystemAutopilotNow,
  useSystemAutopilotStatus,
  useUpdateSystemAutopilotPolicy,
} from '@/hooks/use-system-autopilot';
import type {
  SystemAutopilotMode,
  SystemIncidentEpisode,
} from '@/types/platform/system-autopilot';
import { SystemIncidentCloseDialog } from './system-incident-close-dialog';
import { SystemIncidentHistorySheet } from './system-incident-history-sheet';
import { SystemAutopilotRunsSheet } from './system-autopilot-runs-sheet';
import { SystemAutopilotPolicySheet } from './system-autopilot-policy-sheet';
import { SystemContainmentTargets } from './system-containment-targets';

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'resolved') return 'success';
  if (status === 'recovering') return 'warning';
  if (status === 'open') return 'destructive';
  return 'secondary';
}

function headlineLabel(value?: string): string {
  switch (value) {
    case 'all_clear':
      return 'Clear and reconciled';
    case 'incident_open':
      return 'Incident active';
    case 'contained':
      return 'Containment active';
    case 'recovering':
      return 'Recovery checking';
    case 'watching':
      return 'Watching signals';
    default:
      return value?.replaceAll('_', ' ') || 'Unknown';
  }
}

function IncidentRow({
  episode,
  onInspect,
  onClose,
  isClosing,
  canClose = true,
}: {
  episode: SystemIncidentEpisode;
  onInspect: () => void;
  onClose: (id: string) => void;
  isClosing: boolean;
  canClose?: boolean;
}) {
  const lastTransition = episode.timeline?.[episode.timeline.length - 1];
  return (
    <div className="flex min-h-[92px] flex-col justify-between gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(episode.status)}>
            {episode.status}
          </Badge>
          {episode.shadow ? <Badge variant="secondary">shadow</Badge> : null}
          <Badge variant="outline">{episode.root_service}</Badge>
          <span className="text-xs text-muted-foreground">
            {episode.verdict}
          </span>
        </div>
        <p className="text-sm font-medium leading-5">{episode.summary}</p>
        {episode.root_cause_hint ? (
          <p className="text-xs text-muted-foreground">
            {episode.root_cause_hint}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          First seen {formatDate(episode.first_detected_at)} · Last seen{' '}
          {formatDate(episode.last_seen_at)}
        </p>
        {lastTransition ? (
          <p className="text-xs text-muted-foreground">
            Last transition: {lastTransition.transition} ·{' '}
            {formatDate(lastTransition.at)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <Button type="button" variant="outline" size="sm" onClick={onInspect}>
          <Eye className="mr-2 h-4 w-4" />
          Inspect
        </Button>
        {canClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isClosing}
            onClick={() => onClose(episode.id)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SystemAutopilotPanel({
  initialEpisodeId,
  onIncidentChange,
}: {
  initialEpisodeId?: string | null;
  onIncidentChange?: (id: string | null) => void;
} = {}) {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useSystemAutopilotStatus();
  const updatePolicy = useUpdateSystemAutopilotPolicy();
  const runNow = useRunSystemAutopilotNow();
  const pauseContainment = usePauseSystemAutopilotContainment();
  const closeEpisode = useCloseSystemIncidentEpisode();
  const [episodeToClose, setEpisodeToClose] =
    useState<SystemIncidentEpisode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(!!initialEpisodeId);
  const [runsOpen, setRunsOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    if (initialEpisodeId) setHistoryOpen(true);
  }, [initialEpisodeId]);

  const policy = data?.policy;
  const containmentPaused =
    !!policy?.containment_paused_until &&
    new Date(policy.containment_paused_until).getTime() > Date.now();
  const openEpisodes = data?.open_episodes ?? [];
  const recentInactiveEpisodes = (data?.recent_episodes ?? []).filter(
    (episode) => episode.status !== 'open' && episode.status !== 'recovering'
  );
  const latestRunSummary = data?.latest_run?.summary;
  const monitor = data?.monitor;
  const containment = data?.containment;
  const monitorLabel =
    monitor?.state === 'fresh'
      ? 'Fresh evidence'
      : monitor?.state === 'never_observed'
        ? 'No probe yet'
        : monitor?.state === 'overdue'
          ? 'Monitor overdue'
          : monitor?.state === 'unavailable'
            ? 'Evidence unavailable'
            : monitor?.state === 'disabled'
              ? 'Scheduled monitor off'
              : monitor?.state === 'running'
                ? 'Probe running'
                : 'Monitor state unknown';
  const monitorVariant =
    monitor?.state === 'fresh'
      ? 'success'
      : monitor?.state === 'overdue' || monitor?.state === 'unavailable'
        ? 'destructive'
        : 'warning';

  if (isLoading && !data) {
    return (
      <Card
        className="h-40 animate-pulse"
        aria-label="Loading System Health Autopilot"
      />
    );
  }

  if (isError && !data) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Bot className="h-5 w-5" /> System Health Autopilot unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            {error instanceof Error
              ? error.message
              : 'CMS status could not be loaded.'}
          </span>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5" />
            System Health Autopilot
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {latestRunSummary ??
              'CMS-owned incident detection and containment ledger.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={data?.state === 'safe_auto' ? 'success' : 'secondary'}
          >
            {data?.state === 'safe_auto'
              ? 'Safe Auto'
              : data?.state === 'observe'
                ? 'Observe'
                : data?.state === 'off'
                  ? 'Off'
                  : data?.state === 'paused'
                    ? 'Paused'
                    : 'Unknown'}
          </Badge>
          {data?.latest_run ? (
            <Badge
              variant={
                data.latest_run.headline === 'incident_open' ||
                data.latest_run.headline === 'contained'
                  ? 'warning'
                  : 'outline'
              }
            >
              {headlineLabel(data.latest_run.headline)}
            </Badge>
          ) : null}
          {data?.latest_run?.status &&
          data.latest_run.status !== 'completed' ? (
            <Badge
              variant={
                data.latest_run.status === 'failed' ? 'destructive' : 'warning'
              }
            >
              {data.latest_run.status}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Monitor</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={monitorVariant}>{monitorLabel}</Badge>
              {monitor?.evidence_age_seconds != null ? (
                <span className="text-xs text-muted-foreground">
                  {Math.max(0, Math.round(monitor.evidence_age_seconds / 60))}m
                  old
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monitor?.reason ?? 'Waiting for CMS monitor state.'}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Last evidence</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(monitor?.last_observed_at)}
            </p>
            <p className="text-xs text-muted-foreground">
              Next check {formatDate(monitor?.next_due_at)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Containment</p>
            <p className="mt-1 text-sm font-medium">
              {containment?.active ?? 0} active · {containment?.pending ?? 0}{' '}
              pending
            </p>
            <p className="text-xs text-muted-foreground">
              {containment?.human_owned ?? 0} human-owned ·{' '}
              {containment?.expired ?? 0} expired
            </p>
          </div>
        </div>
        {containment?.targets?.length ? (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Inspect containment by tenant
            </summary>
            <div className="mt-3">
              <SystemContainmentTargets targets={containment.targets} />
            </div>
          </details>
        ) : null}
        {data?.attention?.length ? (
          <div className="rounded-md border border-warning/50 bg-warning/5 p-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <p className="text-sm font-medium">Needs attention</p>
              <Badge variant="warning">{data.attention.length}</Badge>
            </div>
            <div className="mt-2 space-y-1">
              {data.attention.map((item, index) => (
                <p
                  key={`${item.target}-${item.at}-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {item.target}
                  </span>{' '}
                  {item.reason || item.guardrail || item.status}
                  {item.tenant_id ? ` · Tenant: ${item.tenant_id}` : ''}
                  {item.episode_id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="link"
                      onClick={() => {
                        onIncidentChange?.(item.episode_id!);
                        setHistoryOpen(true);
                      }}
                    >
                      Inspect incident
                    </Button>
                  )}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {isError && data ? (
            <p className="text-xs text-destructive sm:col-span-2">
              Status may be stale:{' '}
              {error instanceof Error
                ? error.message
                : 'latest refresh failed.'}
            </p>
          ) : null}
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <div className="flex h-10 items-center gap-3 rounded-md border px-3">
              <Switch
                id="system-autopilot-enabled"
                checked={policy?.enabled ?? false}
                disabled={!policy || isError || updatePolicy.isPending}
                onCheckedChange={(enabled) => updatePolicy.mutate({ enabled })}
              />
              <Label htmlFor="system-autopilot-enabled" className="text-sm">
                Enabled
              </Label>
            </div>
            <Select
              value={policy?.mode ?? 'observe'}
              disabled={!policy || isError || updatePolicy.isPending}
              onValueChange={(mode) =>
                updatePolicy.mutate({ mode: mode as SystemAutopilotMode })
              }
            >
              <SelectTrigger
                className="sm:w-40"
                aria-label="System Health Autopilot mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="observe">Observe</SelectItem>
                <SelectItem value="safe_auto">Safe Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            type="button"
            disabled={runNow.isPending}
            onClick={() => runNow.mutate()}
          >
            <Play className="mr-2 h-4 w-4" />
            Run diagnostic probe
          </Button>
          <Button
            type="button"
            variant={containmentPaused ? 'secondary' : 'outline'}
            disabled={!policy || isError || pauseContainment.isPending}
            onClick={() => pauseContainment.mutate(containmentPaused ? 0 : 120)}
          >
            <Pause className="mr-2 h-4 w-4" />
            {containmentPaused ? 'Resume containment' : 'Pause containment'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="mr-2 h-4 w-4" />
            Incident history
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRunsOpen(true)}
          >
            <ListTree className="mr-2 h-4 w-4" />
            Run ledger
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!policy}
            onClick={() => setPolicyOpen(true)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Policy
          </Button>
        </div>

        {openEpisodes.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Open incidents</h3>
            </div>
            <div className="space-y-2">
              {openEpisodes.map((episode) => (
                <IncidentRow
                  key={episode.id}
                  episode={episode}
                  isClosing={closeEpisode.isPending}
                  onInspect={() => {
                    onIncidentChange?.(episode.id);
                    setHistoryOpen(true);
                  }}
                  onClose={() => setEpisodeToClose(episode)}
                />
              ))}
            </div>
          </div>
        ) : recentInactiveEpisodes.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">No active incidents</h3>
            </div>
            {data?.attention?.length ||
            containment?.pending ||
            containment?.human_owned ? (
              <p className="text-xs text-muted-foreground">
                No episode is currently open, but CMS has retained attention
                items or containment outcomes for review.
              </p>
            ) : null}
            <div className="space-y-2">
              {recentInactiveEpisodes.slice(0, 3).map((episode) => (
                <IncidentRow
                  key={episode.id}
                  episode={episode}
                  isClosing={true}
                  canClose={false}
                  onInspect={() => {
                    onIncidentChange?.(episode.id);
                    setHistoryOpen(true);
                  }}
                  onClose={() => undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {!data?.latest_run
              ? 'No incident probe has run yet. Run a diagnostic probe to establish a baseline.'
              : monitor?.state === 'unavailable' || monitor?.state === 'overdue'
                ? 'No active episode is visible, but current System Health evidence is unavailable or overdue. Restore the monitor before treating this as clear.'
                : containment?.pending || containment?.human_owned
                  ? 'No active episode is visible. Containment or ownership outcomes still need review.'
                  : monitor?.fresh
                    ? 'No open System Health incidents recorded. Coverage is current according to CMS.'
                    : 'No open incidents recorded. Current coverage has not been verified.'}
          </div>
        )}

        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Detection rules &amp; containment coverage
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cadence</p>
                <p className="text-sm font-medium">
                  {policy?.interval_minutes ?? '—'} min
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Confirm</p>
                <p className="text-sm font-medium">
                  {policy?.confirm_probes ?? '—'} probes
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Resolve</p>
                <p className="text-sm font-medium">
                  {policy?.resolve_probes ?? '—'} probes
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Containment TTL</p>
                <p className="text-sm font-medium">
                  {policy?.containment_ttl_minutes ?? '—'} min
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Containment registry</h3>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(data?.registered_autopilots ?? []).map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <Badge
                        variant={
                          item.containment_enabled ? 'success' : 'secondary'
                        }
                      >
                        {item.containment_enabled ? 'on' : 'opted out'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.capabilities?.length
                        ? item.capabilities.join(', ')
                        : item.dependencies.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        <p className="text-xs text-muted-foreground">
          Last run {formatDate(data?.latest_run?.started_at)} · Last policy run{' '}
          {formatDate(policy?.last_run_at)}
        </p>
      </CardContent>
      <SystemIncidentCloseDialog
        episode={episodeToClose}
        open={!!episodeToClose}
        pending={closeEpisode.isPending}
        onOpenChange={(open) => !open && setEpisodeToClose(null)}
        onConfirm={(id, reason) =>
          closeEpisode.mutate(
            { id, reason },
            { onSuccess: () => setEpisodeToClose(null) }
          )
        }
      />
      <SystemIncidentHistorySheet
        open={historyOpen}
        selectedId={initialEpisodeId}
        onSelectedChange={onIncidentChange}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) onIncidentChange?.(null);
        }}
      />
      <SystemAutopilotRunsSheet open={runsOpen} onOpenChange={setRunsOpen} />
      {policy ? (
        <SystemAutopilotPolicySheet
          policy={policy}
          registered={data?.registered_autopilots ?? []}
          open={policyOpen}
          onOpenChange={setPolicyOpen}
        />
      ) : null}
    </Card>
  );
}
