'use client';

import { ExternalLink } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { PreviewItem } from '@/types/platform/source';

interface PreviewTableProps {
    items: PreviewItem[];
}

function formatDate(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function formatDuration(sec?: number): string | null {
    if (!sec || sec <= 0) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function PreviewTable({ items }: PreviewTableProps) {
    // Defensive: a failed/error preview response (e.g. timeout) may omit `items`
    // entirely. Guard against undefined so the wizard shows the empty state
    // instead of crashing with "Cannot read properties of undefined (length)".
    items = items ?? [];
    if (items.length === 0) {
        return (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No items returned. Adjust filters and try again.
            </p>
        );
    }

    const hasThumbs = items.some((i) => i.thumbnailUrl);

    return (
        <div className="overflow-hidden rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[45%]">Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead className="w-10" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const duration = formatDuration(item.durationSec);
                        return (
                            <TableRow key={item.idempotencyKey}>
                                <TableCell className="max-w-0">
                                    <div className="flex items-center gap-3">
                                        {hasThumbs && (
                                            <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                                                {item.thumbnailUrl && (
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt=""
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                )}
                                                {duration && (
                                                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] font-medium tabular-nums text-white">
                                                        {duration}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{item.title}</div>
                                            {item.excerpt && (
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {item.excerpt}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant="secondary" className="w-fit text-[10px]">
                                            {item.type}
                                        </Badge>
                                        {duration && !hasThumbs && (
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                {duration}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {item.author || '—'}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(item.publishedAt)}
                                </TableCell>
                                <TableCell>
                                    {item.originalUrl && (
                                        <a
                                            href={item.originalUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-muted-foreground hover:text-foreground"
                                            aria-label="Open original"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
