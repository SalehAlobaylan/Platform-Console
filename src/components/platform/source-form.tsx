'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentSource, SourceType } from '@/types/platform/source';
import { SOURCE_TYPE_LABELS } from '@/types/platform/source';

const sourceSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['RSS', 'PODCAST', 'YOUTUBE', 'TWITTER', 'REDDIT', 'MANUAL'] as const),
    feed_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    fetch_interval_minutes: z.coerce.number().min(1, 'Minimum 1 minute'),
    is_active: z.boolean(),
});

type SourceFormData = z.infer<typeof sourceSchema>;

interface SourceFormProps {
    source?: ContentSource;
    onSubmit: (data: SourceFormData) => void;
    isLoading?: boolean;
}

export function SourceForm({ source, onSubmit, isLoading }: SourceFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<SourceFormData>({
        resolver: zodResolver(sourceSchema),
        defaultValues: {
            name: source?.name || '',
            type: source?.type || 'RSS',
            feed_url: source?.feed_url || '',
            fetch_interval_minutes: source?.fetch_interval_minutes || 60,
            is_active: source?.is_active ?? true,
        },
    });

    const selectedType = watch('type');
    const isActive = watch('is_active');

    const showFeedUrl = ['RSS', 'PODCAST', 'YOUTUBE'].includes(selectedType);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Source Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="My RSS Feed"
                                {...register('name')}
                                disabled={isLoading}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                                value={selectedType}
                                onValueChange={(value) => setValue('type', value as SourceType)}
                                disabled={isLoading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.type && (
                                <p className="text-sm text-destructive">{errors.type.message}</p>
                            )}
                        </div>
                    </div>

                    {showFeedUrl && (
                        <div className="space-y-2">
                            <Label htmlFor="feed_url">Feed URL</Label>
                            <Input
                                id="feed_url"
                                type="url"
                                placeholder="https://example.com/feed.xml"
                                {...register('feed_url')}
                                disabled={isLoading}
                            />
                            {errors.feed_url && (
                                <p className="text-sm text-destructive">{errors.feed_url.message}</p>
                            )}
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="fetch_interval_minutes">Fetch Interval (minutes)</Label>
                            <Input
                                id="fetch_interval_minutes"
                                type="number"
                                min={1}
                                {...register('fetch_interval_minutes')}
                                disabled={isLoading}
                            />
                            {errors.fetch_interval_minutes && (
                                <p className="text-sm text-destructive">
                                    {errors.fetch_interval_minutes.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <div className="flex items-center gap-4 pt-2">
                                <Button
                                    type="button"
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setValue('is_active', true)}
                                    disabled={isLoading}
                                >
                                    Active
                                </Button>
                                <Button
                                    type="button"
                                    variant={!isActive ? 'destructive' : 'outline'}
                                    size="sm"
                                    onClick={() => setValue('is_active', false)}
                                    disabled={isLoading}
                                >
                                    Disabled
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : source ? (
                        'Update Source'
                    ) : (
                        'Create Source'
                    )}
                </Button>
            </div>
        </form>
    );
}
