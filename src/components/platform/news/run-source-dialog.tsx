'use client';

import { useMemo, useState } from 'react';
import { DownloadCloud, Play, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useSources, useRunSource } from '@/hooks/use-sources';
import { SOURCE_TYPE_LABELS } from '@/types/platform/source';

/** Header action for the Queue column: trigger a source to pull a fresh batch. */
export function PullFreshButton({ busy = false }: { busy?: boolean }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const sources = useSources({ limit: 100 }, { paused: !open });
    const runSource = useRunSource();

    const filtered = useMemo(() => {
        const list = sources.data?.data ?? [];
        const q = search.trim().toLowerCase();
        return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
    }, [sources.data, search]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" variant="ghost" disabled={busy}>
                    <DownloadCloud className="mr-1.5 h-4 w-4" />
                    Pull fresh
                </Button>} />
            <DialogContent className="max-h-[80vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Pull fresh content</DialogTitle>
                    <DialogDescription>
                        Run a source now — new items arrive in the Queue.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search sources…"
                        className="pl-9"
                    />
                </div>

                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
                    {sources.isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))
                    ) : filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No sources found.
                        </p>
                    ) : (
                        filtered.map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center gap-3 rounded px-2 py-2 hover:bg-muted/50"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-1 text-sm font-medium">{s.name}</p>
                                    <Badge variant="secondary" className="mt-0.5">
                                        {SOURCE_TYPE_LABELS[s.type] ?? s.type}
                                    </Badge>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={runSource.isPending}
                                    onClick={() => runSource.mutate(s.id)}
                                >
                                    <Play className="mr-2 h-4 w-4" />
                                    Run
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
