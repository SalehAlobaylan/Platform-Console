'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CreateDealRequest, UpdateDealRequest, Deal } from '@/types/crm';

const dealSchema = z.object({
    name: z.string().min(1, 'Deal name is required'),
    customer_id: z.string().min(1, 'Customer is required'),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
    amount: z.string().optional(),
    currency: z.string().optional(),
    probability: z.string().optional(),
    expected_close_date: z.string().optional(),
});

export type DealFormData = z.infer<typeof dealSchema>;

interface DealFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateDealRequest | UpdateDealRequest) => void;
    deal?: Deal;
    customers: Array<{ id: string; name: string }>;
    isSubmitting?: boolean;
}

export function DealForm({ open, onClose, onSubmit, deal, customers, isSubmitting }: DealFormProps) {
    const form = useForm<DealFormData>({
        resolver: zodResolver(dealSchema),
        defaultValues: {
            name: deal?.name || '',
            customer_id: deal?.customer_id || '',
            stage: deal?.stage || 'lead',
            amount: deal?.amount ? deal.amount.toString() : '',
            currency: deal?.currency || 'USD',
            probability: deal?.probability ? deal.probability.toString() : '',
            expected_close_date: deal?.expected_close_date ? new Date(deal.expected_close_date).toISOString().split('T')[0] : '',
        },
    });

    const handleSubmit = (data: DealFormData) => {
        const submitData: CreateDealRequest | UpdateDealRequest = {
            ...data,
            amount: data.amount ? parseFloat(data.amount) : undefined,
            probability: data.probability ? parseInt(data.probability) : undefined,
            expected_close_date: data.expected_close_date || undefined,
        };
        onSubmit(submitData);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{deal ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
                    <DialogDescription>
                        {deal ? 'Update deal information below.' : 'Add a new deal to your pipeline.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Deal Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enterprise Software Deal" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="customer_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select customer" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {customers.map((customer) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="stage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Stage</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select stage" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="lead">Lead</SelectItem>
                                            <SelectItem value="qualified">Qualified</SelectItem>
                                            <SelectItem value="proposal">Proposal</SelectItem>
                                            <SelectItem value="negotiation">Negotiation</SelectItem>
                                            <SelectItem value="won">Won</SelectItem>
                                            <SelectItem value="lost">Lost</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="10000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="EUR">EUR</SelectItem>
                                                <SelectItem value="GBP">GBP</SelectItem>
                                                <SelectItem value="SAR">SAR</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="probability"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Probability (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="0" max="100" placeholder="50" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="expected_close_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expected Close</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : deal ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                                </form>
            </DialogContent>
        </Dialog>
    );
}
