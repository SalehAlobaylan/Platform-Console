// Deal types for CRM Module

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Deal {
    id: string;
    name: string;
    customer_id: string;
    customer?: {
        id: string;
        name: string;
        email?: string;
        company?: string;
    };
    stage: DealStage;
    amount?: number;
    currency: string;
    probability?: number;
    expected_close_date?: string;
    owner_id?: string;
    created_at: string;
    updated_at: string;
}

// Deal stages configuration
export const DEAL_STAGES: Array<{
    id: DealStage;
    label: string;
    color: string;
    order: number;
}> = [
    { id: 'lead', label: 'Lead', color: 'gray', order: 0 },
    { id: 'qualified', label: 'Qualified', color: 'blue', order: 1 },
    { id: 'proposal', label: 'Proposal', color: 'yellow', order: 2 },
    { id: 'negotiation', label: 'Negotiation', color: 'orange', order: 3 },
    { id: 'won', label: 'Won', color: 'green', order: 4 },
    { id: 'lost', label: 'Lost', color: 'red', order: 5 },
];

// API request/response types
export interface ListDealsParams {
    page?: number;
    limit?: number;
    search?: string;
    stage?: DealStage;
    owner_id?: string;
    customer_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface ListDealsResponse {
    data: Deal[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateDealRequest {
    name: string;
    customer_id: string;
    stage?: DealStage;
    amount?: number;
    currency?: string;
    probability?: number;
    expected_close_date?: string;
    owner_id?: string;
}

export interface UpdateDealRequest {
    name?: string;
    customer_id?: string;
    stage?: DealStage;
    amount?: number;
    currency?: string;
    probability?: number;
    expected_close_date?: string;
    owner_id?: string;
}

export interface UpdateDealStageRequest {
    stage: DealStage;
}

// Deal stage display labels
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
    lead: 'Lead',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    won: 'Won',
    lost: 'Lost',
};

// Deal stage badge colors
export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
    lead: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    proposal: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
