'use client';

import Link from '@/lib/console-link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { OPERATOR_CONTRACT_VERSION, type OperatorVisibleContext } from '@/types/platform/operator';
import type { ContentItem } from '@/types/platform/content';

interface FailedBannerProps {
  item: ContentItem;
  traceHref?: string;
}

export function FailedBanner({ item, traceHref }: FailedBannerProps) {
  if (item.status !== 'FAILED') return null;
  const context: OperatorVisibleContext = {
    schema_version: OPERATOR_CONTRACT_VERSION,
    domain: 'pipeline',
    view: 'content_item',
    filters: {},
    subjects: [{ type: 'content_item', id: item.id }],
    selection: { mode: 'explicit', ids: [item.id], count: 1 },
    available_intents: ['explain', 'investigate', 'recommend', 'compare', 'resolve'],
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">This item failed to process.</p>
          <p className="text-xs text-muted-foreground">CMS must derive the exact failed stage and current evidence before it can offer a recovery action.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {traceHref && <Button size="sm" variant="outline" render={<Link href={traceHref}>View delivery trace</Link>} />}
        <OperatorLaunchLink context={context} intent="resolve" size="sm">Investigate recovery</OperatorLaunchLink>
      </div>
    </div>
  );
}
