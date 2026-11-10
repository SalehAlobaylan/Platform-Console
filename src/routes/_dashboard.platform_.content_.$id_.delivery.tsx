import { createFileRoute } from '@tanstack/react-router';
import { DeliveryTrace } from '@/components/platform/pipeline/delivery-trace';

export const Route = createFileRoute('/_dashboard/platform_/content_/$id_/delivery')({
    component: DeliveryRoute,
});

function DeliveryRoute() {
    return <DeliveryTrace id={Route.useParams().id} />;
}
