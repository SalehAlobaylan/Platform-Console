// Activity types for CRM Module

export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note';
export type ActivityStatus = 'scheduled' | 'completed' | 'overdue';

export interface Activity {
    id: string;
    type: ActivityType;
    subject: string;
    description?: string;
    customer_id?: string;
    customer?: {
        id: string;
        name: string;
        email?: string;
        company?: string;
    };
    deal_id?: string;
    deal?: {
        id: string;
        name: string;
    };
    owner_id: string;
    owner?: {
        id: string;
        name: string;
        email?: string;
    };
    due_at?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

// Activity type display labels
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
    call: 'Call',
    email: 'Email',
    meeting: 'Meeting',
    task: 'Task',
    note: 'Note',
};

// Activity type icons (Lucide icon names)
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
    call: 'Phone',
    email: 'Mail',
    meeting: 'Users',
    task: 'CheckSquare',
    note: 'FileText',
};

// API request/response types
export interface ListActivitiesParams {
    page?: number;
    limit?: number;
    search?: string;
    type?: ActivityType;
    status?: ActivityStatus;
    customer_id?: string;
    deal_id?: string;
    owner_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface ListActivitiesResponse {
    data: Activity[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateActivityRequest {
    type: ActivityType;
    subject: string;
    description?: string;
    customer_id?: string;
    deal_id?: string;
    due_at?: string;
}

export interface UpdateActivityRequest {
    type?: ActivityType;
    subject?: string;
    description?: string;
    customer_id?: string;
    deal_id?: string;
    due_at?: string;
}

// Helper to compute activity status from due date and completion
export function getActivityStatus(activity: Pick<Activity, 'due_at' | 'completed_at'>): ActivityStatus {
    if (activity.completed_at) {
        return 'completed';
    }
    if (!activity.due_at) {
        return 'scheduled';
    }
    const dueDate = new Date(activity.due_at);
    const now = new Date();
    return dueDate < now ? 'overdue' : 'scheduled';
}

// Activity status display labels
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    overdue: 'Overdue',
};

// Activity status badge colors
export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, 'default' | 'success' | 'destructive'> = {
    scheduled: 'default',
    completed: 'success',
    overdue: 'destructive',
};
