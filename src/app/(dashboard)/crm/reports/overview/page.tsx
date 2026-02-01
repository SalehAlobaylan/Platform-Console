'use client';

import { useReportsOverview } from '@/hooks/use-reports';
import { OverviewCards } from '@/components/crm/reports/overview-cards';
import { DealsChart } from '@/components/crm/reports/deals-chart';
import { ActivitiesChart } from '@/components/crm/reports/activities-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsOverviewPage() {
    const { data: reports, isLoading, error } = useReportsOverview();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports Overview</h1>
                <p className="text-muted-foreground">
                    CRM performance metrics and analytics
                </p>
            </div>

            {error ? (
                <Card>
                    <CardContent className="py-12 text-center text-destructive">
                        Failed to load reports. Please try again.
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Overview Cards */}
                    <OverviewCards
                        metrics={reports?.metrics || {
                            total_customers: 0,
                            active_deals: 0,
                            pipeline_value: 0,
                            activities_this_week: 0,
                            customers_this_month: 0,
                            won_deals_this_month: 0,
                        }}
                        isLoading={isLoading}
                    />

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Deals by Stage Chart */}
                        <DealsChart
                            data={reports?.deals_by_stage || []}
                            isLoading={isLoading}
                        />

                        {/* Activities Over Time Chart */}
                        <ActivitiesChart
                            data={reports?.activities_over_time || []}
                            isLoading={isLoading}
                        />
                    </div>

                    {/* Top Performers (if available) */}
                    {reports?.top_performers && reports.top_performers.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Performers</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {reports.top_performers.map((performer) => (
                                        <div
                                            key={performer.id}
                                            className="flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="font-medium">{performer.name}</div>
                                                {performer.email && (
                                                    <div className="text-sm text-muted-foreground">
                                                        {performer.email}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium">
                                                    {performer.deals_closed} deals closed
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    ${performer.pipeline_value.toLocaleString()} pipeline
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
