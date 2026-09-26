'use client';

import { ArrowUpCircle, Power, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from './confirm-dialog';
import { StatusBadge } from './status-badge';
import { useAuditedAction } from '@/hooks/use-audited-action';
import { useIsAdmin } from '@/lib/stores/auth';
import { restartService, type RestartTarget } from '@/lib/api/restart';
import { migrateUp } from '@/lib/api/migrations';
import type {
  ServiceHealth,
  ServiceName,
} from '@/types/platform/system-health';

const RESTARTABLE: ReadonlySet<ServiceName> = new Set<ServiceName>([
  'cms',
  'iam',
  'aggregation',
  'enrichment',
]);

function depDotClass(status: string): string {
  if (status === 'healthy') return 'bg-success';
  if (status === 'degraded') return 'bg-warning';
  if (status === 'unhealthy') return 'bg-destructive';
  return 'bg-muted-foreground';
}

interface ServiceCardProps {
  service: ServiceHealth;
  onRecheck?: () => void;
  isRechecking?: boolean;
  stale?: boolean;
}

export function ServiceCard({
  service,
  onRecheck,
  isRechecking,
  stale = false,
}: ServiceCardProps) {
  const isAdmin = useIsAdmin();
  const canRestart = isAdmin && RESTARTABLE.has(service.name);

  const restartAction = useAuditedAction(
    async () => restartService(service.name as RestartTarget),
    {
      action: 'service.restart',
      targetService: service.name,
      targetResource: service.displayName,
      successMessage: `Restart issued to ${service.displayName}`,
      failureMessage: `Failed to restart ${service.displayName}`,
    }
  );

  const canMigrate = isAdmin && service.name === 'iam';
  const migrateAction = useAuditedAction(async () => migrateUp('iam'), {
    action: 'iam.migrate_up',
    targetService: 'iam',
    targetResource: 'database',
    successMessage: 'IAM migrations applied',
    failureMessage: 'IAM migration failed',
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{service.displayName}</CardTitle>
            {service.endpointUrl ? (
              <p
                className="truncate text-xs text-muted-foreground"
                title={service.endpointUrl}
              >
                {service.endpointUrl}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={service.status} />
            {onRecheck ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onRecheck}
                disabled={isRechecking}
                title="Re-check all services"
                aria-label="Re-check all services"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRechecking ? 'motion-safe:animate-spin' : ''}`}
                />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Latency</p>
            <p className="font-medium">
              {service.latencyMs != null ? `${service.latencyMs} ms` : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">HTTP</p>
            <p className="font-medium">{service.httpStatus ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Version</p>
            <p className="font-medium">{service.version ?? '—'}</p>
          </div>
        </div>

        {service.deps.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {service.deps.map((dep) => (
              <span
                key={dep.name}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                title={dep.detail}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${depDotClass(dep.status)}`}
                />
                {dep.name} · {dep.status}
              </span>
            ))}
          </div>
        ) : null}

        {service.rawError ? (
          <p className="break-words text-xs text-destructive">
            {service.rawError}
          </p>
        ) : null}

        {service.raw ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw response
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-[11px]">
              {JSON.stringify(service.raw, null, 2)}
            </pre>
          </details>
        ) : null}
        {(canRestart || canMigrate) && (
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Service maintenance
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              These actions change the running service. Review the confirmation
              before continuing.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {' '}
              {canMigrate ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={stale || migrateAction.isPending}
                      title="Run pending IAM migrations (up)"
                    >
                      <ArrowUpCircle className="me-2 h-3.5 w-3.5" />
                      Apply IAM migrations
                    </Button>
                  }
                  title="Apply pending IAM migrations?"
                  description={
                    <span>
                      Runs all pending <strong>up</strong>-migrations against
                      the IAM database. This may take seconds to minutes
                      depending on the migration. Down-migrations are
                      intentionally not exposed. Take a database snapshot first
                      if you are operating on production.
                    </span>
                  }
                  confirmLabel="Run migrate up"
                  confirmVariant="default"
                  onConfirm={async () => {
                    await migrateAction.run();
                  }}
                />
              ) : null}
              {canRestart ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={stale || restartAction.isPending}
                      title={`Restart ${service.displayName}`}
                    >
                      <Power className="me-2 h-3.5 w-3.5" />
                      Restart service
                    </Button>
                  }
                  title={`Restart ${service.displayName}?`}
                  description={
                    <span>
                      The service will exit and rely on its supervisor (Cranl,
                      Docker, systemd) to start it again. Expect ~10s of
                      downtime. <strong>Locally</strong>, services launched via{' '}
                      <code>./start.sh</code> will not auto-restart.
                    </span>
                  }
                  confirmLabel="Restart"
                  confirmVariant="destructive"
                  onConfirm={async () => {
                    await restartAction.run();
                  }}
                />
              ) : null}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
