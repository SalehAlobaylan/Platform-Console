// Reports types for CRM Module

export interface OverviewMetrics {
    total_customers: number;
    active_deals: number;
    pipeline_value: number;
    activities_this_week: number;
    customers_this_month: number;
    won_deals_this_month: number;
}

export interface DealStageSummary {
    stage: string;
    count: number;
    value: number;
}

export interface ActivityTimeline {
    date: string;
    count: number;
    breakdown: {
        call: number;
        email: number;
        meeting: number;
        task: number;
        note: number;
    };
}

export interface TopPerformer {
    id: string;
    name: string;
    email?: string;
    deals_closed: number;
    pipeline_value: number;
}

export interface ReportsOverviewResponse {
    metrics: OverviewMetrics;
    deals_by_stage: DealStageSummary[];
    activities_over_time: ActivityTimeline[];
    top_performers?: TopPerformer[];
}
