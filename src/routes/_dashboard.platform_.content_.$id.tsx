import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/content/[id]/page';

export const Route = createFileRoute('/_dashboard/platform_/content_/$id')({
    component: Detail,
});

function Detail() {
    return <Page id={Route.useParams().id} />;
}
