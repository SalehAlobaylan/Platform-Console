'use client';

import { guardEditorHistory } from '@/lib/studio/history-guard';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock3, GitCompare, HardDrive, Loader2, RefreshCw, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StudioPlayer } from '@/components/platform/media/studio/player';
import { Timeline } from '@/components/platform/media/studio/timeline';
import { ChapterList } from '@/components/platform/media/studio/chapter-list';
import { TranscriptPanel } from '@/components/platform/media/studio/transcript-panel';
import { GenerateDialog } from '@/components/platform/media/studio/generate-dialog';
import { SourceLegend } from '@/components/platform/media/studio/source-legend';
import { ChapterDraftControls } from './chapter-draft-controls';
import {
    studioKeys,
    useStudio,
    useGenerateChapters,
    useSaveChapters,
    useSaveTranscript,
    useApproveTranscript,
    useUnapproveTranscript,
    useTranscriptCompare,
} from '@/hooks/use-studio';
import { useTriggerStt } from '@/hooks/use-transcription';
import {
    addChapterAt,
    deleteChapterAt,
    deriveEnds,
    moveBoundary,
    normalize,
    updateChapter,
} from '@/lib/studio/chapters';
import { peakStartsMs } from '@/lib/studio/heatmap';
import type {
    GenerateChaptersRequest,
    StudioChapter,
    StudioSegment,
    TranscriptCompareCandidate,
} from '@/types/platform/studio';
import type {
    TranscriptQualityStatus,
    TranscriptionJobStatus,
} from '@/types/platform/content';

interface MediaStudioWorkbenchProps {
    id: string;
    selectedChapterId?: string | null;
    compact?: boolean;
}

const JOB_STATUS_LABELS: Record<TranscriptionJobStatus, string> = {
    queued: 'Queued',
    running: 'Running',
    skipped: 'Skipped',
    succeeded: 'Succeeded',
    failed: 'Failed',
    writeback_failed: 'Writeback failed',
    canceled: 'Canceled',
};
const JOB_STATUS_VARIANTS: Record<
    TranscriptionJobStatus,
    'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'
> = {
    queued: 'secondary',
    running: 'info',
    skipped: 'outline',
    succeeded: 'success',
    failed: 'destructive',
    writeback_failed: 'destructive',
    canceled: 'outline',
};
const QUALITY_STATUS_LABELS: Record<TranscriptQualityStatus, string> = {
    ok: 'OK',
    needs_review: 'Needs review',
    auto_repair: 'Auto repair',
};
const QUALITY_STATUS_VARIANTS: Record<
    TranscriptQualityStatus,
    'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'
> = {
    ok: 'success',
    needs_review: 'warning',
    auto_repair: 'destructive',
};
const MB = 1024 * 1024;
const LARGE_MEDIA_WARNING_BYTES = 500 * MB;

function formatBytes(bytes?: number, emptyLabel = 'Untracked'): string {
    if (!bytes || bytes <= 0) return emptyLabel;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const precision = value >= 10 || unit === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[unit]}`;
}

function formatDateShort(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function candidateLabel(candidate: TranscriptCompareCandidate): string {
    if (candidate.kind === 'active') return 'Active transcript';
    if (candidate.kind === 'youtube_caption') return 'YouTube caption';
    if (candidate.kind === 'stt') return 'STT transcript';
    if (candidate.kind === 'version') return 'Version snapshot';
    return 'Transcript';
}

function CandidatePane({ candidate, query }: { candidate: TranscriptCompareCandidate; query: string }) {
    const q = query.trim().toLowerCase();
    const segments = q
        ? candidate.segments.filter((seg) => seg.text.toLowerCase().includes(q))
        : candidate.segments.slice(0, 80);
    return (
        <div className="min-w-0 rounded-md border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={candidate.kind === 'active' ? 'default' : 'secondary'}>{candidateLabel(candidate)}</Badge>
                {candidate.source && <Badge variant="outline">{candidate.source}</Badge>}
                {candidate.provider && <span className="text-xs text-muted-foreground">{candidate.provider}</span>}
            </div>
            <div className="mb-2 text-xs text-muted-foreground">
                {candidate.word_count} words · {candidate.segment_count} segments · {Math.round(candidate.similarity * 100)}% similar · Δ {candidate.difference_count}
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto text-sm">
                {segments.length > 0 ? segments.map((seg, index) => (
                    <div key={`${candidate.id}-${index}`} className="rounded bg-muted/40 px-2 py-1">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{Math.round(seg.start)}s</span>
                        <span dir="auto">{seg.text}</span>
                    </div>
                )) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">No matching segments.</p>
                )}
            </div>
        </div>
    );
}

export function MediaStudioWorkbench({ id, selectedChapterId, compact = false }: MediaStudioWorkbenchProps) {
    const { data, isLoading } = useStudio(id);

    const mediaRef = useRef<HTMLVideoElement | null>(null);
    const transcriptSearchRef = useRef<HTMLInputElement | null>(null);
    const initedRef = useRef<string | null>(null);

    const [chapters, setChapters] = useState<StudioChapter[]>([]);
    const [segments, setSegments] = useState<StudioSegment[]>([]);
    const [durationMs, setDurationMs] = useState(0);
    const [currentMs, setCurrentMs] = useState(0);
    const [chaptersDirty, setChaptersDirty] = useState(false);
    const [transcriptDirty, setTranscriptDirty] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareQuery, setCompareQuery] = useState('');
    const [selectedCompareIndex, setSelectedCompareIndex] = useState(0);
    const [approveOpen, setApproveOpen] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');
    const [sttOpen, setSttOpen] = useState(false);

    const queryClient = useQueryClient();
    const triggerStt = useTriggerStt();
    const generate = useGenerateChapters(id);
    const saveChaptersMut = useSaveChapters(id);
    const saveTranscriptMut = useSaveTranscript(id);
    const approveTranscript = useApproveTranscript(id);
    const unapproveTranscript = useUnapproveTranscript(id);
    const compare = useTranscriptCompare(id, compareOpen);

    // Init working state once per item (refetches after save won't clobber edits).
    useEffect(() => {
        if (data && initedRef.current !== id) {
            initedRef.current = id;
            const dur = (data.content.duration_sec ?? 0) * 1000;
            setDurationMs(dur);
            setChapters(data.chapters);
            setSegments(data.transcript?.segments ?? []);
        }
    }, [data, id]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!chaptersDirty && !transcriptDirty) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [chaptersDirty, transcriptDirty]);

    useEffect(() => {
        const guard = (event: Event) => {
            if ((chaptersDirty || transcriptDirty) && !window.confirm('Leave Media Studio and discard unsaved changes?')) event.preventDefault();
        };
        window.addEventListener('media-studio:navigate', guard);
        return () => window.removeEventListener('media-studio:navigate', guard);
    }, [chaptersDirty, transcriptDirty]);

    useEffect(() => {
        if (!chaptersDirty && !transcriptDirty) return;
        return guardEditorHistory(() => window.confirm('Leave Media Studio and discard unsaved changes?'));
    }, [chaptersDirty, transcriptDirty]);

    useEffect(() => {
        const onDocumentClick = (event: globalThis.MouseEvent) => {
            if (!chaptersDirty && !transcriptDirty) return;
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const target = event.target as Element | null;
            const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
            const href = anchor.getAttribute('href') || '';
            if (!href || href.startsWith('#')) return;
            const next = new URL(anchor.href, window.location.href);
            if (next.origin !== window.location.origin || next.href === window.location.href) return;
            const current = new URL(window.location.href);
            if (next.pathname === current.pathname && next.searchParams.get('item') === current.searchParams.get('item') && next.searchParams.get('tab') === current.searchParams.get('tab')) return;
            if (!window.confirm('Leave Media Studio and discard unsaved changes?')) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        document.addEventListener('click', onDocumentClick, true);
        return () => document.removeEventListener('click', onDocumentClick, true);
    }, [chaptersDirty, transcriptDirty]);

    const seek = useCallback((ms: number) => {
        if (mediaRef.current) mediaRef.current.currentTime = ms / 1000;
        setCurrentMs(ms);
    }, []);

    useEffect(() => {
        if (!selectedChapterId || chapters.length === 0) return;
        const selected = chapters.find((chapter) =>
            chapter.id === selectedChapterId || chapter.child_content_item_id === selectedChapterId
        );
        if (selected) seek(selected.start_ms);
    }, [chapters, seek, selectedChapterId]);

    const onDurationMs = (ms: number) => {
        if (ms > 0) {
            setDurationMs(ms);
            setChapters((prev) => deriveEnds(prev, ms));
        }
    };

    // Chapter edit handlers (client working set).
    const editChapters = useCallback((next: StudioChapter[]) => {
        setChapters(next);
        setChaptersDirty(true);
    }, []);
    const handleAddAtPlayhead = useCallback(() => {
        editChapters(addChapterAt(chapters, currentMs, durationMs));
    }, [chapters, currentMs, durationMs, editChapters]);
    const handleAddAtPeaks = () => {
        const peaks = peakStartsMs(data?.content.heatmap ?? [], durationMs, 5);
        let next = chapters;
        for (const ms of peaks) next = addChapterAt(next, ms, durationMs, 'Highlight');
        editChapters(next);
    };
    const handleDelete = (i: number) => editChapters(deleteChapterAt(chapters, i, durationMs));
    const handleUpdate = (i: number, patch: Partial<Pick<StudioChapter, 'title' | 'summary'>>) =>
        editChapters(updateChapter(chapters, i, patch));
    const handleMoveBoundary = (i: number, ms: number) =>
        editChapters(moveBoundary(chapters, i, ms, durationMs));

    useEffect(() => {
        const isTyping = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (generateOpen || compareOpen || approveOpen || sttOpen) return;
            if (isTyping(event.target)) return;
            if (event.key === ' ') {
                event.preventDefault();
                const media = mediaRef.current;
                if (!media) return;
                if (media.paused) void media.play();
                else media.pause();
            } else if (event.key.toLowerCase() === 'j') {
                const prev = [...segments].reverse().find((seg) => seg.start * 1000 < currentMs - 250);
                if (prev) seek(prev.start * 1000);
            } else if (event.key.toLowerCase() === 'k') {
                const next = segments.find((seg) => seg.start * 1000 > currentMs + 250);
                if (next) seek(next.start * 1000);
            } else if (event.key.toLowerCase() === 'c') {
                handleAddAtPlayhead();
            } else if (event.key === '/') {
                event.preventDefault();
                transcriptSearchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [segments, currentMs, handleAddAtPlayhead, seek, generateOpen, compareOpen, approveOpen, sttOpen]);

    const handleGenerate = async (req: GenerateChaptersRequest) => {
        try {
            const preview = await generate.mutateAsync(req);
            setChapters(normalize(preview, durationMs));
            setChaptersDirty(true);
            setGenerateOpen(false);
        } catch {
            // Error toast surfaced by the hook's onError.
        }
    };

    const handleSaveChapters = async () => {
        try {
            const saved = await saveChaptersMut.mutateAsync(chapters);
            setChapters(saved);
            setChaptersDirty(false);
        } catch {
            // Error toast surfaced by the hook's onError.
        }
    };

    const handleEditSegment = (index: number, text: string) => {
        setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, text } : s)));
        setTranscriptDirty(true);
    };

    const handleSaveTranscript = async () => {
        try {
            await saveTranscriptMut.mutateAsync(segments);
            setTranscriptDirty(false);
        } catch {
            // Error toast surfaced by the hook's onError.
        }
    };

    const handleApprove = async () => {
        await approveTranscript.mutateAsync(approvalReason).then(() => {
            setApproveOpen(false);
            setApprovalReason('');
        }).catch(() => undefined);
    };

    const handleUnapprove = async () => {
        await unapproveTranscript.mutateAsync().catch(() => undefined);
    };

    const handleReTranscribe = () => {
        setSttOpen(false);
        triggerStt.mutate(id, {
            // Hook toasts + invalidates content lists; also refresh this
            // workspace so the "Latest STT job" card picks up the new job.
            onSuccess: () => queryClient.invalidateQueries({ queryKey: studioKeys.detail(id) }),
        });
    };

    if (isLoading || !data) {
        return (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    const { content, transcript } = data;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="brand-overline text-muted-foreground">Studio workbench</p>
                    <h1 className="truncate text-2xl font-semibold" title={content.title}>
                        {content.title || '(untitled)'}
                    </h1>
                    <div className="mt-1 flex items-center gap-2">
                        <Badge variant="secondary">{content.type}</Badge>
                        <Badge variant="outline">{content.status}</Badge>
                        <Badge variant="outline" title={content.file_size_bytes ? `${content.file_size_bytes.toLocaleString()} bytes` : 'Size not tracked'}>
                            <HardDrive className="mr-1 h-3 w-3" />
                            {formatBytes(content.file_size_bytes)}
                        </Badge>
                        {content.storage_tier && <Badge variant="outline">{content.storage_tier}</Badge>}
                        <Link
                            href="/platform/media"
                            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Media Library
                        </Link>
                        {transcript?.approved_at && (
                            <Badge variant="outline" title={transcript.approval_reason || transcript.approved_by}>
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Approved
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setSttOpen(true)}
                        disabled={!content.media_url || triggerStt.isPending}
                        title={!content.media_url ? 'No media file available for STT' : undefined}
                    >
                        {triggerStt.isPending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-1.5 h-4 w-4" />
                        )}
                        Re-transcribe
                    </Button>
                    <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={!transcript}>
                        <GitCompare className="mr-1.5 h-4 w-4" />
                        Compare
                    </Button>
                    {transcript?.approved_at ? (
                        <Button variant="outline" onClick={handleUnapprove} disabled={unapproveTranscript.isPending}>
                            <ShieldCheck className="mr-1.5 h-4 w-4" />
                            Clear approval
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={() => setApproveOpen(true)} disabled={!transcript || approveTranscript.isPending}>
                            <ShieldCheck className="mr-1.5 h-4 w-4" />
                            Approve transcript for use
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setGenerateOpen(true)} disabled={!transcript}>
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        {chapters.length > 0 ? 'Regenerate chapters' : 'Generate chapters'}
                    </Button>
                    {(content.duration_sec ?? 0) <= 2400 && <Button onClick={handleSaveChapters} disabled={!chaptersDirty || saveChaptersMut.isPending}>
                        {saveChaptersMut.isPending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Save chapters
                    </Button>}
                </div>
            </div>

            {(content.duration_sec ?? 0) > 2400 && <ChapterDraftControls key={id} id={id} chapters={chapters} dirty={chaptersDirty} onSaved={() => setChaptersDirty(false)} onLoad={editChapters} />}

            {/* Player */}
            <div className={compact ? 'rounded-md border bg-card p-3' : undefined}>
                <StudioPlayer
                    src={content.media_url}
                    poster={content.thumbnail_url}
                    mediaRef={mediaRef}
                    onTimeMs={setCurrentMs}
                    onDurationMs={onDurationMs}
                />
            </div>

            {!transcript ? (
                <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    No transcript yet. Generate one from Media Library (Enrich with STT) before creating
                    chapters.
                </div>
            ) : (
                <>
                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-md border p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold">Transcript quality</h2>
                                {data.transcript_quality ? (
                                    <Badge variant={QUALITY_STATUS_VARIANTS[data.transcript_quality.status]}>
                                        {QUALITY_STATUS_LABELS[data.transcript_quality.status]} · {Math.round(data.transcript_quality.score * 100)}%
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Not scored</Badge>
                                )}
                            </div>
                            {data.transcript_quality?.issue_codes?.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {data.transcript_quality.issue_codes.map((issue) => (
                                        <Badge key={issue} variant="outline" title={issue}>
                                            <AlertTriangle className="mr-1 h-3 w-3" />
                                            {issue.replaceAll('_', ' ')}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No transcript quality issues recorded.</p>
                            )}
                        </div>
                        <div className="rounded-md border p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold">Latest STT job</h2>
                                {data.latest_transcription_job ? (
                                    <Badge variant={JOB_STATUS_VARIANTS[data.latest_transcription_job.status]}>
                                        {JOB_STATUS_LABELS[data.latest_transcription_job.status]}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">No jobs</Badge>
                                )}
                            </div>
                            {data.latest_transcription_job ? (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                    <p>
                                        {data.latest_transcription_job.provider || 'Provider pending'}
                                        {data.latest_transcription_job.model ? ` · ${data.latest_transcription_job.model}` : ''}
                                    </p>
                                    <p>
                                        Media size: {formatBytes(content.file_size_bytes)}
                                        {content.storage_tier ? ` · ${content.storage_tier}` : ''}
                                    </p>
                                    <p>
                                        <Clock3 className="mr-1 inline h-3 w-3" />
                                        {formatDateShort(
                                            data.latest_transcription_job.completed_at ||
                                            data.latest_transcription_job.started_at ||
                                            data.latest_transcription_job.created_at
                                        )}
                                    </p>
                                    {data.latest_transcription_job.writeback_status && (
                                        <p>
                                            Writeback: {data.latest_transcription_job.writeback_status}
                                            {data.latest_transcription_job.writeback_error ? ` · ${data.latest_transcription_job.writeback_error}` : ''}
                                        </p>
                                    )}
                                    {(data.latest_transcription_job.error_message || data.latest_transcription_job.skip_reason) && (
                                        <p className="line-clamp-2">
                                            {data.latest_transcription_job.error_message || data.latest_transcription_job.skip_reason}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No transcription job has been recorded for this item.</p>
                            )}
                        </div>
                        <div className="rounded-md border p-3">
                            <h2 className="mb-2 text-sm font-semibold">Studio audit</h2>
                            {data.transcript_audit?.last_action ? (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                    <p>{data.transcript_audit.last_action.replace('media_studio.', '').replaceAll('_', ' ')}</p>
                                    <p>{formatDateShort(data.transcript_audit.last_at)}</p>
                                    {data.transcript_audit.user_email && <p>{data.transcript_audit.user_email}</p>}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No Studio edit audit event yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Timeline */}
                    <Timeline
                        chapters={chapters}
                        durationMs={durationMs}
                        currentMs={currentMs}
                        onSeek={seek}
                        onMoveBoundary={handleMoveBoundary}
                        heatmap={content.heatmap}
                        sponsorSegments={content.sponsor_segments}
                    />

                    {/* Source legend — what each chapter color/source means */}
                    <SourceLegend />
                    {chaptersDirty && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                            Unsaved changes — click “Save chapters” to persist.
                        </p>
                    )}

                    {/* Chapters + transcript */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <ChapterList
                            chapters={chapters}
                            onSeek={seek}
                            onAddAtPlayhead={handleAddAtPlayhead}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onAddAtPeaks={content.heatmap?.length ? handleAddAtPeaks : undefined}
                        />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Transcript</h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        title={transcriptDirty ? 'Save transcript before regenerating chapters' : 'Regenerate chapters from the current transcript'}
                                        onClick={() => setGenerateOpen(true)}
                                        disabled={transcriptDirty || !transcript}
                                    >
                                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                        Regenerate chapters
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSaveTranscript}
                                        disabled={!transcriptDirty || saveTranscriptMut.isPending}
                                    >
                                        {saveTranscriptMut.isPending && (
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        )}
                                        Save transcript
                                    </Button>
                                </div>
                            </div>
                            <TranscriptPanel
                                segments={segments}
                                currentMs={currentMs}
                                onSeek={seek}
                                onEditSegment={handleEditSegment}
                                searchInputRef={transcriptSearchRef}
                            />
                        </div>
                    </div>
                </>
            )}

            <GenerateDialog
                open={generateOpen}
                onOpenChange={setGenerateOpen}
                onGenerate={handleGenerate}
                isPending={generate.isPending}
                hasChapters={chapters.length > 0}
            />
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Compare transcripts</DialogTitle>
                        <DialogDescription>
                            Review transcript sources side by side.
                        </DialogDescription>
                    </DialogHeader>
                    {compare.isLoading ? (
                        <div className="flex h-48 items-center justify-center text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : compare.data ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    value={compareQuery}
                                    onChange={(event) => setCompareQuery(event.target.value)}
                                    placeholder="Search comparison"
                                    className="h-9 min-w-[220px] flex-1 rounded-md border bg-background px-3 text-sm"
                                />
                                {compare.data.candidates.length > 0 && (
                                    <select
                                        value={selectedCompareIndex}
                                        onChange={(event) => setSelectedCompareIndex(Number(event.target.value))}
                                        className="h-9 rounded-md border bg-background px-3 text-sm"
                                    >
                                        {compare.data.candidates.map((candidate, index) => (
                                            <option key={candidate.id} value={index}>
                                                {candidateLabel(candidate)} · {Math.round(candidate.similarity * 100)}%
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            {compare.data.candidates.length === 0 ? (
                                <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                                    No previous transcript or caption candidate is available for comparison.
                                </div>
                            ) : (
                                <div className="grid gap-3 lg:grid-cols-2">
                                    <CandidatePane candidate={compare.data.active} query={compareQuery} />
                                    <CandidatePane
                                        candidate={compare.data.candidates[Math.min(selectedCompareIndex, compare.data.candidates.length - 1)]}
                                        query={compareQuery}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                            Comparison is unavailable.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve transcript</DialogTitle>
                        <DialogDescription>
                            Mark this transcript as reviewed.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={approvalReason}
                        onChange={(event) => setApprovalReason(event.target.value)}
                        placeholder="Reason"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setApproveOpen(false)}>Cancel</Button>
                        <Button onClick={handleApprove} disabled={approveTranscript.isPending}>
                            {approveTranscript.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={sttOpen} onOpenChange={setSttOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{transcript ? 'Re-transcribe with STT?' : 'Transcribe with STT?'}</DialogTitle>
                        <DialogDescription>
                            Runs the configured STT engine on “{content.title || 'this item'}”, replacing any
                            existing transcript and re-running embeddings. The monthly budget cap still applies.
                            <span className="mt-2 block">
                                Media size: {formatBytes(content.file_size_bytes)}
                                {content.storage_tier ? ` · ${content.storage_tier}` : ''}.
                            </span>
                            {(content.file_size_bytes ?? 0) >= LARGE_MEDIA_WARNING_BYTES && (
                                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-500">
                                    Large media can slow provider upload/download and is more likely to expose pipeline timeouts.
                                </span>
                            )}
                            {transcript?.approved_at && (
                                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-500">
                                    This transcript is approved. Approval is advisory; this action is still allowed.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSttOpen(false)}>Cancel</Button>
                        <Button onClick={handleReTranscribe} disabled={triggerStt.isPending}>
                            {triggerStt.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            {transcript ? 'Re-transcribe' : 'Transcribe'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
