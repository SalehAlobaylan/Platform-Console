'use client';

import Link from '@/lib/console-link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { OpsBadge, opsSnapshotFresh, OpsTime } from '@/components/platform/operations/presentation';
import type { OpsAttentionPage } from '@/lib/api/cms/operations';

interface AttentionPreviewProps {
    snapshot?: OpsAttentionPage;
    isLoading: boolean;
    isError: boolean;
    isFetching?: boolean;
    onRetry: () => void;
}

export function AttentionPreview({ snapshot, isLoading, isError, isFetching, onRetry }: AttentionPreviewProps) {
    const item = snapshot?.items.find(issue => !issue.snoozed);
    const stale = Boolean(snapshot) && (isError || !opsSnapshotFresh(snapshot?.as_of));
    const partial = snapshot?.complete === false || Boolean(snapshot?.adapter_errors?.length);
    const unavailable = !snapshot && !isLoading;
    const total = !stale && !partial ? snapshot?.total : undefined;
    const canRetry = stale || partial || unavailable;

    return (
        <section aria-labelledby="overview-attention-heading">
            <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 id="overview-attention-heading" className="flex items-center gap-1.5 text-sm font-semibold">
                        <AlertTriangle aria-hidden="true" className={item ? 'size-4 shrink-0 text-warning' : 'size-4 shrink-0 text-muted-foreground'} />
                        Needs attention
                    </h2>
                    {total !== undefined && total > 0 && <Badge variant="outline" className="shrink-0 tabular-nums">{total.toLocaleString()} open</Badge>}
                </div>

                <Link href="/platform/operations#ops-attention" className="col-start-2 row-start-1 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:col-start-3">
                    Open inbox <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
                </Link>

                <div className="col-span-2 flex min-w-0 flex-col gap-1 ps-[1.375rem] xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:ps-0">
                    {item ? (
                        <div className="flex min-w-0 items-start gap-2 sm:items-center">
                            <OpsBadge value={item.severity} />
                            <Link href={item.issue_href ?? item.href} dir="auto" title={item.title} className="min-w-0 rounded-sm text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <span className="line-clamp-2 break-words xl:line-clamp-1">{item.title}</span>
                            </Link>
                        </div>
                    ) : !canRetry && (
                        <p role="status" className="text-sm text-muted-foreground">
                            {isLoading ? 'Checking attention…' : total === 0 ? 'Nothing needs attention right now.' : 'See the inbox for issue details.'}
                        </p>
                    )}
                    {canRetry && (
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <p role="status">
                                {stale ? 'Stale attention snapshot' : partial ? 'Some systems did not report' : 'Attention inbox unavailable'}
                                {stale && snapshot?.as_of && <> · <OpsTime value={snapshot.as_of} locale="en" /></>}
                            </p>
                            <button type="button" disabled={isFetching} onClick={onRetry} className="min-h-8 rounded-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                                {isFetching ? 'Checking…' : 'Retry'}
                            </button>
                        </div>
                    )}
                </div>
            </Card>
        </section>
    );
}
