'use client';

import { useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
    /** When set, the confirm button stays disabled until the user types this exact string. */
    confirmPhrase?: string;
    onConfirm: () => void;
    pending?: boolean;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    destructive,
    confirmPhrase,
    onConfirm,
    pending,
}: ConfirmDialogProps) {
    const phraseId = useId();
    const [typed, setTyped] = useState('');
    const locked = confirmPhrase ? typed.trim() !== confirmPhrase : false;

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (pending) return;
                if (!o) setTyped('');
                onOpenChange(o);
            }}
        >
            <DialogContent showClose={!pending}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {destructive && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        {title}
                    </DialogTitle>
                    <DialogDescription render={<div className="text-sm text-muted-foreground" />}>{description}</DialogDescription>
                </DialogHeader>
                {confirmPhrase && (
                    <div className="space-y-1.5">
                        <Label htmlFor={phraseId} className="text-xs text-muted-foreground">
                            Type <span className="font-mono font-semibold text-foreground">{confirmPhrase}</span> to confirm
                        </Label>
                        <Input id={phraseId} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" disabled={pending} onClick={() => {
                        setTyped('');
                        onOpenChange(false);
                    }}>
                        Cancel
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={locked || pending}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
