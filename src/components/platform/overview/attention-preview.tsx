'use client';

import Link from '@/lib/console-link';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared';
import type { OpsAttentionItem } from '@/lib/api/cms/operations';
import { relative, tone } from './overview-logic';

interface AttentionPreviewProps {
    items: OpsAttentionItem[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
}

export function AttentionPreview({ items, isLoading, isError, onRetry }: AttentionPreviewProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Needs attention
                </CardTitle>
                <CardDescription>Top open items across the fleet. Act on them from Operations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </>
                ) : isError ? (
                    <ErrorState
                        title="Attention inbox unavailable"
                        description="Could not load the fleet attention inbox."
                        onRetry={onRetry}
                        className="py-6"
                    />
                ) : items.length ? (
                    <>
                        {items.map((item) => (
                            <div key={item.key} className="rounded-md border p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={tone(item.severity)}>{item.severity}</Badge>
                                    <Badge variant="outline">{item.system}</Badge>
                                    <span className="ml-auto text-xs text-muted-foreground">{relative(item.first_seen)}</span>
                                </div>
                                <Link href={item.href} className="mt-2 block font-medium hover:underline">
                                    {item.title}
                                </Link>
                                {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
                            </div>
                        ))}
                        <Link
                            href="/platform/operations"
                            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Open Operations
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </>
                ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-success" />
                        Nothing needs attention right now.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
