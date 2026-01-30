import { useAuthStore } from '@/lib/stores/auth';

/**
 * Hook to access auth state and methods
 * Provides a convenient API for components to interact with authentication
 */
export function useAuth() {
    const user = useAuthStore((state) => state.user);
    const token = useAuthStore((state) => state.token);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);
    const login = useAuthStore((state) => state.login);
    const logout = useAuthStore((state) => state.logout);
    const checkAuth = useAuthStore((state) => state.checkAuth);

    return {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
    };
}
