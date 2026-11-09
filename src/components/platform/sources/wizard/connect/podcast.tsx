'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSearchPodcasts } from '@/hooks/use-source-preview';
import type { ItunesPodcast } from '@/types/platform/source';

interface ConnectPodcastProps {
    value: string;
    onChange: (url: string) => void;
    /** Picking a show fills feed URL + artwork + name in one go. */
    onPick: (podcast: ItunesPodcast) => void;
}

/**
 * Podcast connect — search iTunes by show name and pick one (auto-fills the feed
 * URL, artwork, and name), or paste a feed URL directly.
 */
export function ConnectPodcast({ value, onChange, onPick }: ConnectPodcastProps) {
    const [term, setTerm] = useState('');
    const search = useSearchPodcasts();
    const results: ItunesPodcast[] = search.data?.results ?? [];

    const submit = () => {
        if (term.trim()) search.mutate(term.trim());
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="podcast_search">Find a podcast</Label>
                <div className="flex gap-2">
                    <Input
                        id="podcast_search"
                        placeholder="Search by show name, e.g. ثمانية"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                submit();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={submit}
                        disabled={!term.trim() || search.isPending}
                    >
                        {search.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" /> Search
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {search.isSuccess && results.length === 0 && (
                <p className="text-xs text-muted-foreground">No podcasts found for that search.</p>
            )}

            {results.length > 0 && (
                <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                    {results.map((p) => {
                        const active = value === p.feed_url;
                        return (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(p)}
                                    className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50 ${
                                        active ? 'border-gold bg-gold/5' : ''
                                    }`}
                                >
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                                        {p.image_url ? (
                                            <img
                                                src={p.image_url}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : null}
                                    </div>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{p.name}</span>
                                        {active && <span className="text-xs text-gold">Selected</span>}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="space-y-2 border-t pt-4">
                <Label htmlFor="podcast_url">Or paste a feed URL</Label>
                <Input
                    id="podcast_url"
                    type="url"
                    placeholder="https://feeds.example.com/podcast.xml"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
}
