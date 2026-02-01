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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CreateActivityRequest, UpdateActivityRequest, Activity } from '@/types/crm';

const activitySchema = z.object({
    type: z.enum(['call', 'email', 'meeting', 'task', 'note']),
    subject: z.string().min(1, 'Subject is required'),
    description: z.string().optional(),
    customer_id: z.string().optional(),
    deal_id: z.string().optional(),
    due_at: z.string().optional(),
});

export type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateActivityRequest | UpdateActivityRequest) => void;
    activity?: Activity;
    customers?: Array<{ id: string; name: string }>;
    deals?: Array<{ id: string; name: string }>;
    isSubmitting?: boolean;
}

export function ActivityForm({ open, onClose, onSubmit, activity, customers, deals, isSubmitting }: ActivityFormProps) {
    const form = useForm<ActivityFormData>({
        resolver: zodResolver(activitySchema),
        defaultValues: {
            type: activity?.type || 'task',
            subject: activity?.subject || '',
            description: activity?.description || '',
            customer_id: activity?.customer_id || '',
            deal_id: activity?.deal_id || '',
            due_at: activity?.due_at ? new Date(activity.due_at).toISOString().slice(0, 16) : '',
        },
    });

    const handleSubmit = (data: ActivityFormData) => {
        const submitData: CreateActivityRequest | UpdateActivityRequest = {
            ...data,
            customer_id: data.customer_id || undefined,
            deal_id: data.deal_id || undefined,
            due_at: data.due_at || undefined,
        };
        onSubmit(submitData);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{activity ? 'Edit Activity' : 'Create Activity'}</DialogTitle>
                    <DialogDescription>
                        {activity ? 'Update activity information below.' : 'Add a new activity to your CRM.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="call">Call</SelectItem>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="meeting">Meeting</SelectItem>
                                            <SelectItem value="task">Task</SelectItem>
                                            <SelectItem value="note">Note</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Follow up call" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Activity details..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
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
                                    <FormLabel>Customer</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select customer (optional)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {customers?.map((customer) => (
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
                            name="deal_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Deal</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select deal (optional)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {deals?.map((deal) => (
                                                <SelectItem key={deal.id} value={deal.id}>
                                                    {deal.name}
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
                            name="due_at"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Due Date & Time</FormLabel>
                                    <FormControl>
                                        <Input type="datetime-local" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : activity ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
            </DialogContent>
        </Dialog>
    );
}
