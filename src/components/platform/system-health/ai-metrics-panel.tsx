'use client';

import { Mic, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiMetrics } from '@/hooks/use-ai-metrics';

function fmtAvg(sec: number | null): string {
  if (sec == null) return '—';
  return sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(2)} s`;
}

function pct(n: number | null): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function AiMetricsPanel() {
  const { data, isLoading, isError, isFetching, refetch } = useAiMetrics();

  if (isError && !data) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4" role="alert">
          <p className="text-sm">AI metrics are unavailable.</p>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Retry metrics
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-48 w-full" />;
  }

  const m = data.media;
  const e = data.enrichment;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {isError && (
        <p role="alert" className="text-sm text-warning lg:col-span-2">
          Metrics refresh failed. Showing the last known values.
        </p>
      )}
      {/* Media-Service throughput */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-5 w-5" /> Media Throughput
          </CardTitle>
          <CardDescription>
            Cumulative since the last Media-Service restart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!m ? (
            <p className="text-sm text-muted-foreground">
              {data.errors.media
                ? `Unreachable: ${data.errors.media}`
                : 'No data.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat
                label="Transcriptions"
                value={m.transcriptions.total}
                sub={`${m.transcriptions.error} failed`}
              />
              <Stat
                label="Avg transcribe"
                value={fmtAvg(m.transcriptionAvgSec)}
              />
              <Stat
                label="Image embeds"
                value={m.imageEmbeddings.total}
                sub={`${m.imageEmbeddings.error} failed`}
              />
              <Stat label="Jobs completed" value={m.transcribeJobs.completed} />
              <Stat label="Jobs failed" value={m.transcribeJobs.failed} />
              <Stat
                label="CMS write-back"
                value={pct(m.writebackSuccessRate)}
                sub="success rate"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrichment retrieval + embeddings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5" /> Retrieval &amp; Embeddings
          </CardTitle>
          <CardDescription>
            Enrichment-Service throughput + avg latency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!e ? (
            <p className="text-sm text-muted-foreground">
              {data.errors.enrichment
                ? `Unreachable: ${data.errors.enrichment}`
                : 'No data.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat
                label="Embeddings"
                value={e.embeddings.total}
                sub={`${e.embeddings.error} failed`}
              />
              <Stat
                label="/related"
                value={e.relatedRequests}
                sub={fmtAvg(e.relatedAvgSec)}
              />
              <Stat
                label="Rerank"
                value={e.rerankRequests}
                sub={fmtAvg(e.rerankAvgSec)}
              />
              <Stat
                label="News slides"
                value={e.feedNewsRequests}
                sub={fmtAvg(e.feedNewsAvgSec)}
              />
              <Stat label="RRF overlap" value={pct(e.rrfOverlapRatio)} />
              <Stat
                label="Rules dropped"
                value={
                  e.rankingDropped.freshness +
                  e.rankingDropped.source_diversity +
                  e.rankingDropped.type_quotas
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
