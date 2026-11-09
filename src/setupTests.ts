import '@testing-library/jest-dom';

jest.mock('@/lib/console-link', () => {
    const { createElement, forwardRef } = jest.requireActual<typeof import('react')>('react');
    return {
        __esModule: true,
        default: forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<'a'> & { scroll?: boolean }>(
            function TestLink({ scroll: _scroll, ...props }, ref) {
                return createElement('a', { ...props, ref });
            }
        ),
    };
});

jest.mock('@/lib/navigation', () => {
    const { useMemo } = jest.requireActual<typeof import('react')>('react');
    const router = {
        push: (href: string) => window.history.pushState(window.history.state, '', href),
        replace: (href: string) => window.history.replaceState(window.history.state, '', href),
    };
    return {
        usePathname: () => window.location.pathname,
        useSearchParams: () => {
            const search = window.location.search;
            return useMemo(() => new URLSearchParams(search), [search]);
        },
        useRouter: () => router,
    };
});
