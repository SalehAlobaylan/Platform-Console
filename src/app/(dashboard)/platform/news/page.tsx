'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cmsClient } from '@/lib/api/client';
import { useRecentConsoleRecord } from '@/hooks/use-recent-console-record';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Plus, ArrowLeft, Sparkles, Wand2, ChevronDown, Loader2, Rss } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { TopicBoard } from '@/components/platform/news/topic-board';
import { NewsBoard } from '@/components/platform/news/news-board';
import { NewsOverview } from '@/components/platform/news/news-overview';
import { NewsLibrary } from '@/components/platform/news/news-library';
import { AddNewsSheet } from '@/components/platform/news/add-news-sheet';
import { PullFreshButton } from '@/components/platform/news/run-source-dialog';
import { RecclusterDialog } from '@/components/platform/news/recluster-dialog';
import { FeedsManager } from '@/components/platform/news/feeds-manager';
import { NewsSectionNav } from '@/components/platform/news/news-section-nav';
import { NewsCollectionOverview } from '@/components/platform/sources/manage/news-collection-controls';
import { useReclassify } from '@/hooks/use-news';
import type { TopicSelection } from '@/types/platform/news';

type NewsViewTab = 'overview' | 'topics' | 'library';

const VIEW_SUBTITLES: Record<NewsViewTab, string> = {
    overview: 'News Center — feed health, story backlog, and ingestion at a glance.',
    topics: 'Rotate the feed by story — publish, archive, and curate whole stories at once.',
    library: 'Browse, filter, and manage every news and article item.',
};

export default function NewsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const viewParam = searchParams.get('view');
    const view: NewsViewTab =
        viewParam === 'topics' || viewParam === 'library' ? viewParam : 'overview';

    const storyId = view === 'topics' ? searchParams.get('story') : null;
    const validStoryId = Boolean(storyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId));
    const story = useQuery({
        queryKey: ['news', 'exact-story', storyId],
        queryFn: ({ signal }) => cmsClient.get<TopicSelection>('/admin/stories/' + encodeURIComponent(storyId ?? ''), undefined, signal),
        enabled: validStoryId,
    });
    useRecentConsoleRecord('story', story.isSuccess && story.data?.id === storyId ? story.data.id : undefined, story.data?.label, 'News story');
    const active = storyId === 'none' ? { id: 'none', label: 'Uncategorized' } : story.data ?? null;
    const [addOpen, setAddOpen] = useState(false);
    const [reclusterOpen, setReclusterOpen] = useState(false);
    const [feedsOpen, setFeedsOpen] = useState(false);
    const [classifying, setClassifying] = useState(false);

    const reclassify = useReclassify();

    const setView = useCallback(
        (v: NewsViewTab, extra?: Record<string, string>) => {
            const params = new URLSearchParams();
            if (v !== 'overview') params.set('view', v);
            for (const [k, val] of Object.entries(extra ?? {})) params.set(k, val);
            const qs = params.toString();
            router.replace(`/platform/news${qs ? `?${qs}` : ''}`, { scroll: false });
        },
        [router]
    );

    const runClassify = async () => {
        setClassifying(true);
        try {
            let guard = 0;
            let last = 0;
            while (guard++ < 200) {
                const r = await reclassify.mutateAsync(25);
                last = r.processed;
                if (r.remaining === 0 || r.processed === 0) break;
            }
            toast({
                title: 'Classification complete',
                description: last === 0 ? 'Nothing to classify.' : 'Stories updated.',
                variant: 'success',
            });
        } finally {
            setClassifying(false);
        }
    };

    const drilledIn = view === 'topics' && active !== null;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    {drilledIn ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setView('topics')}
                                className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                All stories
                            </button>
                            <p className="brand-overline text-news">News desk</p>
                            <h1 className="truncate text-3xl font-bold tracking-tight" title={active.label}>
                                {active.label}
                            </h1>
                            <p className="text-muted-foreground">Manage this story’s news — item by item.</p>
                        </>
                    ) : (
                        <>
                            <span className="brand-overline text-news">News Center</span>
                            <h1 className="text-3xl font-semibold tracking-tight">News</h1>
                            <p className="text-muted-foreground">{VIEW_SUBTITLES[view]}</p>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <Button variant="outline" onClick={() => setFeedsOpen(true)}>
                        <Rss className="mr-2 h-4 w-4" />
                        Feeds
                    </Button>
                    <PullFreshButton />
                    <Button onClick={() => setAddOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add news
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="outline">
                                Auto-stories
                                <ChevronDown className="ml-1 h-4 w-4" />
                            </Button>} />
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={runClassify} disabled={classifying}>
                                {classifying ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                Classify unsorted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setReclusterOpen(true)}>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Re-cluster all…
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <NewsSectionNav />
            {view === 'overview' && !active && <NewsCollectionOverview />}

            {/* View switcher */}
            <Tabs value={view} onValueChange={(v) => setView(v as NewsViewTab)}>
                <TabsList aria-label="News views">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="topics">Stories</TabsTrigger>
                    <TabsTrigger value="library">Library</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-5">
                    <NewsOverview
                        onOpenLibrary={(preset) =>
                            setView('library', preset?.status ? { status: preset.status } : undefined)
                        }
                        onOpenTopics={() => setView('topics')}
                    />
                </TabsContent>
                <TabsContent value="topics" className="mt-5">
                    {active ? <NewsBoard key={active.id} topic={active} /> : storyId ? (
                        <div className="rounded-lg border p-4">
                            <p role="status">{validStoryId && story.isPending ? 'Loading story…' : 'This story is unavailable.'}</p>
                            <Button variant="outline" onClick={() => setView('topics')}>All stories</Button>
                        </div>
                    ) : <TopicBoard onOpenTopic={topic => setView('topics', { story: topic.id })} />}
                </TabsContent>
                <TabsContent value="library" className="mt-5">
                    <NewsLibrary />
                </TabsContent>
            </Tabs>

            <AddNewsSheet open={addOpen} onClose={() => setAddOpen(false)} />
            <RecclusterDialog open={reclusterOpen} onClose={() => setReclusterOpen(false)} />
            <FeedsManager open={feedsOpen} onClose={() => setFeedsOpen(false)} />
        </div>
    );
}
