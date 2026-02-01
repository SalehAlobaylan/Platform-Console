'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, CheckCircle, Building2, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useMyActivities,
    useDeleteActivity,
    useCompleteActivity,
} from '@/hooks/use-activities';
import { ActivityForm, ActivityTypeIcon } from '@/components/crm/activities';
import type { Activity, ActivityType } from '@/types/crm';
import { getActivityStatus, ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from '@/types/crm';

export default function MyTasksPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const limit = 10;
    const { data, isLoading, error } = useMyActivities({
        page,
        limit,
        search: search || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter as ActivityType,
    });

    const deleteMutation = useDeleteActivity();
    const completeMutation = useCompleteActivity();

    const handleDelete = () => {
        if (deleteId) {
            deleteMutation.mutate(deleteId, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    // Filter activities by status on the client side
    const filteredActivities = data?.data.filter(activity => {
        if (statusFilter === 'all') return true;
        const status = getActivityStatus(activity);
        return status === statusFilter;
    }) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
                    <p className="text-muted-foreground">
                        Manage your assigned tasks and activities
                    </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by subject..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
                <Select
                    value={typeFilter}
                    onValueChange={(value) => {
                        setTypeFilter(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                        setStatusFilter(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Related To</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-destructive py-8">
                                    Failed to load tasks. Please try again.
                                </TableCell>
                            </TableRow>
                        ) : filteredActivities.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    No tasks found. Create your first task to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredActivities.map((activity: Activity) => {
                                const status = getActivityStatus(activity);
                                return (
                                    <TableRow key={activity.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <ActivityTypeIcon type={activity.type} className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{activity.subject}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {activity.customer && (
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <Building2 className="h-3 w-3" />
                                                        {activity.customer.name}
                                                    </div>
                                                )}
                                                {activity.deal && (
                                                    <div className="text-muted-foreground ml-4">
                                                        Deal: {activity.deal.name}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {activity.due_at ? (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                                    {format(new Date(activity.due_at), 'PPp')}
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={status === 'completed' ? 'success' : status === 'overdue' ? 'destructive' : 'default'}>
                                                {ACTIVITY_STATUS_LABELS[status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {!activity.completed_at && activity.type === 'task' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => completeMutation.mutate(activity.id)}
                                                        disabled={completeMutation.isPending}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Complete
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteId(activity.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {data && data.total_pages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                            let pageNum;
                            if (data.total_pages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= data.total_pages - 2) {
                                pageNum = data.total_pages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <PaginationItem key={pageNum}>
                                    <PaginationLink
                                        onClick={() => setPage(pageNum)}
                                        isActive={pageNum === page}
                                        className="cursor-pointer"
                                    >
                                        {pageNum}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <PaginationNext
                                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                                className={page >= data.total_pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Activity</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this activity? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create form */}
            <ActivityForm
                open={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                onSubmit={() => setShowCreateForm(false)}
                isSubmitting={false}
            />
        </div>
    );
}
