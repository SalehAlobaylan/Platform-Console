'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { OpsStatus } from '@/lib/api/cms/operations';
import { label, tone } from './overview-logic';
import { opsSnapshotFresh } from '@/components/platform/operations/presentation';

interface OverviewHeaderProps {
    status?: OpsStatus;
    isLoading: boolean;
    isError?: boolean;
}

export function OverviewHeader({ status, isLoading, isError }: OverviewHeaderProps) {
    const fresh = !isError && opsSnapshotFresh(status?.as_of);
    return (
        <div>
            <p className="brand-overline text-muted-foreground">Wahb Platform</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="font-editorial text-3xl font-bold tracking-tight">Platform Overview</h1>
                {status ? <Badge variant={tone(fresh ? status.headline : 'unknown')}>{label(fresh ? status.headline : 'unknown')}</Badge> : null}
            </div>
            {isLoading ? (
                <Skeleton className="mt-2 h-4 w-96 max-w-full" />
            ) : (
                <p className="mt-1 text-muted-foreground">
                    {status && !fresh ? 'Live fleet evidence is unavailable or stale. Showing the last successful snapshot.' : status?.summary ?? 'Health, attention, and content flow across the platform.'}
                </p>
            )}
            {status ? (
                <p className="mt-1 text-xs text-muted-foreground">Snapshot {new Date(status.as_of).toLocaleString()}</p>
            ) : null}
        </div>
    );
}
