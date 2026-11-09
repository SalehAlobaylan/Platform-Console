import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/intelligence_/media-value')({
    beforeLoad: () => { throw redirect({ href: '/platform/intelligence' }); },
});
