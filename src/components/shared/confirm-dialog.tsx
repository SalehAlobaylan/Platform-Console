'use client';

import { useRef, useState } from 'react';
import {
  AlertDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'destructive' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const destructive = variant === 'destructive';
  const Root = destructive ? AlertDialog : Dialog;

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Root
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!isLoading) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="sm:max-w-[425px]"
        initialFocus={cancelRef}
        showClose={!destructive && !isLoading}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            ref={cancelRef}
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Root>
  );
}

// Hook for using confirm dialog
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    config: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    config: {
      title: '',
      description: '',
      onConfirm: () => {},
    },
    resolve: null,
  });

  const confirm = (
    config: Omit<
      ConfirmDialogProps,
      'open' | 'onOpenChange' | 'onConfirm' | 'onCancel'
    >
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        config: {
          ...config,
          onConfirm: () => {
            resolve(true);
            setState((prev) => ({ ...prev, open: false }));
          },
          onCancel: () => {
            resolve(false);
            setState((prev) => ({ ...prev, open: false }));
          },
        },
        resolve,
      });
    });
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open && state.resolve) {
          state.resolve(false);
        }
        setState((prev) => ({ ...prev, open }));
      }}
      {...state.config}
    />
  );

  return { confirm, ConfirmDialogComponent };
}
