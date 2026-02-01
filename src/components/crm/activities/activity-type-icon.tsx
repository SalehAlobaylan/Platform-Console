import { Phone, Mail, Users, CheckSquare, FileText } from 'lucide-react';
import type { ActivityType } from '@/types/crm';
import { ACTIVITY_TYPE_ICONS } from '@/types/crm';

const icons = {
    Phone,
    Mail,
    Users,
    CheckSquare,
    FileText,
};

interface ActivityTypeIconProps {
    type: ActivityType;
    className?: string;
}

export function ActivityTypeIcon({ type, className }: ActivityTypeIconProps) {
    const Icon = icons[ACTIVITY_TYPE_ICONS[type] as keyof typeof icons];

    if (!Icon) {
        return null;
    }

    return <Icon className={className} />;
}
