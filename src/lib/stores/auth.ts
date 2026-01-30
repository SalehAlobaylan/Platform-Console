import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as apiLogin, getMe } from '@/lib/api/cms/auth';
import type { User } from '@/lib/api/cms/types';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    clearAuth: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true, // Start as loading until checkAuth completes

            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await apiLogin({ email, password });
                    set({
                        token: response.token,
                        user: {
                            id: response.user.id,
                            email: response.user.email,
                            role: response.user.role,
                        },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
                // Redirect to login page
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            },

            checkAuth: async () => {
                const { token } = get();

                if (!token) {
                    set({ isLoading: false, isAuthenticated: false });
                    return;
                }

                try {
                    const user = await getMe();
                    set({
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role,
                            permissions: user.permissions,
                        },
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch {
                    // Token is invalid or expired - clear auth state
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            // Clear auth without redirect (used by 401 handler)
            clearAuth: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            },

            setLoading: (loading: boolean) => {
                set({ isLoading: loading });
            },
        }),
        {
            name: 'platform-console-auth',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
            }),
        }
    )
);

// Helper function to get token outside of React components
export function getToken(): string | null {
    return useAuthStore.getState().token;
}

// Helper function to clear auth from outside React (used by API client)
export function clearAuthState(): void {
    useAuthStore.getState().clearAuth();
}
