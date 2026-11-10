'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { consoleRuntime } from '@/lib/runtime-config';
import { useAuthStore } from '@/lib/stores/auth';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';
import { canReadConsole, isRecordId } from '@/lib/operator-destinations';

const surfaceSchema = z.enum(['news', 'operations', 'workload']);
export type QueueSurface = z.infer<typeof surfaceSchema>;
const viewSchema = z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(64),
    surface: surfaceSchema,
    filters: z.record(z.string().max(510)),
    pinned: z.boolean(),
}).strict();
export type SavedQueueView = z.infer<typeof viewSchema>;

const limit = 20;
const changed = 'wahb-saved-console-views';
const visibleText = (value: string) => Boolean(value.trim()) && !/[\u0000-\u001f\u007f]/.test(value);
const token = (value: string) => /^[a-z0-9_:-]{1,64}$/i.test(value);
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
const oneOf = (...values: string[]) => (value: string) => values.includes(value);
const fields: Record<QueueSurface, Record<string, (value: string) => boolean>> = {
    news: {
        type: oneOf('NEWS', 'ARTICLE', 'TWEET', 'COMMENT'),
        status: oneOf('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED'),
        topic: value => value === 'none' || isRecordId(value),
        source: value => value.length <= 510 && Array.from(value).length <= 255 && visibleText(value),
        q: value => value.length <= 200 && visibleText(value), from: date, to: date,
        sort: oneOf('newest', 'published', 'oldest', 'title'),
    },
    operations: {
        system: token,
        kind: oneOf('approval', 'episode', 'stalled', 'budget', 'exception', 'attention'),
        severity: oneOf('critical', 'major', 'minor', 'info'),
        state: oneOf('acked', 'snoozed', 'all'),
    },
    workload: {
        history: oneOf('decisions', 'permits'), class: token,
        verdict: token, state: token,
    },
};

export function queueViewFilters(surface: QueueSurface, input: URLSearchParams | Record<string, string>) {
    const params = new URLSearchParams(input);
    const result: Record<string, string> = {};
    for (const [field, valid] of Object.entries(fields[surface])) {
        const value = params.get(field);
        if (value && valid(value)) result[field] = value;
    }
    if (surface === 'news' && result.type && ['TWEET', 'COMMENT'].includes(result.type)) delete result.topic;
    if (surface === 'workload') {
        delete result[result.history === 'permits' ? 'verdict' : 'state'];
    }
    return result;
}

export function queueViewHref(surface: QueueSurface, filters: Record<string, string>, locale?: string) {
    const params = new URLSearchParams(surface === 'news' ? { view: 'library' } : surface === 'workload' ? { tab: 'activity' } : {});
    for (const [name, value] of Object.entries(queueViewFilters(surface, filters))) params.set(name, value);
    if (locale === 'ar' && surface !== 'news') params.set('locale', locale);
    const query = params.toString();
    return '/platform/' + surface + (query ? '?' + query : '') + (surface === 'operations' ? '#ops-attention' : '');
}

export function useSavedConsoleViews() {
    const owner = useWorkspaceSession(state => state.owner);
    const user = useAuthStore(state => state.user);
    const authenticated = useAuthStore(state => state.isAuthenticated);
    const { runtimeId, environmentId } = consoleRuntime();
    // localStorage is already isolated by origin. Managed launches also share
    // an origin across profiles, so require their stable profile identity.
    const key = owner && authenticated && user?.tenant_id && (!runtimeId || environmentId)
        ? 'wahb-console-views/v1/' + JSON.stringify([environmentId || 'deployed', user.tenant_id, user.id]) : undefined;
    const [loaded, setLoaded] = useState<{ key?: string; items: SavedQueueView[] }>({ items: [] });
    useEffect(() => {
        const refresh = () => setLoaded({ key, items: read(key) });
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener(changed, refresh);
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(changed, refresh); };
    }, [key]);
    const available = (surface: QueueSurface) => surface === 'news'
        ? canReadConsole(user, 'content:read') : user?.role?.toLowerCase() === 'admin';
    const update = (change: (views: SavedQueueView[]) => SavedQueueView[]) => {
        if (!key || useWorkspaceSession.getState().owner !== owner) return false;
        try {
            const items = change(read(key));
            if (items.length > limit) return false;
            localStorage.setItem(key, JSON.stringify(items));
            window.dispatchEvent(new Event(changed));
            return true;
        } catch {
            return false;
        }
    };
    return {
        views: loaded.key === key && key ? loaded.items.filter(view => available(view.surface)) : [],
        ready: Boolean(key),
        save: (surface: QueueSurface, name: string, filters: Record<string, string>) => available(surface) && update(items => [
            ...items, { id: crypto.randomUUID(), surface, name, filters: queueViewFilters(surface, filters), pinned: false },
        ]),
        edit: (id: string, patch: Partial<Pick<SavedQueueView, 'name' | 'pinned'>>) => update(items => items.map(view => view.id === id && available(view.surface) ? { ...view, ...patch } : view)),
        remove: (id: string) => update(items => items.filter(view => view.id !== id || !available(view.surface))),
    };
}

function read(key?: string): SavedQueueView[] {
    if (!key) return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw || raw.length > 100_000) return [];
        const parsed = z.array(viewSchema).max(limit).safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.map(view => ({ ...view, filters: queueViewFilters(view.surface, view.filters) })) : [];
    } catch {
        return [];
    }
}
