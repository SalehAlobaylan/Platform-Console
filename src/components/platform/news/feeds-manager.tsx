'use client';

import { useMemo, useState } from 'react';
import {
    Plus,
    Copy,
    ExternalLink,
    MoreHorizontal,
    Pencil,
    Trash2,
    Rss,
    ChevronDown,
} from 'lucide-react';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useFeeds, useDeleteFeed } from '@/hooks/use-feeds';
import { useTopics } from '@/hooks/use-news';
import { FeedFormDialog } from '@/components/platform/news/feed-form-dialog';
import type { RSSFeed } from '@/types/platform/feed';

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied', description: text, variant: 'success' });
    } catch {
        toast({ title: 'Copy failed', description: 'Clipboard access denied.', variant: 'destructive' });
    }
}

export function FeedsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { data, isLoading } = useFeeds();
    const topics = useTopics({ limit: 200 });
    const deleteFeed = useDeleteFeed();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<RSSFeed | null>(null);
    const [del, setDel] = useState<RSSFeed | null>(null);

    const topicLabel = useMemo(() => {
        const m = new Map<string, string>();
        for (const t of topics.data?.data ?? []) m.set(t.id, t.label);
        return m;
    }, [topics.data]);

    const feeds = data?.data ?? [];

    const scopeText = (f: RSSFeed): string => {
        const parts: string[] = [];
        if (f.story_id) parts.push(topicLabel.get(f.story_id) ?? 'story removed');
        else parts.push('All stories');
        if (f.content_type) parts.push(f.content_type);
        return parts.join(' · ');
    };

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
                <SheetHeader className="flex-row items-center justify-between gap-2 border-b p-5">
                    <div>
                        <SheetTitle className="flex items-center gap-2">
                            <Rss className="h-5 w-5" />
                            RSS feeds
                        </SheetTitle>
                        <SheetDescription>
                            Public syndication feeds generated from your news.
                        </SheetDescription>
                    </div>
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setFormOpen(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New feed
                    </Button>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-5">
                    {isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : feeds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
                            <Rss className="mb-2 h-7 w-7 opacity-40" />
                            No saved feeds yet. Create one, or use per-story feeds from the board.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Scope</TableHead>
                                        <TableHead className="w-[120px]">URL</TableHead>
                                        <TableHead className="w-10" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {feeds.map((f) => (
                                        <TableRow key={f.id}>
                                            <TableCell>
                                                <div className="font-medium">{f.name}</div>
                                                {!f.enabled && (
                                                    <Badge variant="outline" className="mt-0.5">
                                                        disabled
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {scopeText(f)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger render={<Button size="sm" variant="outline">
                                                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                                                            Copy
                                                            <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                                        </Button>} />
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => copyText(f.rss_url)}>
                                                            RSS
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => copyText(f.atom_url)}>
                                                            Atom
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => copyText(f.json_url)}>
                                                            JSON Feed
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem render={<a href={f.rss_url} target="_blank" rel="noreferrer">
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Open
                                                            </a>} nativeButton={false} />
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Feed actions">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>} />
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setEditing(f);
                                                                setFormOpen(true);
                                                            }}
                                                        >
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDel(f)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <FeedFormDialog open={formOpen} feed={editing} onClose={() => setFormOpen(false)} />

                <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete feed “{del?.name}”</DialogTitle>
                            <DialogDescription>
                                The public URL will stop working. This cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDel(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={deleteFeed.isPending}
                                onClick={() =>
                                    del &&
                                    deleteFeed.mutate(del.id, { onSuccess: () => setDel(null) })
                                }
                            >
                                {deleteFeed.isPending ? 'Deleting…' : 'Delete'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SheetContent>
        </Sheet>
    );
}
