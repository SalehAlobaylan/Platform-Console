'use client';

import {
    MoreHorizontal,
    Play,
    Pencil,
    Link as LinkIcon,
    PowerOff,
    Power,
    Trash2,
    Loader2,
    Newspaper,
    Video,
} from 'lucide-react';
import { useRouter, usePathname } from '@/lib/navigation';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { useRunSource, useUpdateSource } from '@/hooks/use-sources';
import type { ContentSource } from '@/types/platform/source';

interface SourceRowActionsProps {
    source: ContentSource;
    onDelete: () => void;
}

export function SourceRowActions({ source, onDelete }: SourceRowActionsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const runMutation = useRunSource();
    const updateMutation = useUpdateSource();

    // Editing returns to wherever the operator opened it from (Media Sources or
    // News → Feeds Finding) rather than always the Sources dashboard.
    const editHref = `/platform/sources/${source.id}?from=${encodeURIComponent(pathname)}`;

    const isRunning = runMutation.isPending && runMutation.variables === source.id;

    const copyFeedUrl = async () => {
        if (!source.feed_url) return;
        try {
            await navigator.clipboard.writeText(source.feed_url);
            toast({ title: 'Copied', description: source.feed_url, variant: 'success' });
        } catch {
            toast({
                title: 'Copy failed',
                description: 'Clipboard access denied.',
                variant: 'destructive',
            });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Row actions">
                    {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MoreHorizontal className="h-4 w-4" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => runMutation.mutate(source.id)}
                    disabled={isRunning}
                >
                    <Play className="mr-2 h-4 w-4" /> Run now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(editHref)}>
                    <Pencil className="mr-2 h-4 w-4" /> Open editor
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={copyFeedUrl}
                    disabled={!source.feed_url}
                >
                    <LinkIcon className="mr-2 h-4 w-4" /> Copy feed URL
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() =>
                        updateMutation.mutate({
                            id: source.id,
                            data: { is_active: !source.is_active },
                        })
                    }
                    disabled={updateMutation.isPending}
                >
                    {source.is_active ? (
                        <>
                            <PowerOff className="mr-2 h-4 w-4" /> Disable
                        </>
                    ) : (
                        <>
                            <Power className="mr-2 h-4 w-4" /> Enable
                        </>
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() =>
                        updateMutation.mutate({
                            id: source.id,
                            data: { category: source.category === 'media' ? 'news' : 'media' },
                        })
                    }
                    disabled={updateMutation.isPending}
                >
                    {source.category === 'media' ? (
                        <>
                            <Newspaper className="mr-2 h-4 w-4" /> Move to News
                        </>
                    ) : (
                        <>
                            <Video className="mr-2 h-4 w-4" /> Move to Media
                        </>
                    )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
