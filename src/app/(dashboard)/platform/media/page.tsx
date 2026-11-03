'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Video, Mic, Clapperboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SttSettingsCard } from '@/components/platform/media/stt-settings-card';
import { PodsPipelineControl } from '@/components/platform/media/pods-pipeline-control';
import { MediaList } from '@/components/platform/media/media-list';
import { cn } from '@/lib/utils';
import type { ContentType } from '@/types/platform/content';

/**
 * Media Library — manages the Pods audio/video corpus: caption-first transcripts,
 * caption-state badges, and on-demand STT upgrades.
 */
export default function MediaPage() {
    // Deep-link preset (e.g. Content distribution cards): ?type=PODCAST.
    const searchParams = useSearchParams();
    const typeParam = searchParams.get('type');
    const [type, setType] = useState<ContentType>(typeParam === 'PODCAST' ? 'PODCAST' : 'VIDEO');

    useEffect(() => {
        setType(typeParam === 'PODCAST' ? 'PODCAST' : 'VIDEO');
    }, [typeParam]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <span className="brand-overline text-gold">Pods</span>
                    <h1 className="text-2xl font-semibold">Media Library</h1>
                    <p className="text-sm text-muted-foreground">
                        Browse, filter, and manage video and podcast items. Keep captions first, then
                        use STT batches for weak or missing transcripts.
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/platform/media/atomization?tab=studio">
                        <Clapperboard className="mr-2 h-4 w-4" /> Open Studio
                    </Link>
                </Button>
            </div>

            <PodsPipelineControl compact />
            <div className="max-w-3xl">
                <SttSettingsCard />
            </div>

            {/* Type toggle — gold active state, the Pods accent */}
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant={type === 'VIDEO' ? 'default' : 'outline'}
                    className={cn(type === 'VIDEO' && 'bg-gold text-gold-foreground hover:bg-gold/90')}
                    onClick={() => setType('VIDEO')}
                >
                    <Video className="mr-1.5 h-4 w-4" /> Video
                </Button>
                <Button
                    size="sm"
                    variant={type === 'PODCAST' ? 'default' : 'outline'}
                    className={cn(type === 'PODCAST' && 'bg-gold text-gold-foreground hover:bg-gold/90')}
                    onClick={() => setType('PODCAST')}
                >
                    <Mic className="mr-1.5 h-4 w-4" /> Podcast
                </Button>
            </div>

            <MediaList type={type} />
        </div>
    );
}
