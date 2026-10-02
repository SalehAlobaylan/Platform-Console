'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listContentResetStagedItems,
  type ContentResetCampaignDetail,
} from '@/lib/api/cms/content-reset';

const laneOptions: Array<{ value: 'news' | 'pods'; label: string }> = [
  { value: 'news', label: 'News' },
  { value: 'pods', label: 'Pods' },
];

export default function ContentResetStagedPreview({ detail }: { detail: ContentResetCampaignDetail }) {
  const availableLanes = laneOptions.filter((lane) => detail.campaign.lane === 'both' || detail.campaign.lane === lane.value);
  const [lane, setLane] = useState<'news' | 'pods'>(availableLanes[0]?.value ?? 'pods');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const staged = useQuery({
    queryKey: ['content-reset', 'staged', detail.campaign.id, lane, cursor],
    queryFn: () => listContentResetStagedItems(detail.campaign.id, lane, cursor, 50),
    retry: false,
  });
  return <section className="space-y-3 rounded-md border p-4" aria-label="Staged replacement preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-medium">Staged replacement preview</h3>
        <p className="text-sm text-muted-foreground">
          {staged.data?.delivery_note ??
            'Authenticated metadata only. Candidate playback URLs are withheld until a private or signed delivery boundary is qualified.'}
        </p>
      </div>
      <div className="flex gap-2">
        {availableLanes.map((option) => <Button key={option.value} size="sm" variant={lane === option.value ? 'default' : 'outline'} onClick={() => { setLane(option.value); setCursor(undefined); setHistory([]); }}>{option.label}</Button>)}
      </div>
    </div>
    {staged.isPending && <p className="text-sm text-muted-foreground">Loading staged items…</p>}
    {staged.isError && <p className="text-sm text-muted-foreground">No isolated candidate view exists for this lane yet.</p>}
    {staged.data && <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Generation {staged.data.generation_id}</p>
      <ul className="divide-y text-sm">{staged.data.data.map((item) => <li className="py-2" key={item.id}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{item.title ?? item.id}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{item.type}</Badge>
            <Badge variant="outline">{item.status}</Badge>
            {item.duration_sec ? <Badge variant="outline">{Math.round(item.duration_sec / 60)}m</Badge> : null}
          </div>
        </div>
        {(item.playback_url || item.fallback_playback_url) && <p className="mt-1 break-all text-xs text-muted-foreground">{item.playback_url ?? item.fallback_playback_url}</p>}
      </li>)}</ul>
      {!staged.data.data.length && <p className="text-sm text-muted-foreground">No staged items are materialized for this lane yet.</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!history.length} onClick={() => { setCursor(history.at(-1)); setHistory((previous) => previous.slice(0, -1)); }}>Previous</Button>
        <Button size="sm" variant="outline" disabled={!staged.data.has_more} onClick={() => { setHistory((previous) => [...previous, cursor]); setCursor(staged.data.next_cursor); }}>Next</Button>
      </div>
    </div>}
  </section>;
}
