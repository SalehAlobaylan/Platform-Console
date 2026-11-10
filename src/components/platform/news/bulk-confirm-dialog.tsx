'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ReviewedBulkAction = {
    count: number;
    apply: () => Promise<unknown>;
    expiresAt?: string;
};

export interface BulkConfirmConfig {
    title: string;
    actionLabel: string;
    destructive?: boolean;
    scopeLabel?: string;
    /** Noun for the affected rows, e.g. "article". */
    noun?: string;
    /** Returns the affected count (dry run). */
    preview: () => Promise<number | ReviewedBulkAction>;
    /** Commits the action. */
    commit?: () => Promise<unknown>;
}

interface BulkConfirmDialogProps {
    config: BulkConfirmConfig | null;
    onClose: () => void;
    onDone?: () => void;
}

/**
 * Generic "preview the count, then confirm" dialog for filter-based bulk
 * actions. On open it runs the dry-run preview; the confirm button commits.
 */
export function BulkConfirmDialog({ config, onClose, onDone }: BulkConfirmDialogProps) {
    const [attempt, setAttempt] = useState(0);
    const [preview, setPreview] = useState<{ config: BulkConfirmConfig; attempt: number; count: number | null; apply?: () => Promise<unknown>; expiresAt?: string } | null>(null);
    const reviewed = preview?.config === config && preview.attempt === attempt ? preview : null;
    const count = reviewed?.count ?? null;
    const previewing = Boolean(config && !reviewed);
    const commitLock = useRef(false);
    const [committing, setCommitting] = useState(false);
    const [commitError, setCommitError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setCommitError('');
        setPreview(null);
        if (!config) return;
        void Promise.resolve().then(() => config.preview()).then(
            (result) => {
                if (cancelled) return;
                const count = typeof result === 'number' ? result : result.count;
                setPreview({
                    config, attempt,
                    count: Number.isSafeInteger(count) && count >= 0 ? count : null,
                    apply: typeof result === 'number' ? config.commit : result.apply,
                    expiresAt: typeof result === 'number' ? undefined : result.expiresAt,
                });
            },
            () => !cancelled && setPreview({ config, attempt, count: null })
        );
        return () => {
            cancelled = true;
        };
    }, [config, attempt]);

    const onConfirm = async () => {
        if (!reviewed?.apply || count === null || count <= 0 || commitLock.current) return;
        if (reviewed.expiresAt && Date.parse(reviewed.expiresAt) <= Date.now()) {
            setPreview({ config: reviewed.config, attempt, count: null });
            return;
        }
        commitLock.current = true;
        setCommitting(true);
        setCommitError('');
        try {
            await reviewed.apply();
            onDone?.();
            onClose();
        } catch (error) {
            setCommitError(error instanceof Error ? error.message : 'Could not complete the action.');
        } finally {
            commitLock.current = false;
            setCommitting(false);
        }
    };

    const noun = config?.noun ?? 'item';
    const plural = count === 1 ? '' : 's';

    return (
        <Dialog
            open={Boolean(config)}
            disablePointerDismissal={config?.destructive}
            onOpenChange={(open) => {
                if (!open && !committing) onClose();
            }}
        >
            <DialogContent showClose={!committing}>
                <DialogHeader>
                    <DialogTitle>{config?.title}</DialogTitle>
                    <DialogDescription>
                        {previewing
                            ? 'Counting matching items…'
                            : count === null
                              ? 'Could not verify the affected items. Try the preview again.'
                              : `${config?.actionLabel} ${count.toLocaleString()} ${noun}${plural}.`}
                        {config?.scopeLabel && <> {config.scopeLabel}</>}
                        {reviewed?.expiresAt && <> Review expires at {new Date(reviewed.expiresAt).toLocaleTimeString()}.</>}
                        {config?.destructive && count !== null && count > 0
                            ? ' This cannot be undone.'
                            : ''}
                    </DialogDescription>
                </DialogHeader>
                {commitError && <p role="alert" className="text-sm text-destructive">{commitError}</p>}
                <DialogFooter>
                    {reviewed && count === null && <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Retry preview</Button>}
                    <Button variant="outline" onClick={onClose} disabled={committing}>
                        Cancel
                    </Button>
                    <Button
                        variant={config?.destructive ? 'destructive' : 'default'}
                        onClick={onConfirm}
                        disabled={committing || !reviewed?.apply || count === null || count <= 0}
                    >
                        {committing ? (
                            <Loader2 className="me-2 h-4 w-4 motion-safe:animate-spin" />
                        ) : null}
                        {config?.actionLabel}
                        {count ? ` ${count.toLocaleString()}` : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
