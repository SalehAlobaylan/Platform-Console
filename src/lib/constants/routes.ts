import {
    Database,
    FileText,
    Users,
    TrendingUp,
    Calendar,
    CheckSquare,
    Tag,
    BarChart,
    type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
    name: string;
    href: string;
    icon: LucideIcon;
}

export interface NavigationSection {
    title: string;
    items: NavigationItem[];
}

export const navigation: NavigationSection[] = [
    {
        title: 'Platform',
        items: [
            { name: 'Sources', href: '/platform/sources', icon: Database },
            { name: 'Content', href: '/platform/content', icon: FileText },
        ],
    },
    {
        title: 'CRM',
        items: [
            { name: 'Customers', href: '/crm/customers', icon: Users },
            { name: 'Deals', href: '/crm/deals', icon: TrendingUp },
            { name: 'Activities', href: '/crm/activities', icon: Calendar },
            { name: 'My Tasks', href: '/crm/my-tasks', icon: CheckSquare },
            { name: 'Tags', href: '/crm/tags', icon: Tag },
            { name: 'Reports', href: '/crm/reports/overview', icon: BarChart },
        ],
    },
];

// Route constants for type-safe navigation
export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/',
    PLATFORM: {
        SOURCES: '/platform/sources',
        CONTENT: '/platform/content',
    },
    CRM: {
        CUSTOMERS: '/crm/customers',
        DEALS: '/crm/deals',
        ACTIVITIES: '/crm/activities',
        MY_TASKS: '/crm/my-tasks',
        TAGS: '/crm/tags',
        REPORTS: '/crm/reports/overview',
    },
} as const;
