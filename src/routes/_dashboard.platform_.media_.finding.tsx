import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/media_/finding')({
    beforeLoad: () => { throw redirect({ href: '/platform/media/sources?tab=finding' }); },
});
