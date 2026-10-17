// Storage Operations / Free-Tier Tracking — types matching CMS responses.

export type OpClass = 'A' | 'B' | 'F' | 'U';
export type OpClassStatus = 'ok' | 'warn' | 'cap';
export type OpType =
    | 'PUT'
    | 'GET'
    | 'HEAD'
    | 'DELETE'
    | 'DELETE_OBJECTS'
    | 'LIST'
    | 'COPY'
    | 'OTHER';
export type OpSource = 'internal' | 'cloudflare' | 'cloudflare_legacy';

export interface OpClassSummary {
    used: number;
    budget: number;
    remaining: number;
    pct: number;
    status: OpClassStatus;
    warn_pct: number;
    cap_pct: number;
    /** ISO date — projected day this month when budget will be exhausted at current rate. */
    projected_to_exceed_at?: string;
}

export interface OpDailyPoint {
    /** YYYY-MM-DD */
    date: string;
    class_a: number;
    class_b: number;
}

export interface OpTypeBreakdownEntry {
    op_type: OpType;
    op_class: OpClass;
    count: number;
    pct_of_class: number;
}

export interface OpSourceBreakdownEntry {
    source: OpSource;
    count: number;
}

export interface StorageOperationsResponse {
    /** YYYY-MM */
    month: string;
    class_a: OpClassSummary;
    class_b: OpClassSummary;
    daily: OpDailyPoint[];
    by_op_type: OpTypeBreakdownEntry[];
    by_source: OpSourceBreakdownEntry[];
    generated_at: string;
}
