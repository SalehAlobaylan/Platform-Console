import { create } from 'zustand';
import { login as iamLogin, logout as iamLogout } from '@/lib/api/iam/auth';
import { notifySessionChange, recoverSession, withSessionLock } from '@/lib/auth-session';
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
    name?: string;
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
        const maybeName = (error as { name?: unknown }).name;
        return {
            message: (error as { message: string }).message,
            status: typeof maybeStatus === 'number' ? maybeStatus : 500,
            code: typeof maybeCode === 'string' ? maybeCode : undefined,
            name: typeof maybeName === 'string' ? maybeName : undefined,
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
    sessionIssue: null,
} as const;

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    sessionIssue: 'unavailable' | 'runtime_changed' | null;
    login: (email: string, password: string) => Promise<void>;
    quickSignIn: () => Promise<void>;
    completeSignIn: (authenticate: () => Promise<IamMeResponse>) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearAuth: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => {
    let authVersion = 0;
    let changingSession = false;

    async function signIn(authenticate: () => Promise<IamMeResponse>) {
        if (changingSession) return;
        changingSession = true;
        ++authVersion;
        set({ isLoading: true, sessionIssue: null });
        try {
            const profile = await authenticate();
            set({ user: mapIamUser(profile), isAuthenticated: true, isLoading: false, sessionIssue: null });
            notifySessionChange('login');
        } catch (error) {
            set(EMPTY_AUTH);
            throw toAuthError(error);
        } finally {
            changingSession = false;
        }
    }

    return {
        ...EMPTY_AUTH,
        isLoading: true,
        login: (email, password) => signIn(() => withSessionLock(() => iamLogin({ email, password }))),
        quickSignIn: () => signIn(() => withSessionLock(() => iamLogin({ mode: 'local-quick-sign-in' }))),
        completeSignIn: signIn,
        logout: async () => {
            if (changingSession) return;
            changingSession = true;
            ++authVersion;
            try {
                await withSessionLock(iamLogout);
                set(EMPTY_AUTH);
                notifySessionChange('logout');
                if (typeof window !== 'undefined') window.location.replace('/login');
            } finally {
                changingSession = false;
            }
        },

        checkAuth: async () => {
            if (changingSession) return;
            const version = ++authVersion;
            const result = await recoverSession();
            if (version !== authVersion) return;
            if (result.state === 'valid') {
                set({ user: mapIamUser(result.profile), isAuthenticated: true, isLoading: false, sessionIssue: null });
            } else if (result.state === 'unavailable') {
                set({ isLoading: false, sessionIssue: result.state });
            } else {
                set({ ...EMPTY_AUTH, sessionIssue: result.state === 'runtime_changed' ? result.state : null });
            }
        },

        clearAuth: () => {
            ++authVersion;
            set(EMPTY_AUTH);
        },

        setLoading: (loading: boolean) => {
            set({ isLoading: loading });
        },
    };
});

export function clearAuthState(): void {
    useAuthStore.getState().clearAuth();
}

export function useIsAdmin(): boolean {
    return useAuthStore((state) => state.user?.role?.toLowerCase() === 'admin');
}
