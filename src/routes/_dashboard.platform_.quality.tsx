import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/quality')({
    beforeLoad: () => { throw redirect({ href: '/platform/storage?section=quality' }); },
});
