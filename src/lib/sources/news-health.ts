import type { NewsSource } from '@/types/platform/discovery';

export type NewsHealthStatus = 'live' | 'stale' | 'new' | 'unknown';

export interface NewsHealth {
    status: NewsHealthStatus;
    label: string;
    variant: 'success' | 'warning' | 'secondary' | 'outline';
}

// Provider evidence is independent of roster inclusion and item publication dates.
export function newsSourceHealth(s: Pick<NewsSource, 'last_attempted_at' | 'last_provider_success_at' | 'failure_streak' | 'intake_circuit_until'>): NewsHealth {
    if ((s.failure_streak ?? 0) > 0 || (s.intake_circuit_until && new Date(s.intake_circuit_until).getTime() > Date.now())) return { status: 'stale', label: 'Needs attention', variant: 'warning' };
    if (s.last_provider_success_at) return { status: 'live', label: 'Last check succeeded', variant: 'success' };
    if (s.last_attempted_at) return { status: 'unknown', label: 'Result unavailable', variant: 'outline' };
    return { status: 'new', label: 'Never checked', variant: 'outline' };
}
export const NEWS_HEALTH_ORDER: NewsHealthStatus[] = ['live', 'stale', 'new', 'unknown'];
export const NEWS_HEALTH_LABELS: Record<NewsHealthStatus, string> = { live: 'Last check succeeded', stale: 'Needs attention', new: 'Never checked', unknown: 'Result unavailable' };

/** Hostname without `www.`, for the source subtitle. */
export function domainOf(url?: string): string {
    if (!url) return '';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}
