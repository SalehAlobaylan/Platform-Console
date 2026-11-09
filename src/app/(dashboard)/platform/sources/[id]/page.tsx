'use client';

import { useRouter, useSearchParams } from '@/lib/navigation';
import Link from '@/lib/console-link';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceWizard } from '@/components/platform/sources/wizard/source-wizard';
import { useSource, useUpdateSource, useRunSource } from '@/hooks/use-sources';
import { SOURCE_TYPE_LABELS } from '@/types/platform/source';
import type { CreateSourceRequest, SourceType } from '@/types/platform/source';

interface SourceDetailPageProps {
    id: string;
}

export default function SourceDetailPage({ id }: SourceDetailPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Return to the surface that opened the editor (Media Sources or News →
    // Feeds Finding); fall back to the Sources dashboard.
    const from = searchParams.get('from') || '/platform/sources';

    const { data: source, isLoading, error } = useSource(id);
    const updateMutation = useUpdateSource();
    const runMutation = useRunSource();

    const handleSubmit = (data: CreateSourceRequest) => {
        updateMutation.mutate(
            { id, data },
            {
                onSuccess: () => {
                    router.push(from);
                },
            }
        );
    };

    const handleRun = () => {
        runMutation.mutate(id);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !source) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" render={<Link href={from}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>} />
                    <h1 className="text-3xl font-bold tracking-tight">Source Not Found</h1>
                </div>
                <p className="text-muted-foreground">
                    The source you are looking for does not exist or has been deleted.
                </p>
                <Button render={<Link href={from}>Back to Sources</Link>} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" render={<Link href={from}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>} />
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {source.image_url ? (
                            <img
                                src={source.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-lg font-semibold text-muted-foreground">
                                {source.name.slice(0, 1).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{source.name}</h1>
                            <Badge variant={source.is_active ? 'success' : 'secondary'}>
                                {source.is_active ? 'Active' : 'Disabled'}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground">
                            {SOURCE_TYPE_LABELS[source.type as SourceType]}
                        </p>
                    </div>
                </div>
                <Button onClick={handleRun} disabled={runMutation.isPending}>
                    {runMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="mr-2 h-4 w-4" />
                            Run Now
                        </>
                    )}
                </Button>
            </div>

            {/* Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>Source Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid gap-4 md:grid-cols-3">
                        <div>
                            <dt className="text-sm text-muted-foreground">Last Fetched</dt>
                            <dd className="font-medium">
                                {source.last_fetched_at
                                    ? formatDistanceToNow(new Date(source.last_fetched_at), { addSuffix: true })
                                    : 'Never'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">Fetch Interval</dt>
                            <dd className="font-medium">{source.fetch_interval_minutes} minutes</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">Created</dt>
                            <dd className="font-medium">
                                {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">Icon</dt>
                            <dd className="truncate font-medium">
                                {source.image_url || 'Auto-detect on save'}
                            </dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            {/* Edit Wizard */}
            <div className="max-w-4xl">
                <SourceWizard
                    source={source}
                    onSubmit={handleSubmit}
                    isSubmitting={updateMutation.isPending}
                />
            </div>
        </div>
    );
}
