'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import type { AccountTypeFilter } from './account-helpers';

export type UserSortField = 'email' | 'role' | 'created_at' | 'permissions';
export type UserSortDir = 'asc' | 'desc';

export interface AuthCenterQueryState {
  page: number;
  search: string;
  role: string;
  accountType: AccountTypeFilter;
  permission: string;
  sortField: UserSortField;
  sortDir: UserSortDir;
}

const DEFAULTS: AuthCenterQueryState = {
  page: 1,
  search: '',
  role: 'all',
  accountType: 'all',
  permission: 'all',
  sortField: 'created_at',
  sortDir: 'desc',
};

const VALID_ACCOUNT_TYPES: ReadonlyArray<AccountTypeFilter> = ['all', 'staff', 'app'];
const VALID_SORT_FIELDS: ReadonlyArray<UserSortField> = ['email', 'role', 'created_at', 'permissions'];

function readFromParams(params: URLSearchParams): AuthCenterQueryState {
  const page = Math.max(1, Number(params.get('page')) || DEFAULTS.page);
  const search = params.get('q') ?? DEFAULTS.search;
  const role = params.get('role') ?? DEFAULTS.role;
  const accountTypeRaw = (params.get('accountType') ?? DEFAULTS.accountType) as AccountTypeFilter;
  const accountType = VALID_ACCOUNT_TYPES.includes(accountTypeRaw) ? accountTypeRaw : DEFAULTS.accountType;
  const permission = params.get('permission') ?? DEFAULTS.permission;
  const sortFieldRaw = (params.get('sort') ?? DEFAULTS.sortField) as UserSortField;
  const sortField = VALID_SORT_FIELDS.includes(sortFieldRaw) ? sortFieldRaw : DEFAULTS.sortField;
  const sortDir: UserSortDir = params.get('dir') === 'asc' ? 'asc' : 'desc';

  return { page, search, role, accountType, permission, sortField, sortDir };
}

function toQueryString(state: AuthCenterQueryState): string {
  const params = new URLSearchParams();
  if (state.page !== DEFAULTS.page) params.set('page', String(state.page));
  if (state.search) params.set('q', state.search);
  if (state.role !== DEFAULTS.role) params.set('role', state.role);
  if (state.accountType !== DEFAULTS.accountType) params.set('accountType', state.accountType);
  if (state.permission !== DEFAULTS.permission) params.set('permission', state.permission);
  if (state.sortField !== DEFAULTS.sortField) params.set('sort', state.sortField);
  if (state.sortDir !== DEFAULTS.sortDir) params.set('dir', state.sortDir);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function useAuthCenterQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setStateInternal] = useState<AuthCenterQueryState>(() => readFromParams(searchParams));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(`${pathname}${toQueryString(state)}`, { scroll: false });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pathname, router, state]);

  const setState = useCallback((patch: Partial<AuthCenterQueryState>) => {
    setStateInternal((prev) => {
      const resetPage =
        patch.page === undefined &&
        (patch.search !== undefined ||
          patch.role !== undefined ||
          patch.accountType !== undefined ||
          patch.permission !== undefined);
      return { ...prev, ...patch, page: resetPage ? 1 : patch.page ?? prev.page };
    });
  }, []);

  const toggleSort = useCallback((field: UserSortField) => {
    setStateInternal((prev) => {
      if (prev.sortField === field) {
        return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' };
      }
      return { ...prev, sortField: field, sortDir: 'desc' };
    });
  }, []);

  return { state, setState, toggleSort };
}
