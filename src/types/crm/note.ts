// Note types for CRM Module

export interface Note {
    id: string;
    content: string;
    customer_id?: string;
    customer?: {
        id: string;
        name: string;
    };
    deal_id?: string;
    deal?: {
        id: string;
        name: string;
    };
    author_id: string;
    author?: {
        id: string;
        name: string;
        email?: string;
    };
    created_at: string;
    updated_at: string;
}

// API request/response types
export interface ListNotesParams {
    page?: number;
    limit?: number;
    customer_id?: string;
    deal_id?: string;
}

export interface ListNotesResponse {
    data: Note[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateNoteRequest {
    content: string;
    customer_id?: string;
    deal_id?: string;
}

export interface UpdateNoteRequest {
    content?: string;
}
