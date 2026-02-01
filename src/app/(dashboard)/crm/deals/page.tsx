'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, Building2, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    useDeals,
    useDeleteDeal,
    useUpdateDealStage,
} from '@/hooks/use-deals';
import { useCustomers } from '@/hooks/use-customers';
import { DealForm } from '@/components/crm/deals/deal-form';
import { DealStageBadge } from '@/components/crm/deals/deal-stage-badge';
import type { Deal, DealStage } from '@/types/crm';

export default function DealsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editDeal, setEditDeal] = useState<Deal | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const limit = 10;
    const { data, isLoading, error } = useDeals({
        page,
        limit,
        search: search || undefined,
        stage: stageFilter === 'all' ? undefined : stageFilter as DealStage,
    });

    // Fetch customers for the form
    const { data: customersData } = useCustomers({ limit: 1000 });
    const customers = customersData?.data || [];

    const deleteMutation = useDeleteDeal();
    const updateStageMutation = useUpdateDealStage();

    const handleDelete = () => {
        if (deleteId) {
            deleteMutation.mutate(deleteId, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    const handleStageChange = (dealId: string, newStage: DealStage) => {
        updateStageMutation.mutate({ id: dealId, stage: newStage });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
                    <p className="text-muted-foreground">
                        Manage your sales pipeline
                    </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Deal
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by name..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
                <Select
                    value={stageFilter}
                    onValueChange={(value) => {
                        setStageFilter(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Probability</TableHead>
                            <TableHead>Expected Close</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-destructive py-8">
                                    Failed to load deals. Please try again.
                                </TableCell>
                            </TableRow>
                        ) : data?.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    No deals found. Create your first deal to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data.map((deal) => (
                                <TableRow key={deal.id}>
                                    <TableCell className="font-medium">{deal.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm">
                                            <Building2 className="h-3 w-3 text-muted-foreground" />
                                            {deal.customer?.name || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={deal.stage}
                                            onValueChange={(value) => handleStageChange(deal.id, value as DealStage)}
                                            disabled={updateStageMutation.isPending}
                                        >
                                            <SelectTrigger className="w-32 h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="lead">Lead</SelectItem>
                                                <SelectItem value="qualified">Qualified</SelectItem>
                                                <SelectItem value="proposal">Proposal</SelectItem>
                                                <SelectItem value="negotiation">Negotiation</SelectItem>
                                                <SelectItem value="won">Won</SelectItem>
                                                <SelectItem value="lost">Lost</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        {deal.amount ? (
                                            <div className="flex items-center gap-1 text-sm">
                                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                {deal.amount.toLocaleString()} {deal.currency}
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {deal.probability !== undefined ? `${deal.probability}%` : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {deal.expected_close_date
                                            ? new Date(deal.expected_close_date).toLocaleDateString()
                                            : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditDeal(deal)}
                                                title="Edit"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeleteId(deal.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
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
                        <DialogTitle>Delete Deal</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this deal? This action cannot be undone.
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

            {/* Create/Edit form */}
            <DealForm
                open={showCreateForm || !!editDeal}
                onClose={() => {
                    setShowCreateForm(false);
                    setEditDeal(null);
                }}
                onSubmit={() => {
                    setShowCreateForm(false);
                    setEditDeal(null);
                }}
                deal={editDeal || undefined}
                customers={customers}
                isSubmitting={false}
            />
        </div>
    );
}
