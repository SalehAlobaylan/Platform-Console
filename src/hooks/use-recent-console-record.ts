'use client';

import { useEffect } from 'react';
import { type RecentConsoleRecord, useWorkspaceSession } from '@/lib/stores/workspace-session';

export function useRecentConsoleRecord(kind: RecentConsoleRecord['kind'], id?: string, title?: string | null, context?: string) {
    const owner = useWorkspaceSession(state => state.owner);
    useEffect(() => {
        if (!owner || !id || !title || useWorkspaceSession.getState().owner !== owner) return;
        useWorkspaceSession.getState().recordRecent({ kind, id, title: title.slice(0, 240), context: context?.slice(0, 120) });
    }, [owner, kind, id, title, context]);
}
