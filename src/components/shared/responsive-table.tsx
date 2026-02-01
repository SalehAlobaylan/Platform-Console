import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveTableContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive table container that ensures horizontal scrolling on mobile
 * and maintains table layout on larger screens.
 */
export function ResponsiveTableContainer({
  children,
  className,
}: ResponsiveTableContainerProps) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-md border',
        '-mx-4 px-4 sm:mx-0 sm:px-0',
        className
      )}
    >
      <div className="min-w-[640px] sm:min-w-0">{children}</div>
    </div>
  );
}

export interface DataTableWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for data tables with consistent styling and responsive behavior.
 */
export function DataTableWrapper({
  children,
  className,
}: DataTableWrapperProps) {
  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      {children}
    </div>
  );
}
