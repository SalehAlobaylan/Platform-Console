'use client';

import { formatDistanceToNow } from 'date-fns';
import {
    MoreHorizontal,
    Archive,
    Trash2,
    Undo2,
    Send,
    ExternalLink,
    Eye,
    Star,
    Newspaper,
    FolderInput,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ContentStatus } from '@/types/platform/content';
import type { NewsItem } from '@/types/platform/news';

interface NewsCardProps {
    item: NewsItem;
    status: ContentStatus;
    featured?: boolean;
    selected: boolean;
    busy?: boolean;
    onSelect: (id: string) => void;
    onPublish?: (id: string) => void;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    onToggleFeature?: (id: string, on: boolean) => void;
    onMove?: (id: string) => void;
    onDelete?: (id: string) => void;
}

function rel(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : formatDistanceToNow(d, { addSuffix: true });
}

export function NewsCard({
    item,
    status,
    featured = false,
    selected,
    busy = false,
    onSelect,
    onPublish,
    onArchive,
    onRestore,
    onToggleFeature,
    onMove,
    onDelete,
}: NewsCardProps) {
    return (
        <Card
            className={cn(
                'transition-colors',
                selected ? 'border-primary/60 bg-primary/5' : 'hover:border-primary/30',
                featured && !selected && 'border-amber-400/50'
            )}
        >
            <CardContent className="space-y-2 p-2.5">
                <div className="flex gap-2.5">
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onSelect(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1"
                    />
                    {item.thumbnail_url ? (
                        <img
                            src={item.thumbnail_url}
                            alt=""
                            className="h-12 w-16 flex-shrink-0 rounded object-cover"
                        />
                    ) : (
                        <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded bg-muted">
                            <Newspaper className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        {featured && (
                            <Badge variant="warning" className="mb-1 gap-1 text-[10px] uppercase">
                                <Star className="h-3 w-3 fill-current" />
                                Featured
                            </Badge>
                        )}
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                            {item.title || 'Untitled'}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.source_name || 'Manual'} · {rel(item.published_at || item.created_at)}
                            {status !== 'PENDING' && (
                                <>
                                    {' · '}
                                    <span className="inline-flex items-center gap-0.5">
                                        <Eye className="h-3 w-3" />
                                        {item.view_count ?? 0}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>} />
                        <DropdownMenuContent align="end">
                            {status === 'PENDING' && (
                                <DropdownMenuItem onClick={() => onPublish?.(item.id)} disabled={busy}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Publish
                                </DropdownMenuItem>
                            )}
                            {status === 'READY' && (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => onToggleFeature?.(item.id, !featured)}
                                        disabled={busy}
                                    >
                                        <Star className={cn('mr-2 h-4 w-4', featured && 'fill-current text-amber-500')} />
                                        {featured ? 'Unfeature' : 'Feature'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onArchive?.(item.id)} disabled={busy}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        Archive
                                    </DropdownMenuItem>
                                </>
                            )}
                            {status === 'ARCHIVED' && (
                                <DropdownMenuItem onClick={() => onRestore?.(item.id)} disabled={busy}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Restore
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onMove?.(item.id)} disabled={busy}>
                                <FolderInput className="mr-2 h-4 w-4" />
                                Move to story
                            </DropdownMenuItem>
                            {item.original_url && (
                                <DropdownMenuItem render={<a href={item.original_url} target="_blank" rel="noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open source
                                    </a>} nativeButton={false} />
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete?.(item.id)}
                                disabled={busy}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
