import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/feed-recovery')({
    beforeLoad: () => { throw redirect({ href: '/platform/recovery?view=feed-recovery' }); },
});
