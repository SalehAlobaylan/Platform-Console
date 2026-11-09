import { useLocation, useRouter as useTanStackRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

export function usePathname() {
    return useLocation({ select: (location) => location.pathname });
}

export function useSearchParams() {
    const search = useLocation({ select: (location) => location.searchStr });
    return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
    const router = useTanStackRouter();
    return useMemo(() => {
        function navigate(href: string, replace: boolean, scroll?: boolean) {
            const target = new URL(href, window.location.href);
            if (target.origin !== window.location.origin) return;
            void router.navigate({
                href: target.pathname + target.search + target.hash,
                replace,
                resetScroll: scroll,
                hashScrollIntoView: scroll,
            });
        }

        return {
            push: (href: string, options?: { scroll?: boolean }) => navigate(href, false, options?.scroll),
            replace: (href: string, options?: { scroll?: boolean; fromPath?: string }) => {
                // An effect from the previous screen can still run after a new
                // location has been committed to browser history.
                if (options?.fromPath && window.location.pathname !== options.fromPath) return;
                navigate(href, true, options?.scroll);
            },
        };
    }, [router]);
}
