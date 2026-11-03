'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SystemControlStripProps {
  id: string;
  name: string;
  state: string;
  scope: ReactNode;
  summary: ReactNode;
  activity: ReactNode;
  action: ReactNode;
  links?: ReactNode;
  children?: ReactNode;
  tone?: 'neutral' | 'active' | 'attention' | 'unavailable';
  dir?: 'ltr' | 'rtl';
  compact?: boolean;
}

// Presentation only: the owning domain supplies state, scope and permitted
// actions. This component never decides eligibility or changes system policy.
export function SystemControlStrip({
  id,
  name,
  state,
  scope,
  summary,
  activity,
  action,
  links,
  children,
  tone = 'neutral',
  dir = 'ltr',
  compact = false,
}: SystemControlStripProps) {
  const dot =
    tone === 'active'
      ? 'bg-info'
      : tone === 'attention'
        ? 'bg-warning'
        : 'bg-muted-foreground/60';
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      dir={dir}
      className={cn('scroll-mt-5 border-y py-4', compact && 'border-t-0 py-3')}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2
              id={`${id}-title`}
              className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}
            >
              {name}
            </h2>
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)}
              />
              {state}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{scope}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {!compact && (
        <>
          <div
            id={`${id}-scope`}
            className="mt-3 max-w-3xl text-sm text-muted-foreground"
          >
            {summary}
          </div>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 text-sm"
          >
            {activity}
          </p>
          {links && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {links}
            </div>
          )}
          {children}
        </>
      )}
    </section>
  );
}
