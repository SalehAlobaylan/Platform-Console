'use client';

import Link from '@/lib/console-link';
import { AlertTriangle } from 'lucide-react';
import { useEnrichmentAutopilot } from '@/hooks/use-enrichment';

const hrefFor = (target: string) => {
  switch (target) {
    case 'media_studio':
      return '/platform/media/atomization?tab=studio';
    case 'pipeline':
      return '/platform/pipeline';
    case 'transcription_config':
      return '/platform/media';
    default:
      return '#missing-panel';
  }
};

export function AttentionLane() {
  const { data } = useEnrichmentAutopilot();
  const attention = data?.attention ?? [];
  if (attention.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" /> Attention needed
      </div>
      <div className="space-y-2 text-sm">
        {attention.map((item, index) => (
          <div
            key={`${item.kind}-${item.artifact ?? index}`}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span>{item.message}</span>
            <Link
              className="text-xs font-medium underline"
              href={hrefFor(item.target)}
            >
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
