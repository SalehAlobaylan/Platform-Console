'use client';

import { Brain } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiMetrics } from '@/hooks/use-ai-metrics';

function pct(n: number | null): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

export function LlmStackPanel() {
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
    return <Skeleton className="h-40 w-full" />;
  }

  const llm = data.llm;
  const totalErrors = llm
    ? Object.values(llm.errorsByType).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5" /> LLM Stack
        </CardTitle>
        <CardDescription>
          Provider usage, response cache, fallback chain &amp; errors
          (Enrichment).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError && (
          <p role="alert" className="mb-3 text-sm text-warning">
            Metrics refresh failed. Showing the last known values.
          </p>
        )}
        {!llm ? (
          <p className="text-sm text-muted-foreground">
            {data.errors.enrichment
              ? `Unreachable: ${data.errors.enrichment}`
              : 'No data.'}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Requests by provider
              </p>
              {Object.keys(llm.requestsByProvider).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No LLM calls yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(llm.requestsByProvider).map(([p, c]) => (
                    <div key={p} className="rounded-md border p-2 text-sm">
                      <span className="font-medium capitalize">{p}</span>{' '}
                      <span className="text-green-600">{c.success} ok</span>
                      {c.failure > 0 ? (
                        <span className="text-destructive">
                          {' '}
                          · {c.failure} fail
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cache hit-rate</p>
                <p className="text-xl font-semibold">{pct(llm.cacheHitRate)}</p>
                <p className="text-xs text-muted-foreground">
                  {llm.cacheHits}/{llm.cacheHits + llm.cacheMisses}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Fallbacks</p>
                <p className="text-xl font-semibold">
                  {llm.fallbackInvocations}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Retries</p>
                <p className="text-xl font-semibold">{llm.retries}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Errors</p>
                <p className="text-xl font-semibold">{totalErrors}</p>
              </div>
            </div>

            {Object.keys(llm.errorsByType).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(llm.errorsByType).map(([t, n]) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}: {n}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
