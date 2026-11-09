'use client';

import { Loader2, CheckCircle2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils/format';
import { useResolveYoutube } from '@/hooks/use-source-preview';
import type { YoutubeResolved } from '@/types/platform/source';

interface ConnectYoutubeProps {
    value: string;
    onChange: (value: string) => void;
    /** Apply resolved channel name + avatar to the draft source. */
    onResolved?: (channel: YoutubeResolved) => void;
}

export function ConnectYoutube({ value, onChange, onResolved }: ConnectYoutubeProps) {
    const resolve = useResolveYoutube();
    const channel = resolve.data;

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label htmlFor="yt_url">Channel, playlist, or hashtag URL</Label>
                <div className="flex gap-2">
                    <Input
                        id="yt_url"
                        type="text"
                        placeholder="https://www.youtube.com/@handle"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => value.trim() && resolve.mutate(value.trim())}
                        disabled={!value.trim() || resolve.isPending}
                    >
                        {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Accepts channel URLs (<code>/@handle</code>, <code>/channel/UC…</code>, <code>/c/Name</code>),
                    playlist URLs, or hashtag URLs. Aggregation resolves the right mode.
                </p>
            </div>

            {channel && (
                <button
                    type="button"
                    onClick={() => onResolved?.(channel)}
                    className="flex w-full items-center gap-3 rounded-md border border-success/40 bg-success/5 p-3 text-left transition-colors hover:bg-success/10"
                >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                        {channel.thumbnail ? (
                            <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="truncate">{channel.title}</span>
                        </div>
                        {channel.subscriber_count != null && (
                            <div className="text-xs text-muted-foreground">
                                {formatNumber(channel.subscriber_count)} subscribers
                            </div>
                        )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">Use name + icon</span>
                </button>
            )}
        </div>
    );
}
