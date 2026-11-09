'use client';

import { useRouter, useSearchParams } from '@/lib/navigation';
import Link from '@/lib/console-link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SourceWizard } from '@/components/platform/sources/wizard/source-wizard';
import { useCreateSource } from '@/hooks/use-sources';
import type { CreateSourceRequest, SourceType } from '@/types/platform/source';

const MEDIA_TYPES: SourceType[] = ['YOUTUBE', 'PODCAST', 'TELEGRAM'];
const DEFAULT_RETURN = '/platform/media/sources';

/**
 * Add Media Source — a media-only flow (YouTube, podcast, Telegram audio/video)
 * with podcast search, channel resolve, and rich media preview.
 */
export default function NewMediaSourcePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const createMutation = useCreateSource();
    const from = searchParams.get('from') || DEFAULT_RETURN;

    const handleSubmit = (data: CreateSourceRequest) => {
        // YouTube/Podcast → media. Telegram is dual: leave it as default (news) so
        // it stays in Feeds Finding while still showing on the Media gallery via
        // its media kinds.
        const category = data.type === 'TELEGRAM' ? undefined : 'media';
        createMutation.mutate(
            { ...data, ...(category ? { category } : {}) },
            { onSuccess: () => router.push(from) }
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={from}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <span className="brand-overline text-gold">Pods</span>
                    <h1 className="text-3xl font-bold tracking-tight">Add Media Source</h1>
                    <p className="text-muted-foreground">
                        Add a YouTube channel, podcast, or Telegram channel to the Pods pipeline.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl">
                <SourceWizard
                    allowedTypes={MEDIA_TYPES}
                    mediaDefaults
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </div>
    );
}
