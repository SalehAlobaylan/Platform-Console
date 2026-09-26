'use client';

import { useState } from 'react';
import { ChevronRight, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SERVICE_ROLES, STATUS_ORDER } from '@/lib/system-health';
import type {
  ServiceHealth,
  SystemIssue,
} from '@/types/platform/system-health';
import { StatusBadge } from './status-badge';

export function ServiceInventory({
  services,
  issues = [],
  onInspect,
}: {
  services: ServiceHealth[];
  issues?: SystemIssue[];
  onInspect: (service: ServiceHealth) => void;
}) {
  const [attentionOnly, setAttentionOnly] = useState(false);
  const needsReview = (service: ServiceHealth) =>
    service.status !== 'healthy' ||
    issues.some((issue) => issue.service === service.name);
  const attentionCount = services.filter(needsReview).length;
  const visible = services
    .filter((service) => !attentionOnly || needsReview(service))
    .sort(
      (a, b) =>
        Number(needsReview(b)) - Number(needsReview(a)) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    );

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-base">Services</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Select a service to inspect its checks and dependencies.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant={attentionOnly ? 'secondary' : 'outline'}
          className="shrink-0 text-xs"
          aria-pressed={attentionOnly}
          onClick={() => setAttentionOnly(!attentionOnly)}
        >
          Needs review · {attentionCount}
        </Button>
      </CardHeader>
      <div className="hidden grid-cols-[minmax(0,1fr)_100px_95px_16px] gap-3 border-y bg-muted/30 px-4 py-2 text-xs text-muted-foreground sm:grid">
        <span>Service / responsibility</span>
        <span>Status</span>
        <span className="text-end">Response</span>
        <span />
      </div>
      <ul className="divide-y">
        {visible.map((service) => (
          <li key={service.name}>
            <button
              type="button"
              onClick={() => onInspect(service)}
              aria-label={`Inspect ${service.displayName}`}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_100px_95px_16px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Server
                  className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{service.displayName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {SERVICE_ROLES[service.name]}
                  </p>
                </div>
              </div>
              <div>
                <StatusBadge status={service.status} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground sm:text-end">
                {service.httpStatus != null && service.latencyMs != null
                  ? `${service.latencyMs.toLocaleString()} ms`
                  : 'No response'}
              </span>
              <ChevronRight
                className="h-4 w-4 justify-self-end text-muted-foreground rtl:rotate-180"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <div className="p-6 text-sm text-muted-foreground">
          {services.length
            ? 'No services match this filter.'
            : 'No service checks were returned.'}
          {attentionOnly && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setAttentionOnly(false)}
            >
              Show all services
            </Button>
          )}
        </div>
      )}
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        Checks needing review appear first. Response time is one probe, not an
        average.
      </p>
    </Card>
  );
}
