'use client';

import { Mic, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ServiceHealth } from '@/types/platform/system-health';

/**
 * Async-transcription worker view for Media-Service. The worker is a separate
 * Cranl deploy with no HTTP port; the Media API observes it via the shared arq
 * queue (Redis db=2) and reports liveness + throughput on /health/queue.
 */
export function MediaWorkerPanel({ services }: { services: ServiceHealth[] }) {
  const media = services.find((s) => s.name === 'media');
  const worker = media?.worker;

  const stat = (label: string, value: number) => (
    <div key={label} className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="h-5 w-5" />
          Async Transcription Worker
        </CardTitle>
        <CardDescription>
          Background transcription for podcasts and other media. Reported by
          Media-Service.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!media || media.status === 'unknown' ? (
          <p className="text-sm text-muted-foreground">
            Media-Service health is unknown. Inspect its connection for details.
          </p>
        ) : !worker ? (
          <p className="text-sm text-muted-foreground">
            Worker health was not reported. This does not establish whether the
            worker is configured or running.
          </p>
        ) : !worker.configured ? (
          <p className="text-sm text-muted-foreground">
            Worker queue not configured (arq pool unavailable).
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {worker.alive ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> worker alive
                </Badge>
              ) : worker.queued > 0 ? (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" /> worker down · jobs waiting
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MinusCircle className="h-3.5 w-3.5" /> no worker (idle)
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {stat('Queued', worker.queued)}
              {stat('Ongoing', worker.ongoing)}
              {stat('Completed', worker.complete)}
              {stat('Failed', worker.failed)}
              {stat('Retried', worker.retried)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
