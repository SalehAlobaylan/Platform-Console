'use client';

import type { ReactNode } from 'react';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { cn } from '@/lib/utils';

interface SegmentedControlProps<Value extends string> {
  label: string;
  options: readonly { value: Value; label: ReactNode }[];
  value: Value;
  onValueChange: (value: Value) => void;
  size?: 'default' | 'sm';
}

export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  size = 'default',
}: SegmentedControlProps<Value>) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next);
      }}
      className={cn(
        'inline-flex items-center rounded-md bg-muted p-1',
        size === 'sm' ? 'h-9' : 'h-10'
      )}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm'
          )}
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
