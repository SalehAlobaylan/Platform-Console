'use client';

import { Button } from '@/components/ui/button';
import { ActivityRail } from '@/components/platform/shared/activity-rail';
import type { NewsCollectionManagement } from './news-collection-controls';

type Status = NewsCollectionManagement['status'];

function outcome({
  result,
  snapshot,
}: NonNullable<Status['data']>['operations'][number]) {
  if (result.action === 'pause')
    return result.changed
      ? 'News updates paused'
      : 'Updates were already paused';
  if (result.action === 'resume')
    return result.changed
      ? 'News updates resumed'
      : 'Updates were already running';
  if (!result.changed) return 'No sources changed';
  const sources = result.changed === 1 ? 'source' : 'sources';
  if (result.action === 'disable')
    return `${result.changed} ${sources} disabled`;
  const enabled = snapshot?.sources.filter(
    (source) => source.outcome === 'will_enable'
  ).length;
  if (enabled === result.changed) return `${result.changed} ${sources} enabled`;
  const scheduled = snapshot?.sources.filter(
    (source) => source.outcome === 'will_schedule'
  ).length;
  if (scheduled === result.changed)
    return `Scheduling restored for ${result.changed} ${sources}`;
  return `${result.changed} ${sources} updated`;
}

function HistoryEntries({ status }: { status: Status }) {
  const operations = status.data?.operations ?? [];
  const groups = new Map<string, typeof operations>();
  for (const operation of operations) {
    const date = new Date(operation.applied_at).toLocaleDateString(undefined, {
      dateStyle: 'medium',
    });
    const group = groups.get(date) ?? [];
    group.push(operation);
    groups.set(date, group);
  }

  return (
    <div>
      {status.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading changes…
        </p>
      )}
      {status.isError && (
        <div role="alert" className="mb-4 space-y-2 text-sm">
          <p>
            {operations.length
              ? 'Could not refresh. Showing the last available changes.'
              : 'Change history is unavailable.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {!status.isPending && !status.isError && !operations.length && (
        <p className="text-sm text-muted-foreground">
          No changes recorded yet.
        </p>
      )}
      {Array.from(groups, ([date, entries]) => (
        <section key={date} className="mb-5 last:mb-0">
          <h3 className="text-xs font-medium text-muted-foreground">{date}</h3>
          <ol className="mt-1 divide-y">
            {entries.map((operation) => (
              <li key={operation.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">{outcome(operation)}</p>
                <p className="text-xs text-muted-foreground">
                  <time
                    dateTime={operation.applied_at}
                    title={operation.applied_at}
                  >
                    {new Date(operation.applied_at).toLocaleTimeString(
                      undefined,
                      { timeStyle: 'medium' }
                    )}
                  </time>
                  {operation.result.excluded > 0 &&
                    ` · ${operation.result.excluded} skipped`}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function NewsActivityRail({ status }: { status: Status }) {
  const data = status.data;
  const scope =
    data &&
    [data.environment, data.tenant_id && `Tenant: ${data.tenant_id}`]
      .filter(Boolean)
      .join(' · ');
  return (
    <ActivityRail
      title="News change history"
      description={scope || 'Recent News operations'}
      closeLabel="Close News history"
      triggerLabel="History"
      toolsLabel="News tools"
    >
      <HistoryEntries status={status} />
    </ActivityRail>
  );
}
