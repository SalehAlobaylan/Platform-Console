import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/intelligence_/ranking')({
    beforeLoad: () => { throw redirect({ href: '/platform/intelligence' }); },
});
