'use client';

import { useState, useMemo } from 'react';
import Link from '@/lib/console-link';
import { ArrowLeft, Search, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { FlagDistributionChart } from '@/components/platform/intelligence';
import { useContentFlags, useUpsertFlag, useDeleteFlag } from '@/hooks/use-intelligence';
import type { ContentFlag, UpsertFlagRequest } from '@/types/platform/intelligence';

interface EditFormState {
    contentId: string;
    data: UpsertFlagRequest;
}

export default function FlagsPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;

    const { data: response, isLoading, error } = useContentFlags({ page, limit });
    const upsertFlag = useUpsertFlag();
    const deleteFlag = useDeleteFlag();

    const [editDialog, setEditDialog] = useState(false);
    const [editForm, setEditForm] = useState<EditFormState>({
        contentId: '',
        data: {
            boost: false,
            suppress: false,
            pin_to_top: false,
            exclude_from_feed: false,
            boost_multiplier: 1.5,
            notes: '',
        },
    });

    const flags: ContentFlag[] = response?.data ?? [];
    const total = response?.total ?? 0;

    const filtered = useMemo(() => {
        if (!search) return flags;
        const q = search.toLowerCase();
        return flags.filter(
            (f: ContentFlag) =>
                f.content_item_id.toLowerCase().includes(q) ||
                (f.notes && f.notes.toLowerCase().includes(q))
        );
    }, [flags, search]);

    // Distribution counts
    const boosted = flags.filter((f: ContentFlag) => f.boost).length;
    const suppressed = flags.filter((f: ContentFlag) => f.suppress).length;
    const pinned = flags.filter((f: ContentFlag) => f.pin_to_top).length;
    const excluded = flags.filter((f: ContentFlag) => f.exclude_from_feed).length;

    const openNewFlag = () => {
        setEditForm({
            contentId: '',
            data: {
                boost: false,
                suppress: false,
                pin_to_top: false,
                exclude_from_feed: false,
                boost_multiplier: 1.5,
                notes: '',
            },
        });
        setEditDialog(true);
    };

    const openEditFlag = (flag: ContentFlag) => {
        setEditForm({
            contentId: flag.content_item_id,
            data: {
                boost: flag.boost,
                suppress: flag.suppress,
                pin_to_top: flag.pin_to_top,
                exclude_from_feed: flag.exclude_from_feed,
                boost_multiplier: flag.boost_multiplier,
                notes: flag.notes ?? '',
            },
        });
        setEditDialog(true);
    };

    const handleSave = () => {
        if (!editForm.contentId) {
            toast({ title: 'Error', description: 'Content Item ID is required', variant: 'destructive' });
            return;
        }
        upsertFlag.mutate(
            { contentId: editForm.contentId, data: editForm.data },
            {
                onSuccess: () => {
                    toast({ title: 'Flag saved' });
                    setEditDialog(false);
                },
                onError: (err) => {
                    toast({
                        title: 'Save failed',
                        description: err instanceof Error ? err.message : 'Unknown error',
                        variant: 'destructive',
                    });
                },
            }
        );
    };

    const handleDelete = (contentItemId: string) => {
        deleteFlag.mutate(contentItemId, {
            onSuccess: () => toast({ title: 'Flag deleted' }),
            onError: (err) =>
                toast({
                    title: 'Delete failed',
                    description: err instanceof Error ? err.message : 'Unknown error',
                    variant: 'destructive',
                }),
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/platform/intelligence">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Content Flags</h1>
                        <p className="text-muted-foreground">
                            Boost, suppress, pin, or exclude individual content items
                        </p>
                    </div>
                </div>
                <Button onClick={openNewFlag}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Flag
                </Button>
            </div>

            {/* Distribution + Search */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Flag Distribution</CardTitle>
                        <CardDescription>{total} total flags</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FlagDistributionChart
                            boosted={boosted}
                            suppressed={suppressed}
                            pinned={pinned}
                            excluded={excluded}
                            total={total}
                        />
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">All Flags</CardTitle>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or notes..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : error ? (
                            <p className="text-center text-destructive py-8">Failed to load flags</p>
                        ) : filtered.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                {search ? 'No flags match your search' : 'No content flags set yet'}
                            </p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Content ID</TableHead>
                                            <TableHead>Flags</TableHead>
                                            <TableHead>Multiplier</TableHead>
                                            <TableHead>Set By</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((flag: ContentFlag) => (
                                            <TableRow key={flag.id}>
                                                <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                                    {flag.content_item_id}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {flag.boost && <Badge variant="outline" className="text-green-600 border-green-600">Boost</Badge>}
                                                        {flag.suppress && <Badge variant="outline" className="text-red-600 border-red-600">Suppress</Badge>}
                                                        {flag.pin_to_top && <Badge variant="outline" className="text-blue-600 border-blue-600">Pin</Badge>}
                                                        {flag.exclude_from_feed && <Badge variant="destructive">Excluded</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="tabular-nums">{flag.boost_multiplier}x</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{flag.set_by || '\u2014'}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => openEditFlag(flag)}>
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(flag.content_item_id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Pagination */}
                        {total > limit && (
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-sm text-muted-foreground">
                                    Page {page} of {Math.ceil(total / limit)}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={page >= Math.ceil(total / limit)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={editDialog} onOpenChange={setEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editForm.contentId ? 'Edit Flag' : 'Add Flag'}</DialogTitle>
                        <DialogDescription>Set editorial flags for a content item</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label>Content Item ID</Label>
                            <Input
                                placeholder="UUID of the content item"
                                value={editForm.contentId}
                                onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, contentId: e.target.value }))
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="flag-boost"
                                    checked={editForm.data.boost}
                                    onCheckedChange={(c) =>
                                        setEditForm((prev) => ({ ...prev, data: { ...prev.data, boost: c as boolean } }))
                                    }
                                />
                                <Label htmlFor="flag-boost">Boost</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="flag-suppress"
                                    checked={editForm.data.suppress}
                                    onCheckedChange={(c) =>
                                        setEditForm((prev) => ({ ...prev, data: { ...prev.data, suppress: c as boolean } }))
                                    }
                                />
                                <Label htmlFor="flag-suppress">Suppress</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="flag-pin"
                                    checked={editForm.data.pin_to_top}
                                    onCheckedChange={(c) =>
                                        setEditForm((prev) => ({ ...prev, data: { ...prev.data, pin_to_top: c as boolean } }))
                                    }
                                />
                                <Label htmlFor="flag-pin">Pin to Top</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="flag-exclude"
                                    checked={editForm.data.exclude_from_feed}
                                    onCheckedChange={(c) =>
                                        setEditForm((prev) => ({ ...prev, data: { ...prev.data, exclude_from_feed: c as boolean } }))
                                    }
                                />
                                <Label htmlFor="flag-exclude">Exclude from Feed</Label>
                            </div>
                        </div>
                        {editForm.data.boost && (
                            <div className="space-y-1.5">
                                <Label>Boost Multiplier</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={editForm.data.boost_multiplier}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({
                                            ...prev,
                                            data: { ...prev.data, boost_multiplier: parseFloat(e.target.value) || 1.5 },
                                        }))
                                    }
                                />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label>Notes (optional)</Label>
                            <Input
                                placeholder="Reason for flagging..."
                                value={editForm.data.notes}
                                onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, data: { ...prev.data, notes: e.target.value } }))
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={upsertFlag.isPending}>
                            {upsertFlag.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
