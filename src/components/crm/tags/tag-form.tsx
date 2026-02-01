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
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CreateTagRequest, UpdateTagRequest, Tag } from '@/types/crm';

const TAG_COLORS = [
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#6b7280', label: 'Gray' },
];

const tagSchema = z.object({
    name: z.string().min(1, 'Tag name is required'),
    color: z.string().min(1, 'Color is required'),
});

export type TagFormData = z.infer<typeof tagSchema>;

interface TagFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateTagRequest | UpdateTagRequest) => void;
    tag?: Tag;
    isSubmitting?: boolean;
}

export function TagForm({ open, onClose, onSubmit, tag, isSubmitting }: TagFormProps) {
    const form = useForm<TagFormData>({
        resolver: zodResolver(tagSchema),
        defaultValues: {
            name: tag?.name || '',
            color: tag?.color || '#3b82f6',
        },
    });

    const handleSubmit = (data: TagFormData) => {
        onSubmit(data);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{tag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
                    <DialogDescription>
                        {tag ? 'Update tag information below.' : 'Add a new tag for categorizing customers.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="VIP Customer" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color *</FormLabel>
                                    <div className="grid grid-cols-5 gap-2">
                                        {TAG_COLORS.map((color) => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                className={`h-10 rounded-md border-2 transition-all ${
                                                    field.value === color.value
                                                        ? 'border-foreground scale-105'
                                                        : 'border-transparent hover:scale-105'
                                                }`}
                                                style={{ backgroundColor: color.value }}
                                                onClick={() => field.onChange(color.value)}
                                                title={color.label}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : tag ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                                </form>
            </DialogContent>
        </Dialog>
    );
}
