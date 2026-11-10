'use client';

import { useState } from 'react';
import { Bookmark, Star } from 'lucide-react';
import Link from '@/lib/console-link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type QueueSurface, queueViewHref, useSavedConsoleViews } from '@/lib/saved-console-views';

export function SaveQueueView({ surface, filters, locale, disabled }: {
    surface: QueueSurface;
    filters: Record<string, string>;
    locale?: string;
    disabled?: boolean;
}) {
    const store = useSavedConsoleViews();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<string>();
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    if (!store.ready) return null;

    const report = (ok: boolean, success: string) => setMessage(ok ? success : 'Could not save the change. Check browser storage or remove an older view.');
    const close = () => { setOpen(false); setName(''); setEditing(undefined); setMessage(''); };
    const views = store.views.filter(view => view.surface === surface);
    return <>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Bookmark className="me-2 size-4" aria-hidden="true" />Save view
        </Button>
        <Dialog open={open} onOpenChange={next => next ? setOpen(true) : close()}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogTitle>Saved views</DialogTitle>
                <DialogDescription>Saved in this browser. Each view reopens its filters with current results.</DialogDescription>
                <form className="space-y-2" onSubmit={event => {
                    event.preventDefault();
                    const label = name.trim();
                    if (!label || (!editing && disabled)) return;
                    const ok = editing ? store.edit(editing, { name: label }) : store.save(surface, label, filters);
                    report(ok, editing ? 'View renamed.' : 'View saved.');
                    if (ok) { setName(''); setEditing(undefined); }
                }}>
                    <label className="block space-y-1 text-sm"><span>{editing ? 'New view name' : 'View name'}</span>
                        <Input value={name} onChange={event => setName(event.target.value)} maxLength={64} />
                    </label>
                    {disabled && !editing && <p className="text-sm text-muted-foreground">Wait for the current filters to apply.</p>}
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" disabled={!name.trim() || (disabled && !editing)}>{editing ? 'Rename view' : 'Save current filters'}</Button>
                        {editing && <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(undefined); setName(''); }}>Cancel rename</Button>}
                    </div>
                </form>
                {message && <p role="status" className="text-sm">{message}</p>}
                <ul className="divide-y">
                    {views.map(view => <li key={view.id} className="space-y-1 py-2">
                        <Link dir="auto" onClick={close} href={queueViewHref(surface, view.filters, locale)} className="block break-words text-sm font-semibold text-primary hover:underline">{view.name}</Link>
                        <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="ghost" onClick={() => report(store.edit(view.id, { pinned: !view.pinned }), view.pinned ? 'View unpinned.' : 'View pinned.')}>
                                <Star className="me-1 size-4" aria-hidden="true" />{view.pinned ? 'Unpin' : 'Pin'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(view.id); setName(view.name); setMessage(''); }}>Rename</Button>
                            <Button size="sm" variant="ghost" onClick={() => report(store.remove(view.id), 'View deleted.')}>Delete</Button>
                        </div>
                    </li>)}
                </ul>
            </DialogContent>
        </Dialog>
    </>;
}
