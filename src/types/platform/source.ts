// Content Source types for Platform Module

export type SourceType = 'RSS' | 'PODCAST' | 'YOUTUBE' | 'TWITTER' | 'REDDIT' | 'MANUAL';

export interface ContentSource {
    id: string;
    name: string;
    type: SourceType;
    feed_url?: string;
    api_config?: Record<string, unknown>;
    is_active: boolean;
    fetch_interval_minutes: number;
    last_fetched_at?: string;
    created_at: string;
    updated_at: string;
}

// API request/response types
export interface ListSourcesParams {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    type?: SourceType;
}

export interface ListSourcesResponse {
    data: ContentSource[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateSourceRequest {
    name: string;
    type: SourceType;
    feed_url?: string;
    api_config?: Record<string, unknown>;
    is_active?: boolean;
    fetch_interval_minutes?: number;
}

export interface UpdateSourceRequest {
    name?: string;
    type?: SourceType;
    feed_url?: string;
    api_config?: Record<string, unknown>;
    is_active?: boolean;
    fetch_interval_minutes?: number;
}

export interface RunSourceResponse {
    message: string;
    job_id?: string;
}

// Source type display labels
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
    RSS: 'RSS Feed',
    PODCAST: 'Podcast',
    YOUTUBE: 'YouTube',
    TWITTER: 'Twitter/X',
    REDDIT: 'Reddit',
    MANUAL: 'Manual',
};
