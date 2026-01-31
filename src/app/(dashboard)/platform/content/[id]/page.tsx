'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Archive, Eye, ThumbsUp, Share2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContentItem, useUpdateContentStatus } from '@/hooks/use-content';
import {
    CONTENT_TYPE_LABELS,
    CONTENT_STATUS_LABELS,
    CONTENT_STATUS_VARIANTS,
} from '@/types/platform/content';
import type { ContentType, ContentStatus } from '@/types/platform/content';

interface ContentDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function ContentDetailPage({ params }: ContentDetailPageProps) {
    const { id } = use(params);
    const { data: item, isLoading, error } = useContentItem(id);
    const updateStatusMutation = useUpdateContentStatus();

    const handleArchive = () => {
        updateStatusMutation.mutate({ id, status: 'ARCHIVED' });
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardContent className="pt-6">
                            <Skeleton className="h-48 w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/platform/content">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Content Not Found</h1>
                </div>
                <p className="text-muted-foreground">
                    The content item you are looking for does not exist.
                </p>
                <Button asChild>
                    <Link href="/platform/content">Back to Content</Link>
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
                        <Link href="/platform/content">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight line-clamp-1 max-w-xl">
                                {item.title}
                            </h1>
                            <Badge variant={CONTENT_STATUS_VARIANTS[item.status as ContentStatus]}>
                                {CONTENT_STATUS_LABELS[item.status as ContentStatus]}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Badge variant="outline">
                                {CONTENT_TYPE_LABELS[item.type as ContentType]}
                            </Badge>
                            {item.source_name && <span>• {item.source_name}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {item.original_url && (
                        <Button variant="outline" asChild>
                            <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Original
                            </a>
                        </Button>
                    )}
                    {item.status !== 'ARCHIVED' && (
                        <Button
                            variant="outline"
                            onClick={handleArchive}
                            disabled={updateStatusMutation.isPending}
                        >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Media Preview */}
                    {(item.media_url || item.thumbnail_url) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Media Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {item.type === 'VIDEO' && item.media_url ? (
                                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                        <video
                                            src={item.media_url}
                                            poster={item.thumbnail_url}
                                            controls
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : item.thumbnail_url ? (
                                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                        <img
                                            src={item.thumbnail_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : item.media_url ? (
                                    <div className="p-4 bg-muted rounded-lg">
                                        <a
                                            href={item.media_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-2"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            View Media
                                        </a>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    )}

                    {/* Content Body */}
                    {(item.body_text || item.excerpt) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Content</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    {item.excerpt && (
                                        <p className="text-muted-foreground italic">{item.excerpt}</p>
                                    )}
                                    {item.body_text && (
                                        <p className="whitespace-pre-wrap">{item.body_text}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tags */}
                    {item.topic_tags && item.topic_tags.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Topics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {item.topic_tags.map((tag) => (
                                        <Badge key={tag} variant="secondary">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Engagement */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Engagement</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                        <Eye className="h-4 w-4" />
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {item.view_count.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Views</div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                        <ThumbsUp className="h-4 w-4" />
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {item.like_count.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Likes</div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                        <Share2 className="h-4 w-4" />
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {item.share_count.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Shares</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metadata */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="space-y-3 text-sm">
                                {item.author && (
                                    <div>
                                        <dt className="text-muted-foreground">Author</dt>
                                        <dd className="font-medium">{item.author}</dd>
                                    </div>
                                )}
                                {item.source_name && (
                                    <div>
                                        <dt className="text-muted-foreground">Source</dt>
                                        <dd className="font-medium">{item.source_name}</dd>
                                    </div>
                                )}
                                {item.published_at && (
                                    <div>
                                        <dt className="text-muted-foreground">Published</dt>
                                        <dd className="font-medium">
                                            {format(new Date(item.published_at), 'PPP')}
                                        </dd>
                                    </div>
                                )}
                                {item.duration_sec && (
                                    <div>
                                        <dt className="text-muted-foreground">Duration</dt>
                                        <dd className="font-medium">
                                            {Math.floor(item.duration_sec / 60)}:{String(item.duration_sec % 60).padStart(2, '0')}
                                        </dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-muted-foreground">Created</dt>
                                    <dd className="font-medium">
                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Updated</dt>
                                    <dd className="font-medium">
                                        {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {/* URLs */}
                    {(item.original_url || item.media_url || item.thumbnail_url) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Artifact URLs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    {item.original_url && (
                                        <a
                                            href={item.original_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline truncate"
                                        >
                                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                            Original URL
                                        </a>
                                    )}
                                    {item.media_url && (
                                        <a
                                            href={item.media_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline truncate"
                                        >
                                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                            Media URL
                                        </a>
                                    )}
                                    {item.thumbnail_url && (
                                        <a
                                            href={item.thumbnail_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline truncate"
                                        >
                                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                            Thumbnail URL
                                        </a>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
