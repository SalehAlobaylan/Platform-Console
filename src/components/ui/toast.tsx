'use client';

import { useDirection } from '@base-ui/react/direction-provider';
import { Toast } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'destructive' | 'success';
const manager = Toast.createToastManager<{ variant?: ToastVariant }>();

export function toast({
  title,
  description,
  variant,
}: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}) {
  return manager.add({
    title,
    description,
    data: { variant },
    priority: variant === 'destructive' ? 'high' : 'low',
  });
}

function Notifications() {
  const direction = useDirection();
  const { toasts } = Toast.useToastManager<{ variant?: ToastVariant }>();
  return (
    <Toast.Portal>
      <Toast.Viewport
        dir={direction}
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex max-h-screen flex-col gap-2 p-4 sm:inset-x-auto sm:bottom-0 sm:end-0 sm:top-auto sm:w-[420px]"
      >
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            toast={item}
            className={cn(
              'pointer-events-auto relative rounded-md border bg-background p-6 pe-10 text-foreground shadow-lg data-[limited]:hidden data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity',
              item.data?.variant === 'destructive' &&
                'border-destructive bg-destructive text-destructive-foreground',
              item.data?.variant === 'success' && 'border-success bg-success/10'
            )}
          >
            <Toast.Content>
              <Toast.Title className="text-sm font-semibold" />
              <Toast.Description className="text-sm opacity-90" />
              <Toast.Close
                aria-label="Dismiss notification"
                className="absolute end-3 top-3 rounded p-1 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={manager} limit={5} timeout={5000}>
      <Notifications />
    </Toast.Provider>
  );
}
