'use client';

import {
  DirectionProvider,
  useDirection,
} from '@base-ui/react/direction-provider';
import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;

const SheetClose = DialogPrimitive.Close;

const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Backdrop>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150',
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = DialogPrimitive.Backdrop.displayName;

interface SheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Popup
> {
  side?: 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';
  showClose?: boolean;
  closeLabel?: string;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  SheetContentProps
>(
  (
    {
      side = 'end',
      showClose = true,
      closeLabel = 'Close',
      className,
      children,
      dir,
      ...props
    },
    ref
  ) => {
    const direction = useDirection();
    return (
      <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Popup
          dir={dir ?? direction}
          ref={ref}
          className={cn(
            'fixed z-50 gap-4 bg-background p-6 shadow-lg data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150',
            side === 'top' && 'inset-x-0 top-0 border-b',
            side === 'bottom' && 'inset-x-0 bottom-0 border-t',
            side === 'left' &&
              'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
            side === 'right' &&
              'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
            side === 'start' &&
              'inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm',
            side === 'end' &&
              'inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm',
            className
          )}
          {...props}
        >
          <DirectionProvider
            direction={dir === 'rtl' || dir === 'ltr' ? dir : direction}
          >
            {children}
          </DirectionProvider>
          {showClose && (
            <DialogPrimitive.Close className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[open]:bg-secondary">
              <X className="h-4 w-4" />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = DialogPrimitive.Popup.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-start',
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2',
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
