'use client';

import Link from '@/lib/console-link';
import { Check, ExternalLink, RefreshCw, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useResolveStudioAutopilotProposal,
    useStudioAutopilotProposals,
} from '@/hooks/use-media-studio-autopilot';
import type { MediaStudioProposalInboxItem } from '@/types/platform/media-studio-autopilot';

function actionLabel(proposal: MediaStudioProposalInboxItem['proposal']): string {
    return proposal === 'publish' ? 'Publish chapter' : 'Reject chapter';
}

function ageLabel(hours: number): string {
    if (hours < 1) return '<1h';
    if (hours < 48) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
}

export function StudioProposalInbox() {
    const proposals = useStudioAutopilotProposals();
    const resolve = useResolveStudioAutopilotProposal();

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div>
                    <CardTitle className="text-base">Human decision inbox</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Machine drafts are advisory. Your decision uses the same chapter review action as the triage queue.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => proposals.refetch()} disabled={proposals.isFetching} aria-label="Refresh proposal inbox">
                    <RefreshCw className={proposals.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {proposals.isLoading && <p className="text-sm text-muted-foreground">Loading proposals…</p>}
                {proposals.isError && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                        <span>Could not load proposal drafts.</span>
                        <Button size="sm" variant="outline" onClick={() => proposals.refetch()}>Retry</Button>
                    </div>
                )}
                {!proposals.isLoading && !proposals.isError && proposals.data?.length === 0 && (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No drafted cases are waiting for a decision.</p>
                )}
                {proposals.data?.map((item) => {
                    const accept = item.proposal === 'publish';
                    const override = !accept;
                    const studioHref = item.parent_id
                        ? `/platform/media/atomization?tab=studio&item=${encodeURIComponent(item.parent_id)}`
                        : '/platform/media/atomization?tab=studio';
                    return (
                        <article key={item.action_id} className="rounded-md border border-[#D7A83E]/35 bg-[#D7A83E]/[0.04] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Draft: {actionLabel(item.proposal)}</Badge>
                                <Badge variant={item.aged ? 'destructive' : 'secondary'}>{ageLabel(item.age_hours)} old</Badge>
                                <span className="ml-auto font-mono text-xs text-muted-foreground">{Math.round(item.confidence * 100)}% confidence</span>
                            </div>
                            <p className="mt-2 text-sm font-medium" dir="auto">{item.title || 'Untitled chapter'}</p>
                            {item.review_code && <p className="mt-1 text-xs text-muted-foreground">Review code: {item.review_code}</p>}
                            <blockquote className="mt-3 border-l-2 border-[#D7A83E] pl-3 text-sm leading-relaxed text-muted-foreground" dir="auto">{item.rationale}</blockquote>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link href={studioHref} className="inline-flex"><Button size="sm" variant="outline"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open Studio</Button></Link>
                                <Button
                                    size="sm"
                                    onClick={() => resolve.mutate({ chapterId: item.chapter_id, actionId: item.action_id, approve: accept })}
                                    disabled={resolve.isPending}
                                >
                                    <Check className="mr-1.5 h-3.5 w-3.5" />Accept: {actionLabel(item.proposal)}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => resolve.mutate({ chapterId: item.chapter_id, actionId: item.action_id, approve: override })}
                                    disabled={resolve.isPending}
                                >
                                    <X className="mr-1.5 h-3.5 w-3.5" />Override: {actionLabel(override ? 'publish' : 'reject')}
                                </Button>
                            </div>
                        </article>
                    );
                })}
            </CardContent>
        </Card>
    );
}
