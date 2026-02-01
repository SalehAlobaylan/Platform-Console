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
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CreateNoteRequest } from '@/types/crm';

const noteSchema = z.object({
    content: z.string().min(1, 'Note content is required'),
    customer_id: z.string().optional(),
    deal_id: z.string().optional(),
});

export type NoteFormData = z.infer<typeof noteSchema>;

interface NoteFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateNoteRequest) => void;
    customerId?: string;
    dealId?: string;
    isSubmitting?: boolean;
}

export function NoteForm({ open, onClose, onSubmit, customerId, dealId, isSubmitting }: NoteFormProps) {
    const form = useForm<NoteFormData>({
        resolver: zodResolver(noteSchema),
        defaultValues: {
            content: '',
            customer_id: customerId || '',
            deal_id: dealId || '',
        },
    });

    const handleSubmit = (data: NoteFormData) => {
        const submitData: CreateNoteRequest = {
            content: data.content,
            customer_id: customerId || data.customer_id,
            deal_id: dealId || data.deal_id,
        };
        onSubmit(submitData);
        form.reset();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                    <DialogDescription>
                        Add a new note to provide context or updates.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Note *</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter your note here..."
                                            className="resize-none"
                                            rows={5}
                                            {...field}
                                        />
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
                                {isSubmitting ? 'Saving...' : 'Add Note'}
                            </Button>
                        </DialogFooter>
                    </form>
                                </form>
            </DialogContent>
        </Dialog>
    );
}
