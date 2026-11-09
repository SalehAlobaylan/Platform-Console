'use client';

import Link from '@/lib/console-link';
import { type ReactNode } from 'react';

import { formatNumber } from '@/lib/utils/format';
import type { ContentSourceStat } from '@/types/platform/content';

interface SourceLeaderboardProps {
    sources: ContentSourceStat[];
    /** When provided, each row links into the domain page for that source. */
    buildHref?: (sourceName: string) => string;
}

const pct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

export function SourceLeaderboard({ sources, buildHref }: SourceLeaderboardProps) {
    if (sources.length === 0) {
        return (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No sources yet.
            </div>
        );
    }

    const max = Math.max(...sources.map((s) => s.count), 1);

    return (
        <div className="space-y-2.5">
            {sources.map((source) => {
                const body = (
                    <>
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate" title={source.source_name}>
                                {source.source_name}
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                                {formatNumber(source.count)}
                            </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            {/* Outer width is proportional to the busiest source; inner segments
                                split that source's items into ready / failed / other. */}
                            <div
                                className="flex h-full"
                                style={{ width: `${pct(source.count, max)}%`, minWidth: '4px' }}
                            >
                                <div className="bg-success" style={{ width: `${pct(source.ready, source.count)}%` }} />
                                <div className="bg-destructive" style={{ width: `${pct(source.failed, source.count)}%` }} />
                                <div className="flex-1 bg-foreground/20" />
                            </div>
                        </div>
                    </>
                );

                return buildHref && source.source_name !== 'Unknown source' ? (
                    <Link
                        key={source.source_name}
                        href={buildHref(source.source_name)}
                        className="block space-y-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50"
                    >
                        {body}
                    </Link>
                ) : (
                    <Row key={source.source_name}>{body}</Row>
                );
            })}
        </div>
    );
}

function Row({ children }: { children: ReactNode }) {
    return <div className="space-y-1 px-1 py-0.5">{children}</div>;
}
