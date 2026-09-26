'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { OverallStatusHeader } from '@/components/platform/system-health/overall-status-header';
import { CopyDiagnostics } from '@/components/platform/system-health/copy-diagnostics';
import { ServiceCard } from '@/components/platform/system-health/service-card';
import { ServiceInventory } from '@/components/platform/system-health/service-inventory';
import { DependencyGrid } from '@/components/platform/system-health/dependency-grid';
import { ModelLoadPanel } from '@/components/platform/system-health/model-load-panel';
import { MediaWorkerPanel } from '@/components/platform/system-health/media-worker-panel';
import { EnvAuditPanel } from '@/components/platform/system-health/env-audit-panel';
import { IssuesPanel } from '@/components/platform/system-health/issues-panel';
import { useSystemHealth } from '@/hooks/use-system-health';
import { useSystemAutopilotStatus } from '@/hooks/use-system-autopilot';
import { SERVICE_ROLES, snapshotIsStale } from '@/lib/system-health';

const AggregationHealthPanel = dynamic(
  () =>
    import('@/components/platform/aggregation-health-panel').then(
      (module) => module.AggregationHealthPanel
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

const AiMetricsPanel = dynamic(
  () =>
    import('@/components/platform/system-health/ai-metrics-panel').then(
      (module) => module.AiMetricsPanel
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

const LlmStackPanel = dynamic(
  () =>
    import('@/components/platform/system-health/llm-stack-panel').then(
      (module) => module.LlmStackPanel
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

const SystemAutopilotPanel = dynamic(
  () =>
    import('@/components/platform/system-health/system-autopilot-panel').then(
      (module) => module.SystemAutopilotPanel
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

const VIEWS = ['overview', 'incidents', 'processing', 'configuration'] as const;

function HealthLoading() {
  return (
    <div
      className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
      role="status"
      aria-label="Loading service checks"
    >
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function SystemHealthWorkspace() {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useSystemHealth();
  const incidents = useSystemAutopilotStatus();
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requestedView = search.get('tab');
  const view = VIEWS.find((value) => value === requestedView) ?? 'overview';
  const selected = data?.services.find(
    (service) => service.name === search.get('service')
  );
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const stale = !!data && (isError || snapshotIsStale(data, now));
  const incidentData = incidents.data;
  const activeIncidents = incidentData?.open_episodes.length;
  const monitorWarning =
    incidents.isError ||
    !incidentData?.monitor?.fresh ||
    ['overdue', 'unavailable'].includes(incidentData?.monitor?.state ?? '') ||
    Boolean(incidentData?.attention?.length) ||
    Boolean(incidentData?.containment?.human_owned);
  const monitorLabel = incidents.isError
    ? 'Incident status unavailable'
    : !incidentData
      ? 'Loading incident monitoring'
      : activeIncidents
        ? `${activeIncidents} active incident${activeIncidents === 1 ? '' : 's'}`
        : incidentData.monitor?.state === 'disabled'
          ? 'Scheduled incident monitor off'
          : incidentData.monitor?.state === 'never_observed'
            ? 'No incident probe has run'
            : monitorWarning
              ? 'Incident monitoring needs review'
              : 'No open incidents recorded';

  function navigate(updates: Record<string, string | null>) {
    if (updates.service && !selected)
      inspectorTrigger.current = document.activeElement as HTMLElement;
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="system-health-title"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            System Health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find what needs attention. Inspect the evidence. Choose the next
            step.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyDiagnostics snapshot={data} />
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`me-2 h-4 w-4 ${isFetching ? 'motion-safe:animate-spin' : ''}`}
            />
            Refresh checks
          </Button>
        </div>
      </div>

      <OverallStatusHeader
        snapshot={data}
        isFetching={isFetching}
        isError={isError}
        stale={stale}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Bot
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium">
              {monitorLabel}
              {incidents.isError && incidentData
                ? ' · last known data retained'
                : ''}
            </p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              Confirmed incidents and containment are tracked independently of
              these service checks.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {incidentData && (
            <Badge
              variant={
                monitorWarning || activeIncidents ? 'warning' : 'secondary'
              }
            >
              {incidentData.state === 'safe_auto'
                ? 'Safe Auto'
                : incidentData.state === 'observe'
                  ? 'Observe mode'
                  : incidentData.state === 'paused'
                    ? 'Containment paused'
                    : 'Automation off'}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ tab: 'incidents' })}
          >
            View incidents
            <ArrowUpRight className="ms-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive/40">
          <CardContent
            className="flex flex-wrap items-center justify-between gap-3 p-4"
            role="alert"
          >
            <div>
              <p className="text-sm font-medium">
                {data
                  ? 'The latest service refresh failed'
                  : 'Service checks could not be loaded'}
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : 'The health endpoint is unavailable.'}{' '}
                {data
                  ? 'The readings below are from the last successful check.'
                  : 'Incident monitoring is still available independently.'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Retry service checks
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={view}
        onValueChange={(tab) =>
          navigate({ tab: tab === 'overview' ? null : tab })
        }
      >
        <div className="max-w-full overflow-x-auto border-b pb-2">
          <TabsList
            aria-label="System Health sections"
            className="h-auto justify-start bg-transparent p-0"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="incidents">
              Incidents &amp; automation
              {activeIncidents ? (
                <Badge variant="warning" className="ms-2">
                  {activeIncidents}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="processing">Workers &amp; AI</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5 space-y-5">
          {isLoading && !data ? (
            <HealthLoading />
          ) : data ? (
            <>
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0 xl:order-2">
                  <IssuesPanel
                    issues={data.issues}
                    stale={stale}
                    onInspect={(issue) =>
                      issue.service
                        ? navigate({ service: issue.service })
                        : navigate({ tab: 'configuration' })
                    }
                  />
                </div>
                <div className="min-w-0 xl:order-1">
                  <ServiceInventory
                    services={data.services}
                    issues={data.issues}
                    onInspect={(service) => navigate({ service: service.name })}
                  />
                </div>
              </div>
              <section aria-labelledby="infrastructure-title">
                <div className="mb-3">
                  <h2
                    id="infrastructure-title"
                    className="text-base font-semibold"
                  >
                    Infrastructure
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dependency checks reported by services. Missing evidence
                    stays unknown.
                  </p>
                </div>
                <DependencyGrid services={data.services} />
              </section>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>Investigate delivery:</span>
            <Link
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              href="/platform/feed-integrity"
            >
              Feed Integrity
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              href="/platform/real-experience"
            >
              Real Experience
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </TabsContent>

      <TabsContent value="incidents" className="mt-5">
          <SystemAutopilotPanel
            initialEpisodeId={search.get('incident')}
            onIncidentChange={(id) => navigate({ tab: 'incidents', incident: id })}
          />
      </TabsContent>

        <TabsContent value="processing" className="mt-5 space-y-4">
          <Tabs defaultValue="workers">
            <TabsList aria-label="Processing diagnostics">
              <TabsTrigger value="workers">Queues &amp; worker</TabsTrigger>
              <TabsTrigger value="ai">Models &amp; AI usage</TabsTrigger>
            </TabsList>
            <TabsContent value="workers" className="mt-4 space-y-4">
              {data ? (
                <MediaWorkerPanel services={data.services} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Worker readings require a service snapshot.
                </p>
              )}
              <AggregationHealthPanel />
            </TabsContent>
            <TabsContent value="ai" className="mt-4 space-y-4">
              {data && <ModelLoadPanel services={data.services} />}
              <AiMetricsPanel />
              <LlmStackPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="configuration" className="mt-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Service connections</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check which connections are configured and where each probe is
              sent.
            </p>
          </div>
          {data ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <EnvAuditPanel envAudit={data.envAudit} />
              <Card>
                <CardContent className="divide-y px-4 py-1">
                  {data.services.map((service) => (
                    <div key={service.name} className="py-3">
                      <p className="text-sm font-medium">
                        {service.displayName}
                      </p>
                      <p
                        className="mt-1 break-all font-mono text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {service.endpointUrl || 'No endpoint configured'}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto px-0 text-xs"
                        onClick={() => navigate({ service: service.name })}
                      >
                        Inspect connection
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Configuration evidence is unavailable until service checks load.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A configured URL does not confirm the correct application is
            responding. Service maintenance is available inside each service
            inspector.
          </p>
        </TabsContent>
      </Tabs>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && navigate({ service: null })}
      >
        <SheetContent
          aria-labelledby="service-inspector-title"
          aria-describedby="service-inspector-description"
          aria-label={
            selected
              ? `${selected.displayName} diagnostics`
              : 'Service diagnostics'
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = inspectorTrigger.current;
            if (target?.isConnected) target.focus();
            else document.getElementById('system-health-title')?.focus();
          }}
          className="w-full overflow-y-auto p-5 sm:max-w-xl"
        >
          {selected && (
            <>
              <SheetHeader className="mb-5 pe-6 text-start">
                <SheetTitle id="service-inspector-title">
                  {selected.displayName} diagnostics
                </SheetTitle>
                <SheetDescription id="service-inspector-description">
                  {SERVICE_ROLES[selected.name]}
                </SheetDescription>
              </SheetHeader>
              {stale && (
                <p className="mb-4 rounded-md border border-warning/40 p-3 text-sm">
                  This snapshot is stale. Refresh checks before using
                  maintenance actions.
                </p>
              )}
              <ServiceCard
                service={selected}
                onRecheck={() => void refetch()}
                isRechecking={isFetching}
                stale={stale}
              />
              <div className="mt-4">
                <IssuesPanel
                  issues={
                    data?.issues.filter(
                      (issue) => issue.service === selected.name
                    ) ?? []
                  }
                  stale={stale}
                />
              </div>
              {(selected.name === 'aggregation' ||
                selected.name === 'media' ||
                selected.name === 'enrichment') && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate({ tab: 'processing', service: null })}
                >
                  Open worker &amp; AI diagnostics
                  <ArrowUpRight className="ms-2 h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function SystemHealthPage() {
  return (
    <Suspense fallback={<HealthLoading />}>
      <SystemHealthWorkspace />
    </Suspense>
  );
}
