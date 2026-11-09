import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/sources/[id]/page';

export const Route = createFileRoute('/_dashboard/platform_/sources_/$id')({
    component: Detail,
});

function Detail() {
    return <Page id={Route.useParams().id} />;
}
