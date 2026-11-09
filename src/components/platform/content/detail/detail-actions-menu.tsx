'use client';

import { useState } from 'react';
import { useRouter } from '@/lib/navigation';
import {
    MoreHorizontal,
    Copy,
    Trash2,
    Loader2,
    Clapperboard,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
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
import {
    useUpdateContentStatus,
    useDeleteContentByIds,
} from '@/hooks/use-content';
import { createOperatorLaunchHref } from '@/lib/operator/route-manifest';
import { persistOperatorLaunchContext } from '@/lib/operator/launch-context';
import { OPERATOR_CONTRACT_VERSION, type OperatorVisibleContext } from '@/types/platform/operator';
import { CONTENT_STATUS_LABELS } from '@/types/platform/content';
import type { ContentItem, ContentStatus } from '@/types/platform/content';

const STATUS_OPTIONS: ContentStatus[] = [
    'PENDING',
    'PROCESSING',
    'READY',
    'FAILED',
    'ARCHIVED',
];

interface DetailActionsMenuProps {
    item: ContentItem;
}

export function DetailActionsMenu({ item }: DetailActionsMenuProps) {
    const router = useRouter();
    const updateStatus = useUpdateContentStatus();
    const deleteByIds = useDeleteContentByIds();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isMediaItem = item.type === 'VIDEO' || item.type === 'PODCAST';

    const isBusy =
        updateStatus.isPending || deleteByIds.isPending;

    const openOperatorRecovery = () => {
        const context: OperatorVisibleContext = {
            schema_version: OPERATOR_CONTRACT_VERSION,
            domain: 'pipeline',
            view: 'content_item',
            filters: {},
            subjects: [{ type: 'content_item', id: item.id }],
            selection: { mode: 'explicit', ids: [item.id], count: 1 },
            available_intents: ['explain', 'investigate', 'recommend', 'compare', 'resolve'],
        };
        persistOperatorLaunchContext(context);
        router.push(createOperatorLaunchHref(context, 'resolve'));
    };

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(item.id);
            toast({ title: 'ID copied', description: item.id, variant: 'success' });
        } catch {
            toast({
                title: 'Copy failed',
                description: 'Clipboard access denied.',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = () => {
        deleteByIds.mutate([item.id], {
            onSuccess: () => {
                setConfirmDelete(false);
                router.push('/platform/content');
            },
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isBusy}>
                        {isBusy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                        )}
                        Actions
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {isMediaItem && (
                        <>
                            <DropdownMenuItem onClick={() => router.push(`/platform/media/atomization?tab=studio&item=${item.id}`)}>
                                <Clapperboard className="mr-2 h-4 w-4" /> Open in Media Studio
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <DropdownMenuLabel className="flex items-center px-0 py-0 font-normal">
                                Set status
                            </DropdownMenuLabel>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {STATUS_OPTIONS.map((s) => (
                                <DropdownMenuItem
                                    key={s}
                                    disabled={s === item.status}
                                    onClick={() =>
                                        updateStatus.mutate({ id: item.id, status: s })
                                    }
                                >
                                    {CONTENT_STATUS_LABELS[s]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={openOperatorRecovery}>
                        Investigate recovery in Operator
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copyId}>
                        <Copy className="mr-2 h-4 w-4" /> Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setConfirmDelete(true)}
                        className="text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog
                open={confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(false)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete content</DialogTitle>
                        <DialogDescription>
                            This permanently deletes <strong>{item.title}</strong>. This
                            action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleteByIds.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteByIds.isPending}
                        >
                            {deleteByIds.isPending ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
