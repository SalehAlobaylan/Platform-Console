'use client';

import {
    ArrowRight,
    MoreHorizontal,
    Send,
    Archive,
    Undo2,
    Pencil,
    Combine,
    Trash2,
    Layers,
    Inbox,
    Rss,
    ExternalLink,
} from 'lucide-react';

import { toast } from '@/components/ui/toast';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Stage = 'PENDING' | 'READY' | 'ARCHIVED';

const PRIMARY: Record<Stage, { label: string; icon: typeof Send }> = {
    PENDING: { label: 'Publish', icon: Send },
    READY: { label: 'Archive', icon: Archive },
    ARCHIVED: { label: 'Restore', icon: Undo2 },
};

interface TopicStageCardProps {
    id: string;
    label: string;
    count: number;
    status: Stage;
    isUncategorized?: boolean;
    busy?: boolean;
    /** Public RSS URL for this story (omitted until the public base is known). */
    rssUrl?: string;
    onManage: () => void;
    onPrimary: () => void;
    onRename?: () => void;
    onMerge?: () => void;
    onDeleteAll?: () => void;
}

async function copyFeedUrl(url: string) {
    try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'RSS URL copied', description: url, variant: 'success' });
    } catch {
        toast({ title: 'Copy failed', description: 'Clipboard access denied.', variant: 'destructive' });
    }
}

export function TopicStageCard({
    label,
    count,
    status,
    isUncategorized = false,
    busy = false,
    rssUrl,
    onManage,
    onPrimary,
    onRename,
    onMerge,
    onDeleteAll,
}: TopicStageCardProps) {
    const p = PRIMARY[status];
    const Icon = p.icon;

    return (
        <Card className="transition-colors hover:border-primary/30">
            <CardContent className="space-y-2 p-3">
                <button
                    type="button"
                    onClick={onManage}
                    className="flex w-full items-start gap-2 text-left"
                >
                    {isUncategorized ? (
                        <Inbox className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                        <Layers className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="line-clamp-2 flex-1 text-sm font-medium hover:underline" title={label}>
                        {label}
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                        {count.toLocaleString()}
                    </Badge>
                </button>

                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={busy}
                        onClick={onPrimary}
                    >
                        <Icon className="mr-1.5 h-4 w-4" />
                        {p.label} {count.toLocaleString()}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Story actions">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>} />
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onManage}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Manage news
                            </DropdownMenuItem>
                            {rssUrl && (
                                <>
                                    <DropdownMenuItem onClick={() => copyFeedUrl(rssUrl)}>
                                        <Rss className="mr-2 h-4 w-4" />
                                        Copy RSS feed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem render={<a href={rssUrl} target="_blank" rel="noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Open feed
                                        </a>} nativeButton={false} />
                                </>
                            )}
                            {!isUncategorized && onRename && (
                                <DropdownMenuItem onClick={onRename}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rename…
                                </DropdownMenuItem>
                            )}
                            {!isUncategorized && onMerge && (
                                <DropdownMenuItem onClick={onMerge}>
                                    <Combine className="mr-2 h-4 w-4" />
                                    Merge…
                                </DropdownMenuItem>
                            )}
                            {!isUncategorized && onDeleteAll && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={onDeleteAll}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete all content
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
