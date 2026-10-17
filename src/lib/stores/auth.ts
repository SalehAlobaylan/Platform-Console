import { create } from 'zustand';
import { login as iamLogin, logout as iamLogout, getMe as iamGetMe } from '@/lib/api/iam/auth';
import type { User } from '@/lib/api/cms/types';
import type { MeResponse as IamMeResponse } from '@/lib/api/iam/types';

const ROLE_PRIORITY = ['admin', 'manager', 'editor', 'agent', 'user'] as const;

function selectPrimaryRole(roles: string[], isAdmin: boolean): string {
    const normalized = roles.map((role) => role.toLowerCase());
    if (isAdmin || normalized.includes('admin')) {
        return 'admin';
    }
    for (const role of ROLE_PRIORITY) {
        if (normalized.includes(role)) {
            return role;
        }
    }
    return normalized[0] || 'user';
}

function mapIamUser(me: IamMeResponse): User {
    return {
        id: me.user_id,
        tenant_id: me.tenant_id,
        email: me.email,
        role: me.role || selectPrimaryRole(me.roles, me.is_admin),
        permissions: me.permissions || [],
    };
}

interface AuthErrorShape {
    message: string;
    status: number;
    code?: string;
}

function toAuthError(error: unknown): AuthErrorShape {
    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    ) {
        const maybeStatus = (error as { status?: unknown }).status;
        const maybeCode = (error as { code?: unknown }).code;
        return {
            message: (error as { message: string }).message,
            status: typeof maybeStatus === 'number' ? maybeStatus : 500,
            code: typeof maybeCode === 'string' ? maybeCode : undefined,
        };
    }

    return {
        message: 'An error occurred',
        status: 500,
    };
}

const EMPTY_AUTH = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
};

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearAuth: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
            await iamLogin({ email, password });
            const me = await iamGetMe();
            set({
                user: mapIamUser(me),
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            set(EMPTY_AUTH);
            throw toAuthError(error);
        }
    },

    logout: async () => {
        try {
            await iamLogout();
        } catch {
            // best-effort; cookies will be cleared client-side on redirect anyway
        }
        set(EMPTY_AUTH);
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },

    checkAuth: async () => {
        try {
            const me = await iamGetMe();
            set({
                user: mapIamUser(me),
                isAuthenticated: true,
                isLoading: false,
            });
        } catch {
            set(EMPTY_AUTH);
        }
    },

    clearAuth: () => {
        set(EMPTY_AUTH);
    },

    setLoading: (loading: boolean) => {
        set({ isLoading: loading });
    },
}));

export function clearAuthState(): void {
    useAuthStore.getState().clearAuth();
}

export function useIsAdmin(): boolean {
    return useAuthStore((state) => state.user?.role?.toLowerCase() === 'admin');
}
