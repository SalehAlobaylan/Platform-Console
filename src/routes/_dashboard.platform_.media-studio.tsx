import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/media-studio')({
    beforeLoad: () => { throw redirect({ href: '/platform/media/atomization?tab=studio' }); },
});
