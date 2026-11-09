import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router';
import AuthLayout from '@/app/(auth)/layout';
import LoginPage from '@/app/(auth)/login/page';
import { safeReturnTo } from '@/lib/sign-in-destination';

const rootRoute = getRouteApi('__root__');

type LoginSearch = { returnTo?: string; reason?: 'runtime_changed' | 'password_reset' };

export const Route = createFileRoute('/login')({
    validateSearch: (search: Record<string, unknown>): LoginSearch => ({
        returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
        reason: search.reason === 'runtime_changed' || search.reason === 'password_reset' ? search.reason : undefined,
    }),
    component: ConsoleLogin,
});

function ConsoleLogin() {
    const { localQuickSignIn } = rootRoute.useLoaderData();
    const { returnTo, reason } = Route.useSearch();
    const router = useRouter();
    const destination = safeReturnTo(returnTo, (pathname) => {
        const matches = router.matchRoutes(pathname, {});
        return matches.some((match) => match.routeId === '/_dashboard') &&
            matches.every((match) => !('globalNotFound' in match && match.globalNotFound) && match.status !== 'notFound');
    });
    return <AuthLayout><LoginPage localQuickSignIn={localQuickSignIn}
        returnTo={destination} reason={reason} /></AuthLayout>;
}
