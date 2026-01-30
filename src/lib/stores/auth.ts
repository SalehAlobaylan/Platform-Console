import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    token: string | null;
    user: {
        id: string;
        email: string;
        name: string;
    } | null;
    setToken: (token: string | null) => void;
    setUser: (user: AuthState['user']) => void;
    getToken: () => string | null;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            setToken: (token) => set({ token }),
            setUser: (user) => set({ user }),
            getToken: () => get().token,
            logout: () => set({ token: null, user: null }),
        }),
        {
            name: 'platform-console-auth',
        }
    )
);

// Helper function to get token outside of React components
export function getToken(): string | null {
    return useAuthStore.getState().token;
}
