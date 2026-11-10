'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Link from '@/lib/console-link';
import { cmsClient } from '@/lib/api/client';
import { useRouter } from '@/lib/navigation';
import { canReadConsole } from '@/lib/operator-destinations';
import { queueViewHref, useSavedConsoleViews } from '@/lib/saved-console-views';
import { navigation } from '@/lib/constants/routes';
import { useAuthStore } from '@/lib/stores/auth';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';

type Destination = { id?: string; label: string; href: string; context?: string };
type SourceHit = { id: string; name: string; type: string; category: string };
type StoryHit = { id: string; label: string };
type ParentHit = { id: string; title?: string; source_name?: string };
const adminPages = new Set(['/platform/operations', '/platform/workload', '/platform/database-migrations', '/admin/users']);
const pageItems = navigation.flatMap(section => section.items.map(item => ({
    label: item.name, href: item.href, context: section.title,
})));

export function FindAndJump() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [debounced, setDebounced] = useState('');
    const owner = useWorkspaceSession(state => state.owner);
    const recent = useWorkspaceSession(state => state.recent);
    const saved = useSavedConsoleViews();
    const user = useAuthStore(state => state.user);
    const admin = user?.role?.toLowerCase() === 'admin';
    const canReadSources = canReadConsole(user, 'source:read');
    const canReadContent = canReadConsole(user, 'content:read');
    const quickViews: Destination[] = [
        ...(canReadContent ? [
            { label: 'Failed News', href: '/platform/news?view=library&status=FAILED', context: 'News Library' },
            { label: 'Chapters awaiting review', href: '/platform/media/atomization?tab=review&review=needed', context: 'Media Studio' },
        ] : []),
        ...(admin ? [{ label: 'Deferred work', href: '/platform/workload?tab=activity&history=decisions&verdict=defer', context: 'Workload' }] : []),
    ];
    const recents = recent.filter(item => item.kind === 'source' ? canReadSources : canReadContent).map(item => ({
        label: item.title,
        context: item.context || (item.kind === 'episode' ? 'Pods episode' : item.kind === 'story' ? 'News story' : 'Source'),
        href: item.kind === 'source' ? '/platform/sources/' + item.id
            : item.kind === 'story' ? '/platform/news?view=topics&story=' + item.id
            : '/platform/media/atomization?tab=studio&item=' + item.id,
    }));
    const pins = saved.views.filter(view => view.pinned).map(view => ({
        id: view.id, label: view.name, href: queueViewHref(view.surface, view.filters), context: 'Saved view',
    }));
    const trigger = useRef<HTMLButtonElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const close = () => { setOpen(false); setInput(''); setDebounced(''); };

    useEffect(() => {
        setOpen(false);
        setInput('');
        setDebounced('');
    }, [owner]);
    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey ||
                !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
            if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
            event.preventDefault();
            setOpen(true);
        };
        window.addEventListener('keydown', shortcut);
        return () => window.removeEventListener('keydown', shortcut);
    }, []);
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => setDebounced(input.trim()), 300);
        return () => clearTimeout(timer);
    }, [open, input]);

    const match = input.trim().toLocaleLowerCase();
    const enabled = open && Boolean(owner) && debounced.length >= 2 && input.trim() === debounced;
    const sources = useQuery({
        queryKey: ['console-finder', owner, 'sources', enabled ? debounced : ''],
        enabled: enabled && canReadSources, retry: false, gcTime: 0,
        queryFn: async ({ signal }): Promise<Destination[]> => {
            const result = await cmsClient.get<{ items: SourceHit[] }>('/admin/sources/lookup', { q: debounced }, signal);
            return result.items.map(item => ({ label: item.name, href: '/platform/sources/' + encodeURIComponent(item.id), context: [item.category, item.type].filter(Boolean).join(' · ') }));
        },
    });
    const stories = useQuery({
        queryKey: ['console-finder', owner, 'stories', enabled ? debounced : ''],
        enabled: enabled && canReadContent, retry: false, gcTime: 0,
        queryFn: async ({ signal }): Promise<Destination[]> => {
            const result = await cmsClient.get<{ data: StoryHit[] }>('/admin/content/stories', { search: debounced, type: 'NEWS', limit: 6 }, signal);
            return result.data.map(item => ({ label: item.label, href: '/platform/news?view=topics&story=' + encodeURIComponent(item.id), context: item.id.slice(0, 8) }));
        },
    });
    const episodes = useQuery({
        queryKey: ['console-finder', owner, 'episodes', enabled ? debounced : ''],
        enabled: enabled && canReadContent, retry: false, gcTime: 0,
        queryFn: async ({ signal }): Promise<Destination[]> => {
            const result = await cmsClient.get<{ data: { items: ParentHit[]; schema_status?: { ready?: boolean } } }>('/admin/media-atomization/parents', { q: debounced, limit: 6 }, signal);
            if (result.data.schema_status?.ready !== true) throw new Error('Episode search is unavailable.');
            return result.data.items.map(item => ({ label: item.title || 'Untitled episode', href: '/platform/media/atomization?tab=studio&item=' + encodeURIComponent(item.id), context: item.source_name || item.id.slice(0, 8) }));
        },
    });

    return <>
        <Button ref={trigger} size="sm" variant="ghost" aria-label="Find & Jump" onClick={() => setOpen(true)}>
            <Search className="size-4" /><span className="ms-2 hidden lg:inline">Find &amp; Jump</span>
        </Button>
        <Dialog open={open} onOpenChange={next => next ? setOpen(true) : close()}>
            <DialogContent initialFocus={searchInput} finalFocus={trigger} className="max-h-[80vh] overflow-auto" onKeyDown={event => {
                if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
                const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('section a[href]')];
                if (!links.length) return;
                const index = links.indexOf(document.activeElement as HTMLAnchorElement);
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const next = event.key === 'ArrowDown' ? (index + 1) % links.length : index <= 0 ? links.length - 1 : index - 1;
                    links[next]?.focus();
                } else if (event.key === 'Enter' && document.activeElement === searchInput.current && match) {
                    event.preventDefault();
                    links[0]?.click();
                }
            }}>
                <DialogTitle>Find &amp; Jump</DialogTitle>
                <DialogDescription>Open a recent record, a saved view, or a page.</DialogDescription>
                <Input ref={searchInput} value={input} onChange={event => setInput(event.target.value)} aria-label="Search Console" maxLength={100} />
                {!match && recents.length > 0 && <ResultGroup label="Recent work" items={recents} close={close} />}
                {!match && pins.length > 0 && <ResultGroup label="Pinned views" items={pins} close={close} />}
                {quickViews.some(item => item.label.toLowerCase().includes(match)) && <ResultGroup label="Quick views" items={quickViews.filter(item => item.label.toLowerCase().includes(match))} close={close} />}
                <ResultGroup label="Pages" items={pageItems.filter(item => (admin || !adminPages.has(item.href)) && item.label.toLocaleLowerCase().includes(match)).slice(0, 8)} close={close} />
                {enabled && ([['Sources', sources, canReadSources], ['News stories', stories, canReadContent], ['Pods episodes', episodes, canReadContent]] as const).map(([label, query, canRead]) => {
                    return <ResultGroup key={String(label)} label={String(label)} items={query.data ?? []} pending={query.isFetching} failed={!canRead || query.isError} close={close} />;
                })}
            </DialogContent>
        </Dialog>
    </>;
}

function ResultGroup({ label, items, pending, failed, close }: {
    label: string; items: Destination[]; pending?: boolean; failed?: boolean; close: () => void;
}) {
    const router = useRouter();
    return <section aria-label={label}>
        <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
        {failed ? <p className="text-sm">Unavailable</p> : pending ? <p className="text-sm">Searching…</p> : !items.length ? <p className="text-sm">No matches</p> :
            items.map(item => <Link key={item.id ?? item.href} href={item.href} onClick={event => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                close();
                router.push(item.href);
            }} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline focus-visible:outline-ring">
                <span dir="auto">{item.label}</span>{item.context && <span dir="auto" className="text-xs text-muted-foreground">{item.context}</span>}
            </Link>)}
    </section>;
}
