import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@/app/globals.css';
import { Providers } from '@/app/providers';
import GlobalError from '@/app/error';
import NotFound from '@/app/not-found';
import { localQuickSignInCredentials } from '@/lib/server/local-quick-sign-in';

const readPublicRuntime = createServerFn().handler(() => {
    const runtimeId = process.env.WAHB_RUNTIME_ID ?? '';
    if (process.env.WAHB_MANAGED_ENV === '1' && !runtimeId) {
        throw new Error('Console launch configuration is missing');
    }
    return {
        runtimeId,
        environmentId: process.env.WAHB_ENVIRONMENT_ID ?? '',
        grafanaUrl: process.env.GRAFANA_URL ?? process.env.NEXT_PUBLIC_GRAFANA_URL ?? '',
        localQuickSignIn: Boolean(localQuickSignInCredentials(getRequest())),
    };
});

export const Route = createRootRoute({
    loader: () => readPublicRuntime(),
    staleTime: Infinity,
    head: ({ loaderData }) => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'Platform Console' },
            { name: 'description', content: 'Wahb Platform Admin Console' },
            { name: 'wahb-runtime-id', content: loaderData?.runtimeId ?? '' },
            { name: 'wahb-environment-id', content: loaderData?.environmentId ?? '' },
            { name: 'wahb-grafana-url', content: loaderData?.grafanaUrl ?? '' },
        ],
        links: [
            { rel: 'icon', href: '/images/wahb_mark_transparent.png', media: '(prefers-color-scheme: light)' },
            { rel: 'icon', href: '/images/wahb_mark_transparent_dark.png', media: '(prefers-color-scheme: dark)' },
            { rel: 'apple-touch-icon', href: '/images/wahb_favicon_white_bg.png' },
        ],
    }),
    component: () => <Providers><Outlet /></Providers>,
    shellComponent: Document,
    errorComponent: ({ error, reset }) => <GlobalError error={error instanceof Error ? error : new Error(String(error))} reset={reset} />,
    notFoundComponent: NotFound,
});

function Document({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head><HeadContent /></head>
            <body style={{ fontFamily: "'Inter Variable', sans-serif" }}>
                {children}
                <Scripts />
            </body>
        </html>
    );
}
