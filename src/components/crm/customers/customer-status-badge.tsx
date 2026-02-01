import { Badge } from '@/components/ui/badge';
import type { CustomerStatus } from '@/types/crm';
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from '@/types/crm';

interface CustomerStatusBadgeProps {
    status: CustomerStatus;
}

export function CustomerStatusBadge({ status }: CustomerStatusBadgeProps) {
    return (
        <Badge variant={CUSTOMER_STATUS_COLORS[status]}>
            {CUSTOMER_STATUS_LABELS[status]}
        </Badge>
    );
}
