'use client';

import Link from '@/lib/console-link';
import {
    ArrowLeft,
    ExternalLink,
    Eye,
    ThumbsUp,
    Share2,
    Clapperboard,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContentItem } from '@/hooks/use-content';
import {
    CONTENT_TYPE_LABELS,
    CONTENT_STATUS_LABELS,
    CONTENT_STATUS_VARIANTS,
} from '@/types/platform/content';
import type { NewsMetadata } from '@/types/platform/content';

import { DetailActionsMenu } from '@/components/platform/content/detail/detail-actions-menu';
import { FailedBanner } from '@/components/platform/content/detail/failed-banner';
import { EnrichmentCard } from '@/components/platform/content/detail/enrichment-card';

interface ContentDetailPageProps {
    id: string;
}

export default function ContentDetailPage({ id }: ContentDetailPageProps) {
    const { data: item, isLoading, error } = useContentItem(id);
    const news = extractNewsMetadata(item?.metadata);

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
                    <h1 className="text-3xl font-bold tracking-tight">
                        Content not found
                    </h1>
                </div>
                <p className="text-muted-foreground">
                    The content item you are looking for does not exist.
                </p>
                <Button asChild>
                    <Link href="/platform/content">Back to content</Link>
                </Button>
            </div>
        );
    }

    const isMediaItem = item.type === 'VIDEO' || item.type === 'PODCAST';
    // Return to the surface that owns this type, not the legacy browser.
    const backHref = isMediaItem
        ? `/platform/media?type=${item.type}`
        : `/platform/news?view=library&type=${item.type}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={backHref}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="min-w-0">
                        <h1 className="line-clamp-2 max-w-3xl text-2xl font-bold tracking-tight">
                            {item.title}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline">
                                {CONTENT_TYPE_LABELS[item.type]}
                            </Badge>
                            <Badge variant={CONTENT_STATUS_VARIANTS[item.status]}>
                                {CONTENT_STATUS_LABELS[item.status]}
                            </Badge>
                            {item.source_name && (
                                <span className="text-muted-foreground">
                                    • {item.source_name}
                                </span>
                            )}
                            {item.published_at && (
                                <span className="text-muted-foreground">
                                    •{' '}
                                    {formatDistanceToNow(new Date(item.published_at), {
                                        addSuffix: true,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                    {item.original_url && (
                        <Button variant="outline" asChild>
                            <a
                                href={item.original_url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open original
                            </a>
                        </Button>
                    )}
                    {isMediaItem && (
                        <Button variant="outline" asChild>
                            <Link href={`/platform/media/atomization?tab=studio&item=${item.id}`}>
                                <Clapperboard className="mr-2 h-4 w-4" />
                                Open in Media Studio
                            </Link>
                        </Button>
                    )}
                    <DetailActionsMenu item={item} />
                </div>
            </div>

            {/* FAILED retry banner */}
            <FailedBanner item={item} />

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main column */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Media Preview */}
                    {(item.media_url || item.thumbnail_url) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Media preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {item.type === 'VIDEO' && item.media_url ? (
                                    <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                                        <video
                                            src={item.media_url}
                                            poster={item.thumbnail_url}
                                            controls
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                ) : item.thumbnail_url ? (
                                    <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                                        <img
                                            src={item.thumbnail_url}
                                            alt={item.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : item.media_url ? (
                                    <div className="rounded-lg bg-muted p-4">
                                        <a
                                            href={item.media_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            View media
                                        </a>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    )}

                    {/* Body */}
                    {(item.body_text || item.excerpt) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Content</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    {item.excerpt && (
                                        <p className="italic text-muted-foreground">
                                            {item.excerpt}
                                        </p>
                                    )}
                                    {item.body_text && (
                                        <p className="whitespace-pre-wrap">{item.body_text}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Topics */}
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

                    {/* Enrichment */}
                    {news && <EnrichmentCard news={news} />}
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
                                <Stat
                                    icon={<Eye className="h-4 w-4" />}
                                    label="Views"
                                    value={item.view_count.toLocaleString()}
                                />
                                <Stat
                                    icon={<ThumbsUp className="h-4 w-4" />}
                                    label="Likes"
                                    value={item.like_count.toLocaleString()}
                                />
                                <Stat
                                    icon={<Share2 className="h-4 w-4" />}
                                    label="Shares"
                                    value={item.share_count.toLocaleString()}
                                />
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
                                    <Row label="Author" value={item.author} />
                                )}
                                {item.source_name && (
                                    <Row label="Source" value={item.source_name} />
                                )}
                                {item.published_at && (
                                    <Row
                                        label="Published"
                                        value={format(new Date(item.published_at), 'PPP')}
                                    />
                                )}
                                {typeof item.duration_sec === 'number' && (
                                    <Row
                                        label="Duration"
                                        value={`${Math.floor(item.duration_sec / 60)}:${String(
                                            item.duration_sec % 60
                                        ).padStart(2, '0')}`}
                                    />
                                )}
                                <Row
                                    label="Created"
                                    value={formatDistanceToNow(
                                        new Date(item.created_at),
                                        { addSuffix: true }
                                    )}
                                />
                                <Row
                                    label="Updated"
                                    value={formatDistanceToNow(
                                        new Date(item.updated_at),
                                        { addSuffix: true }
                                    )}
                                />
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
                                        <UrlLink label="Original URL" href={item.original_url} />
                                    )}
                                    {item.media_url && (
                                        <UrlLink label="Media URL" href={item.media_url} />
                                    )}
                                    {item.thumbnail_url && (
                                        <UrlLink
                                            label="Thumbnail URL"
                                            href={item.thumbnail_url}
                                        />
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

function Stat({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-center gap-1 text-muted-foreground">
                {icon}
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
        </div>
    );
}

function UrlLink({ label, href }: { label: string; href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 truncate text-primary hover:underline"
        >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            {label}
        </a>
    );
}

function extractNewsMetadata(metadata?: Record<string, unknown>): NewsMetadata | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const news = metadata['news'];
    if (!news || typeof news !== 'object') return null;

    const candidate = news as Record<string, unknown>;
    const likelyNews = candidate['likelyNews'];
    const score = candidate['score'];
    const confidence = candidate['confidence'];

    if (typeof likelyNews !== 'boolean' || typeof score !== 'number') return null;
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high')
        return null;

    return {
        version: typeof candidate['version'] === 'string' ? candidate['version'] : undefined,
        likelyNews,
        score,
        confidence,
        categoryHints: Array.isArray(candidate['categoryHints'])
            ? candidate['categoryHints'].filter(
                  (i): i is string => typeof i === 'string'
              )
            : [],
        matchedKeywords: Array.isArray(candidate['matchedKeywords'])
            ? candidate['matchedKeywords'].filter(
                  (i): i is string => typeof i === 'string'
              )
            : [],
        signals:
            typeof candidate['signals'] === 'object' && candidate['signals'] !== null
                ? (candidate['signals'] as NewsMetadata['signals'])
                : undefined,
    };
}
