'use client';

import { ReactNode, useRef, useState } from 'react';
import {
  AlertDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  trigger: React.ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void | false | Promise<void | false>;
  disabledReason?: string;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
  disabledReason,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const destructive = confirmVariant === 'destructive';
  const Root = destructive ? AlertDialog : Dialog;

  async function handleConfirm() {
    if (disabledReason || busy) return;
    setBusy(true);
    setError('');
    try {
      if ((await onConfirm()) !== false) setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Root
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (busy) return;
        if (nextOpen) setError('');
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent initialFocus={cancelRef} showClose={!destructive && !busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<div />}>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {disabledReason && (
            <p role="alert" className="text-sm text-destructive">
              {disabledReason}
            </p>
          )}
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={busy || !!disabledReason}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Root>
  );
}
