'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
export function ActivityRail({
  title,
  description,
  closeLabel,
  triggerLabel,
  toolsLabel,
  dir = 'ltr',
  children,
}: {
  title: string;
  description: string;
  closeLabel: string;
  triggerLabel: string;
  toolsLabel: string;
  dir?: 'ltr' | 'rtl';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 1280px)');
    const resetPanels = () => {
      setOpen(false);
      setSheetOpen(false);
    };
    desktop?.addEventListener('change', resetPanels);
    return () => desktop?.removeEventListener('change', resetPanels);
  }, []);

  return (
    <>
      <div className="flex justify-end xl:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <History aria-hidden="true" className="me-2 size-4" />
              {triggerLabel}
            </Button>
          </SheetTrigger>
          <SheetContent
            hasAccessibleHeader
            dir={dir}
            side={dir === 'rtl' ? 'left' : 'right'}
            closeLabel={closeLabel}
            className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          >
            <SheetHeader className="shrink-0 border-b px-5 py-4 pe-14 text-start">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden border-s xl:col-start-2 xl:row-start-1 xl:block">
        <div
          className="sticky top-0 z-20 bg-background ps-1"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div
            role="group"
            aria-label={toolsLabel}
            className="flex justify-center py-1"
          >
            <Button
              ref={trigger}
              variant={open ? 'secondary' : 'ghost'}
              size="icon"
              aria-label={title}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              title={title}
              onClick={() => setOpen((value) => !value)}
            >
              <History aria-hidden="true" className="size-4" />
            </Button>
          </div>
          {open && (
            <section
              id={panelId}
              aria-labelledby={`${panelId}-title`}
              className="absolute end-full top-0 me-2 flex max-h-[70dvh] w-[23rem] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
            >
              <header className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3">
                <div className="min-w-0">
                  <h2 id={`${panelId}-title`} className="text-sm font-semibold">
                    {title}
                  </h2>
                  {description && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={closeLabel}
                  onClick={close}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {children}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
