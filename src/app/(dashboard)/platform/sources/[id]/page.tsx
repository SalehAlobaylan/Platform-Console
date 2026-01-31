'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceForm } from '@/components/platform/source-form';
import { useSource, useUpdateSource, useRunSource } from '@/hooks/use-sources';
import { SOURCE_TYPE_LABELS } from '@/types/platform/source';
import type { UpdateSourceRequest, SourceType } from '@/types/platform/source';

interface SourceDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function SourceDetailPage({ params }: SourceDetailPageProps) {
    const { id } = use(params);
    const router = useRouter();

    const { data: source, isLoading, error } = useSource(id);
    const updateMutation = useUpdateSource();
    const runMutation = useRunSource();

    const handleSubmit = (data: UpdateSourceRequest) => {
        updateMutation.mutate(
            { id, data },
            {
                onSuccess: () => {
                    router.push('/platform/sources');
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
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/platform/sources">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Source Not Found</h1>
                </div>
                <p className="text-muted-foreground">
                    The source you are looking for does not exist or has been deleted.
                </p>
                <Button asChild>
                    <Link href="/platform/sources">Back to Sources</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/platform/sources">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
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
                    </dl>
                </CardContent>
            </Card>

            {/* Edit Form */}
            <div className="max-w-2xl">
                <SourceForm
                    source={source}
                    onSubmit={handleSubmit}
                    isLoading={updateMutation.isPending}
                />
            </div>
        </div>
    );
}
