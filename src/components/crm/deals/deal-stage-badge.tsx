import { Badge } from '@/components/ui/badge';
import type { DealStage } from '@/types/crm';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/types/crm';

interface DealStageBadgeProps {
    stage: DealStage;
}

export function DealStageBadge({ stage }: DealStageBadgeProps) {
    return (
        <Badge className={DEAL_STAGE_COLORS[stage]}>
            {DEAL_STAGE_LABELS[stage]}
        </Badge>
    );
}
