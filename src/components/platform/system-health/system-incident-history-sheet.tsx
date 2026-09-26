'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemContainmentTargets } from './system-containment-targets';

function actionTarget(output: unknown): { tenant?: string; until?: string } {
  if (!output || typeof output !== 'object') return {};
  const record = output as Record<string, unknown>;
  return {
    tenant: typeof record.tenant_id === 'string' ? record.tenant_id : undefined,
    until:
      typeof record.paused_until === 'string' ? record.paused_until : undefined,
  };
}
import {
  useSystemIncidentEpisode,
  useSystemIncidentEpisodes,
} from '@/hooks/use-system-autopilot';

function allowedHref(value?: string) {
  if (!value) return null;
  const allowed = [
    '/platform/enrichment',
    '/platform/media',
    '/platform/pipeline',
    '/platform/system-health',
  ];
  return allowed.some((href) => value === href || value.startsWith(`${href}?`))
    ? value
    : null;
}

export function SystemIncidentHistorySheet({
  open,
  onOpenChange,
  selectedId,
  onSelectedChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(selectedId ?? null);
  useEffect(() => {
    setSelected(selectedId ?? null);
  }, [selectedId]);
  const episodesQuery = useSystemIncidentEpisodes(50, open);
  const detailQuery = useSystemIncidentEpisode(open ? selected : null);
  const episodes = episodesQuery.data?.items ?? [];
  const detail = detailQuery.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-5 sm:max-w-2xl"
      >
        <SheetHeader className="mb-4 text-left">
          <SheetTitle>System Health incident history</SheetTitle>
        </SheetHeader>
        {episodesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
        {episodesQuery.isError ? (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          >
            <p>Incident history could not be loaded.</p>
            <Button
              variant="outline"
              size="sm"
              disabled={episodesQuery.isFetching}
              onClick={() => void episodesQuery.refetch()}
            >
              Retry history
            </Button>
          </div>
        ) : null}
        {!episodesQuery.isLoading &&
        !episodesQuery.isError &&
        episodes.length === 0 ? (
          <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No incidents have been recorded. New incident episodes will appear
            here after a probe confirms them.
          </p>
        ) : null}
        <div className="space-y-2">
          {episodes.map((episode) => (
            <button
              key={episode.id}
              type="button"
              onClick={() => {
                const next = selected === episode.id ? null : episode.id;
                setSelected(next);
                onSelectedChange?.(next);
              }}
              className="w-full rounded-md border p-3 text-left hover:bg-muted/40"
            >
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    episode.status === 'open'
                      ? 'destructive'
                      : episode.status === 'recovering'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {episode.status}
                </Badge>
                {episode.shadow ? (
                  <Badge variant="secondary">shadow</Badge>
                ) : null}
                <span className="text-sm font-medium">
                  {episode.root_service}
                </span>
              </div>
              <p className="mt-2 text-sm">{episode.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {episode.verdict} · last seen{' '}
                {new Date(episode.last_seen_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
        {selected ? (
          <section className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Incident detail</h3>
            {detailQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : detailQuery.isError || !detail ? (
              <p className="text-sm text-destructive">
                Incident detail could not be loaded.
              </p>
            ) : (
              <>
                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-semibold">Recovery progress</h4>
                  {detail.recovery ? (
                    <>
                      <p className="mt-1 text-sm">
                        {detail.recovery.evidence_fresh
                          ? `Recovery check ${detail.recovery.healthy_samples} of ${detail.recovery.required_samples}`
                          : 'Recovery evidence is not current'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail.recovery.reason}
                      </p>
                      {detail.recovery.next_check_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Next check:{' '}
                          {new Date(
                            detail.recovery.next_check_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recovery progress has not been reported by CMS.
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {detail.episode.root_cause_hint || detail.episode.summary}
                </p>
                {allowedHref(detail.recommended_action?.href) ? (
                  <a
                    className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={detail.recommended_action.href}
                  >
                    {detail.recommended_action.label}
                  </a>
                ) : detail.recommended_action ? (
                  <p className="text-sm text-muted-foreground">
                    {detail.recommended_action.label}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Containment by tenant
                  </h4>
                  {detail.containment ? (
                    <SystemContainmentTargets
                      targets={detail.containment.targets}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Current containment ownership has not been reported by
                      CMS.
                    </p>
                  )}
                </div>
                {detail.episode.closed_by && (
                  <p className="rounded-md border p-3 text-sm">
                    Closed by {detail.episode.closed_by}:{' '}
                    {detail.episode.close_reason}. Closing an incident does not
                    verify recovery or release its pauses.
                  </p>
                )}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Transitions
                  </h4>
                  <div className="space-y-2">
                    {(detail.episode.timeline ?? []).map((entry, index) => (
                      <p
                        key={`${entry.at}-${index}`}
                        className="rounded-md border p-2 text-xs"
                      >
                        <strong>{entry.transition}</strong> ·{' '}
                        {new Date(entry.at).toLocaleString()}
                        <br />
                        {entry.summary || entry.verdict}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Action ledger
                  </h4>
                  <div className="space-y-2">
                    {detail.actions.map((action) => {
                      const target = actionTarget(action.output);
                      return (
                        <p
                          key={action.id}
                          className="rounded-md border p-2 text-xs"
                        >
                          <strong>{action.action}</strong> · {action.status}
                          <br />
                          {action.reason || action.guardrail || action.target}
                          <br />
                          Target: {action.target}
                          {target.tenant ? ` · Tenant: ${target.tenant}` : ''}
                          {target.until && (
                            <>
                              <br />
                              Recorded expiry:{' '}
                              {new Date(target.until).toLocaleString()}
                            </>
                          )}
                          <br />
                          {new Date(action.started_at).toLocaleString()}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
