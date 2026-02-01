import { crmClient } from '@/lib/api/client';
import type {
    ReportsOverviewResponse,
} from '@/types/crm';

/**
 * Get overview metrics and reports
 * GET /admin/reports/overview
 */
export async function getReportsOverview(): Promise<ReportsOverviewResponse> {
    return crmClient.get<ReportsOverviewResponse>('/admin/reports/overview');
}
