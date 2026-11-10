'use client';

import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAssignTopic, useTopics } from '@/hooks/use-news';
import { assignTopic } from '@/lib/api/cms/news';
import type { BulkSelection } from '@/types/platform/news';

const UNCATEGORIZE = '__uncategorize__';

interface MoveToTopicDialogProps {
    selection: BulkSelection | null;
    count: number;
    onClose: () => void;
    onDone?: () => void;
}

export function MoveToTopicDialog({ selection, count, onClose, onDone }: MoveToTopicDialogProps) {
    const [target, setTarget] = useState('');
    const topics = useTopics({ limit: 200 });
    const assign = useAssignTopic();
    const [attempt, setAttempt] = useState(0);
    const [preview, setPreview] = useState<{ selection: BulkSelection; target: string; attempt: number; count: number | null }>();
    const reviewed = preview && preview.selection === selection && preview.target === target && preview.attempt === attempt ? preview : undefined;
    useEffect(() => {
        setPreview(undefined);
        if (!selection || !target) return;
        let live = true;
        void assignTopic({ ...selection, target_story_id: target === UNCATEGORIZE ? '' : target, dry_run: true }).then(
            result => { if (live) setPreview({ selection, target, attempt, count: result.updated_count }); },
            () => { if (live) setPreview({ selection, target, attempt, count: null }); }
        );
        return () => { live = false; };
    }, [selection, target, attempt]);

    const close = () => {
        setTarget('');
        onClose();
    };

    const commit = () => {
        if (!selection || !target || !reviewed?.count || assign.isPending) return;
        assign.mutate(
            { ...selection, target_story_id: target === UNCATEGORIZE ? '' : target },
            {
                onSuccess: () => {
                    onDone?.();
                    close();
                },
            }
        );
    };

    return (
        <Dialog open={Boolean(selection)} onOpenChange={(o) => !o && !assign.isPending && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move to story</DialogTitle>
                    <DialogDescription>
                        Review a destination for {count.toLocaleString()} selected or matching items.
                        {target && (reviewed
                            ? reviewed.count === null ? ' Preview unavailable.' : ` CMS found ${reviewed.count} matching items.`
                            : ' Checking the destination and selection…')}
                    </DialogDescription>
                </DialogHeader>

                <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose a story…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={UNCATEGORIZE}>Uncategorized</SelectItem>
                        {(topics.data?.data ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <DialogFooter>
                    {reviewed?.count === null && <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>Retry preview</Button>}
                    <Button variant="outline" onClick={close} disabled={assign.isPending}>
                        Cancel
                    </Button>
                    <Button onClick={commit} disabled={!reviewed?.count || assign.isPending}>
                        {assign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
