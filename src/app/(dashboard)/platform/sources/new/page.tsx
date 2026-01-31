'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SourceForm } from '@/components/platform/source-form';
import { useCreateSource } from '@/hooks/use-sources';
import type { CreateSourceRequest } from '@/types/platform/source';

export default function NewSourcePage() {
    const router = useRouter();
    const createMutation = useCreateSource();

    const handleSubmit = (data: CreateSourceRequest) => {
        createMutation.mutate(data, {
            onSuccess: () => {
                router.push('/platform/sources');
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/platform/sources">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create Source</h1>
                    <p className="text-muted-foreground">
                        Add a new content ingestion source
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-2xl">
                <SourceForm
                    onSubmit={handleSubmit}
                    isLoading={createMutation.isPending}
                />
            </div>
        </div>
    );
}
