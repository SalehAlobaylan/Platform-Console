'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import type { SourceCategory, SourceHealth, SourceType } from '@/types/platform/source';

export type StatusFilter = 'all' | 'active' | 'disabled';
export type TypeFilter = 'all' | SourceType;
export type CategoryFilter = 'all' | SourceCategory;
export type HealthFilter = 'all' | SourceHealth;
export type SortField = 'name' | 'type' | 'last_fetched_at' | 'fetch_interval_minutes';
export type SortDir = 'asc' | 'desc';

export interface ListQueryState {
    page: number;
    search: string;
    status: StatusFilter;
    type: TypeFilter;
    /** Cross-category filter — used by the Sources fleet command center. */
    category: CategoryFilter;
    /** Derived-health filter — used by the Sources fleet command center. */
    health: HealthFilter;
    sortField: SortField;
    sortDir: SortDir;
}

const DEFAULTS: ListQueryState = {
    page: 1,
    search: '',
    status: 'all',
    type: 'all',
    category: 'all',
    health: 'all',
    sortField: 'last_fetched_at',
    sortDir: 'desc',
};

const VALID_CATEGORIES: ReadonlyArray<CategoryFilter> = ['all', 'news', 'media'];
const VALID_HEALTH: ReadonlyArray<HealthFilter> = [
    'all',
    'healthy',
    'stale',
    'never_run',
    'disabled',
];

const VALID_TYPES: ReadonlyArray<TypeFilter> = [
    'all',
    'RSS',
    'PODCAST',
    'YOUTUBE',
    'TWITTER',
    'REDDIT',
    'TELEGRAM',
    'MANUAL',
];

const VALID_SORT_FIELDS: ReadonlyArray<SortField> = [
    'name',
    'type',
    'last_fetched_at',
    'fetch_interval_minutes',
];

const MANAGED_KEYS = ['page', 'q', 'status', 'type', 'category', 'health', 'sort', 'dir'] as const;

function readFromParams(params: URLSearchParams): ListQueryState {
    const page = Number(params.get('page')) || DEFAULTS.page;
    const search = params.get('q') ?? DEFAULTS.search;
    const statusRaw = params.get('status') ?? DEFAULTS.status;
    const status: StatusFilter =
        statusRaw === 'active' || statusRaw === 'disabled' ? statusRaw : 'all';
    const typeRaw = (params.get('type') ?? DEFAULTS.type) as TypeFilter;
    const type: TypeFilter = VALID_TYPES.includes(typeRaw) ? typeRaw : 'all';
    const categoryRaw = (params.get('category') ?? DEFAULTS.category) as CategoryFilter;
    const category: CategoryFilter = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'all';
    const healthRaw = (params.get('health') ?? DEFAULTS.health) as HealthFilter;
    const health: HealthFilter = VALID_HEALTH.includes(healthRaw) ? healthRaw : 'all';
    const sortFieldRaw = (params.get('sort') ?? DEFAULTS.sortField) as SortField;
    const sortField: SortField = VALID_SORT_FIELDS.includes(sortFieldRaw)
        ? sortFieldRaw
        : DEFAULTS.sortField;
    const sortDirRaw = params.get('dir') ?? DEFAULTS.sortDir;
    const sortDir: SortDir = sortDirRaw === 'asc' ? 'asc' : 'desc';

    return { page: Math.max(1, page), search, status, type, category, health, sortField, sortDir };
}

function toQueryString(state: ListQueryState, baseParams?: URLSearchParams): string {
    const params = new URLSearchParams(baseParams);
    for (const key of MANAGED_KEYS) params.delete(key);
    if (state.page !== DEFAULTS.page) params.set('page', String(state.page));
    if (state.search) params.set('q', state.search);
    if (state.status !== DEFAULTS.status) params.set('status', state.status);
    if (state.type !== DEFAULTS.type) params.set('type', state.type);
    if (state.category !== DEFAULTS.category) params.set('category', state.category);
    if (state.health !== DEFAULTS.health) params.set('health', state.health);
    if (state.sortField !== DEFAULTS.sortField) params.set('sort', state.sortField);
    if (state.sortDir !== DEFAULTS.sortDir) params.set('dir', state.sortDir);
    const s = params.toString();
    return s ? `?${s}` : '';
}

export function useListQueryState() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state is the source of truth so input typing stays snappy;
    // we push to the URL via a debounced effect.
    const [state, setStateInternal] = useState<ListQueryState>(() =>
        readFromParams(searchParams)
    );

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const target = `${pathname}${toQueryString(state, searchParams)}`;
            router.replace(target, { scroll: false });
        }, 250);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // pathname is stable for this page; we deliberately don't react to it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, searchParams]);

    const setState = useCallback((patch: Partial<ListQueryState>) => {
        setStateInternal((prev) => {
            // Any filter change resets the page to 1 unless the caller is changing the page itself.
            const resetPage =
                patch.page === undefined &&
                (patch.search !== undefined ||
                    patch.status !== undefined ||
                    patch.type !== undefined ||
                    patch.category !== undefined ||
                    patch.health !== undefined);
            return { ...prev, ...patch, page: resetPage ? 1 : patch.page ?? prev.page };
        });
    }, []);

    const toggleSort = useCallback((field: SortField) => {
        setStateInternal((prev) => {
            if (prev.sortField === field) {
                return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' };
            }
            return { ...prev, sortField: field, sortDir: 'desc' };
        });
    }, []);

    return { state, setState, toggleSort };
}
