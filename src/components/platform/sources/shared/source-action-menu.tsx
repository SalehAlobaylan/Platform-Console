'use client';

import { useState } from 'react';
import { useRouter } from '@/lib/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
    Link as LinkIcon,
    Loader2,
    MoreHorizontal,
    Newspaper,
    Pencil,
    Play,
    Power,
    PowerOff,
    Trash2,
    Video,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { sourceKeys } from '@/hooks/use-sources';
import { runSource, updateSource } from '@/lib/api/cms/sources';
import type { ContentSource } from '@/types/platform/source';

interface SourceActionMenuProps {
    disabled?: boolean;
    hideActivation?: boolean;
    onRequestActivation?: (id: string, active: boolean) => void;
    source: ContentSource;
    /** Where the editor should return to (the `from` param). */
    returnTo: string;
    /** Opens the (shared) delete confirmation for this source. */
    onRequestDelete: (id: string) => void;
    /** Optional compact trigger (icon only) vs. default ghost icon button. */
    align?: 'start' | 'end';
    /** Called after a successful mutation — surfaces that load from a different
     *  query key (e.g. the news list) can refetch immediately. */
    onChanged?: () => void;
}

/**
 * Per-source action dropdown shared by the media card gallery and the fleet
 * table. Mutations invalidate `sourceKeys.all` so every surface (gallery, fleet,
 * stats) reflects the change immediately.
 */
export function SourceActionMenu({
    source,
    returnTo,
    onRequestDelete,
    align = 'end',
    onChanged,
    disabled,
    onRequestActivation,
    hideActivation,
}: SourceActionMenuProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: sourceKeys.all });

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try {
            await fn();
            invalidate();
            onChanged?.();
            toast({ title: ok, variant: 'success' });
        } catch (e) {
            toast({
                title: 'Action failed',
                description: e instanceof Error ? e.message : undefined,
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };

    const copyFeedUrl = async () => {
        if (!source.feed_url) return;
        try {
            await navigator.clipboard.writeText(source.feed_url);
            toast({ title: 'Copied', description: source.feed_url, variant: 'success' });
        } catch {
            toast({ title: 'Copy failed', description: 'Clipboard access denied.', variant: 'destructive' });
        }
    };

    const isMedia = source.category === 'media';
    const editHref = `/platform/sources/${source.id}?from=${encodeURIComponent(returnTo)}`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Source actions" disabled={busy || disabled}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-48">
                <DropdownMenuItem disabled={!source.is_active} onClick={() => run(() => runSource(source.id), 'Ingestion queued')}>
                    <Play className="mr-2 h-4 w-4" /> Run now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(editHref)}>
                    <Pencil className="mr-2 h-4 w-4" /> Open editor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyFeedUrl} disabled={!source.feed_url}>
                    <LinkIcon className="mr-2 h-4 w-4" /> Copy feed URL
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!hideActivation && <>
                <DropdownMenuItem
                    onClick={() => onRequestActivation ? onRequestActivation(source.id, !source.is_active) :
                        run(
                            () => updateSource(source.id, { is_active: !source.is_active }),
                            source.is_active ? 'Source disabled' : 'Source enabled'
                        )
                    }
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
                </>}
                <DropdownMenuItem
                    onClick={() =>
                        run(
                            () => updateSource(source.id, { category: isMedia ? 'news' : 'media' }),
                            isMedia ? 'Moved to News' : 'Moved to Media'
                        )
                    }
                >
                    {isMedia ? (
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
                <DropdownMenuItem onClick={() => onRequestDelete(source.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
