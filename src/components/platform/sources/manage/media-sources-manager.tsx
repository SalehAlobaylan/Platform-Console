'use client';

import { useEffect, useMemo } from 'react';
import Link from '@/lib/console-link';
import { CheckSquare, Plus, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSourceManagement } from '@/components/platform/sources/shared/use-source-management';
import { SelectionToolbar } from '@/components/platform/sources/shared/selection-toolbar';
import { SourceManagementDialogs } from '@/components/platform/sources/shared/source-management-dialogs';
import { useListQueryState } from '@/components/platform/sources/list/use-list-query-state';
import { MediaSourcesToolbar } from '@/components/platform/media/sources/media-sources-toolbar';
import { MediaSourceGallery } from '@/components/platform/media/sources/media-source-gallery';
import { sourceHealth } from '@/lib/sources/health';
import type { ContentSource } from '@/types/platform/source';
import type { NewsSource } from '@/types/platform/discovery';
import type { SortDir, SortField } from '@/components/platform/sources/list/use-list-query-state';

interface MediaSourcesManagerProps {
    /** Media-filtered source roster (media-category + media Telegram). */
    sources: ContentSource[];
    /** Items-produced per source name, from the media-scoped stats endpoint. */
    outputByName: Map<string, { items: number; failed: number }>;
    isLoading: boolean;
    onBusyChange: (busy: boolean) => void;
    refetch: () => Promise<unknown> | void;
    /** Where editor/add links return to (this surface). */
    returnTo: string;
    selectedSourceId?: string | null;
    onSelectSource?: (id: string) => void;
    sourceContextById?: Map<string, NewsSource>;
    profileNameById?: Map<string, string>;
}

function sortSources(arr: ContentSource[], field: SortField, dir: SortDir) {
    const cmp = (a: ContentSource, b: ContentSource): number => {
        switch (field) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'type':
                return a.type.localeCompare(b.type);
            case 'fetch_interval_minutes':
                return a.fetch_interval_minutes - b.fetch_interval_minutes;
            case 'last_fetched_at': {
                const aT = a.last_fetched_at ? new Date(a.last_fetched_at).getTime() : null;
                const bT = b.last_fetched_at ? new Date(b.last_fetched_at).getTime() : null;
                if (aT === null && bT === null) return 0;
                if (aT === null) return 1;
                if (bT === null) return -1;
                return aT - bT;
            }
        }
    };
    const sorted = [...arr].sort(cmp);
    return dir === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Media source management — the channel card gallery + toolbar + bulk actions.
 * Self-contained (owns selection/bulk via the shared hook); reused by the Media
 * Sources page and the Sources page's Media tab.
 */
export function MediaSourcesManager({
    sources,
    outputByName,
    isLoading,
    onBusyChange,
    refetch,
    returnTo,
    selectedSourceId,
    onSelectSource,
    sourceContextById,
    profileNameById,
}: MediaSourcesManagerProps) {
    const { state, setState } = useListQueryState();
    const mgmt = useSourceManagement({ sources, refetch, onBusyChange });

    const filtered = useMemo(() => {
        const q = state.search.trim().toLowerCase();
        const arr = sources.filter((s) => {
            if (q && !s.name.toLowerCase().includes(q)) return false;
            if (state.type !== 'all' && s.type !== state.type) return false;
            if (state.status === 'active' && !s.is_active) return false;
            if (state.status === 'disabled' && s.is_active) return false;
            if (state.health !== 'all' && sourceHealth(s).status !== state.health) return false;
            return true;
        });
        return sortSources(arr, state.sortField, state.sortDir);
    }, [sources, state.search, state.type, state.status, state.health, state.sortField, state.sortDir]);

    const staleSources = useMemo(() => filtered.filter((s) => sourceHealth(s).isStale), [filtered]);
    const filteredIds = filtered.map((s) => s.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => mgmt.selected.has(id));

    // Clear selection when the filter view changes underneath it.
    useEffect(() => {
        mgmt.clear();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.search, state.type, state.status, state.health]);

    const addHref = `/platform/media/sources/new?from=${encodeURIComponent(returnTo)}`;

    return (
        <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => mgmt.openRunStale(staleSources)}
                    disabled={mgmt.bulkBusy || staleSources.length === 0}
                >
                    <Zap className="mr-2 h-4 w-4" />
                    Run all stale{staleSources.length > 0 ? ` (${staleSources.length})` : ''}
                </Button>
                <Button asChild>
                    <Link href={addHref}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add media source
                    </Link>
                </Button>
            </div>

            <MediaSourcesToolbar
                state={state}
                setState={setState}
                count={filtered.length}
                total={sources.length}
            />

            <SelectionToolbar
                count={mgmt.selected.size}
                busy={mgmt.bulkBusy}
                progress={mgmt.progress}
                onClear={mgmt.clear}
                onRun={mgmt.actions.runSelected}
                onEnable={mgmt.actions.enableSelected}
                onDisable={mgmt.actions.disableSelected}
                onChangeInterval={mgmt.actions.openChangeInterval}
                onMoveToNews={mgmt.actions.moveSelectedToNews}
                onDelete={mgmt.actions.openBulkDelete}
            />

            {filtered.length > 0 && (
                <button
                    type="button"
                    onClick={() => mgmt.toggleMany(filteredIds, !allSelected)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {allSelected ? 'Clear selection' : `Select all ${filtered.length}`}
                </button>
            )}

            <MediaSourceGallery
                sources={filtered}
                outputByName={outputByName}
                isLoading={isLoading}
                selected={mgmt.selected}
                selectedSourceId={selectedSourceId}
                sourceContextById={sourceContextById}
                profileNameById={profileNameById}
                onToggleSelect={mgmt.toggleOne}
                onSelectSource={onSelectSource}
                onRequestDelete={mgmt.requestDelete}
                returnTo={returnTo}
            />

            <SourceManagementDialogs dialogs={mgmt.dialogs} />
        </div>
    );
}
