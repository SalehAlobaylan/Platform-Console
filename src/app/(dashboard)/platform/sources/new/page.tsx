'use client';

import { useRouter, useSearchParams } from '@/lib/navigation';
import Link from '@/lib/console-link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SourceWizard } from '@/components/platform/sources/wizard/source-wizard';
import { useCreateSource } from '@/hooks/use-sources';
import type { CreateSourceRequest, SourceCategory } from '@/types/platform/source';

const DASHBOARD = '/platform/sources';

export default function NewSourcePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const createMutation = useCreateSource();

    // Context: which surface opened the wizard. `category` forces the new source
    // into that hub (so a Telegram channel added from Media Sources is media,
    // not the type-default news); `from` is where to return on success.
    const categoryParam = searchParams.get('category');
    const category: SourceCategory | undefined =
        categoryParam === 'media' || categoryParam === 'news' ? categoryParam : undefined;
    const from = searchParams.get('from') || DASHBOARD;

    const handleSubmit = (data: CreateSourceRequest) => {
        // Telegram is dual — it shows on the Media gallery regardless of category
        // (which filters by type too), so don't force it to `media` and strip it
        // from Feeds Finding. Let it keep its default (news) and feed both hubs.
        const effectiveCategory = data.type === 'TELEGRAM' ? undefined : category;
        createMutation.mutate(
            { ...data, ...(effectiveCategory ? { category: effectiveCategory } : {}) },
            {
                onSuccess: () => {
                    router.push(from);
                },
            }
        );
    };

    const isMedia = category === 'media';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" render={<Link href={from}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>} />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isMedia ? 'Add Media Source' : 'Create Source'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isMedia
                            ? 'Add a video, podcast, or Telegram source to the Pods pipeline'
                            : 'Add a new content ingestion source'}
                    </p>
                </div>
            </div>

            {/* Wizard */}
            <div className="max-w-4xl">
                <SourceWizard
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </div>
    );
}
