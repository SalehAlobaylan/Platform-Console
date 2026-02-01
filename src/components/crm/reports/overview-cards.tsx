import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react';
import type { OverviewMetrics } from '@/types/crm';

interface OverviewCardsProps {
    metrics: OverviewMetrics;
    isLoading?: boolean;
}

export function OverviewCards({ metrics, isLoading }: OverviewCardsProps) {
    const cards = [
        {
            title: 'Total Customers',
            value: metrics.total_customers,
            icon: Users,
            color: 'text-blue-600',
        },
        {
            title: 'Active Deals',
            value: metrics.active_deals,
            icon: TrendingUp,
            color: 'text-green-600',
        },
        {
            title: 'Pipeline Value',
            value: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(metrics.pipeline_value),
            icon: DollarSign,
            color: 'text-purple-600',
        },
        {
            title: 'Activities This Week',
            value: metrics.activities_this_week,
            icon: Activity,
            color: 'text-orange-600',
        },
    ];

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className={`h-4 w-4 ${card.color}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
