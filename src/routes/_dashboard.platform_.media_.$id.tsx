import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/platform_/media_/$id')({
    beforeLoad: ({ params }) => {
        throw redirect({ href: `/platform/media/atomization?tab=studio&item=${encodeURIComponent(params.id)}` });
    },
});
