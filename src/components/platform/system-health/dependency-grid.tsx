'use client';

import { Database, HardDrive, type LucideIcon, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { postgresStatus } from '@/lib/system-health';
import type {
  ServiceHealth,
  ServiceStatus,
} from '@/types/platform/system-health';

interface InfraTile {
  key: string;
  label: string;
  icon: LucideIcon;
  status: ServiceStatus;
  source: string;
  detail?: string;
}

function pickDep(
  services: ServiceHealth[],
  serviceName: ServiceHealth['name'],
  depName: string
): { status: ServiceStatus; detail?: string } | null {
  const svc = services.find((s) => s.name === serviceName);
  if (!svc) return null;
  const dep = svc.deps.find(
    (d) => d.name.toLowerCase() === depName.toLowerCase()
  );
  return dep ? { status: dep.status, detail: dep.detail } : null;
}

export function DependencyGrid({ services }: { services: ServiceHealth[] }) {
  const redis = pickDep(services, 'aggregation', 'redis');
  const storage = pickDep(services, 'aggregation', 'storage');

  const tiles: InfraTile[] = [
    {
      key: 'redis',
      label: 'Redis',
      icon: Server,
      status: redis?.status ?? 'unknown',
      source: 'Aggregation /ready',
      detail: redis?.detail,
    },
    {
      key: 'postgres',
      label: 'PostgreSQL',
      icon: Database,
      status: postgresStatus(services),
      source: 'CMS + IAM /health',
    },
    {
      key: 'storage',
      label: 'Object storage',
      icon: HardDrive,
      status: storage?.status ?? 'unknown',
      source: 'Aggregation /ready',
      detail: storage?.detail,
    },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.key}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md border bg-muted/40 p-2">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{tile.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {tile.detail ?? tile.source}
                  </p>
                </div>
              </div>
              <StatusBadge status={tile.status} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
