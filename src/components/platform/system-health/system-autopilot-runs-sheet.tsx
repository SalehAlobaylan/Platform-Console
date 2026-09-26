'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSystemAutopilotRun,
  useSystemAutopilotRuns,
} from '@/hooks/use-system-autopilot';

function when(value?: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export function SystemAutopilotRunsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const runsQuery = useSystemAutopilotRuns(20, open);
  const detailQuery = useSystemAutopilotRun(open ? selected : null);
  const runs = runsQuery.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-5 sm:max-w-2xl"
      >
        <SheetHeader className="mb-4 text-left">
          <SheetTitle>System Health runs & ledger</SheetTitle>
        </SheetHeader>
        {runsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}
        {runsQuery.isError ? (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          >
            <p>Run history could not be loaded.</p>
            <Button
              variant="outline"
              size="sm"
              disabled={runsQuery.isFetching}
              onClick={() => void runsQuery.refetch()}
            >
              Retry run history
            </Button>
          </div>
        ) : null}
        {!runsQuery.isLoading && !runsQuery.isError && runs.length === 0 ? (
          <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            No System Health runs have been recorded.
          </p>
        ) : null}
        <div className="space-y-2">
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelected(selected === run.id ? null : run.id)}
              className="w-full rounded-md border p-3 text-left hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    run.status === 'failed'
                      ? 'destructive'
                      : run.status === 'partial'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {run.status}
                </Badge>
                <span className="text-sm font-medium">{run.headline}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {when(run.started_at)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {run.error || run.summary || `${run.mode} · ${run.trigger}`}
              </p>
            </button>
          ))}
        </div>
        {selected ? (
          <section className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Action ledger</h3>
            {detailQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : detailQuery.isError ? (
              <p className="text-sm text-destructive">
                Run detail could not be loaded.
              </p>
            ) : (detailQuery.data?.actions ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                This run recorded no actions.
              </p>
            ) : (
              <div className="space-y-2">
                {detailQuery.data?.actions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-md border p-3 text-xs"
                  >
                    <div className="flex gap-2">
                      <Badge variant="outline">{action.status}</Badge>
                      <span className="font-medium">{action.action}</span>
                      <span className="text-muted-foreground">
                        {action.target}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {action.reason ||
                        action.guardrail ||
                        'No additional detail.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
