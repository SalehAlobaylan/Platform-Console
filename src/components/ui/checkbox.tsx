'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  Omit<CheckboxPrimitive.Root.Props, 'checked' | 'defaultChecked'> & {
    checked?: boolean | 'indeterminate';
    defaultChecked?: boolean | 'indeterminate';
  }
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [defaultMixed, setDefaultMixed] = React.useState(
    defaultChecked === 'indeterminate'
  );
  const indeterminate =
    checked === 'indeterminate' || (checked === undefined && defaultMixed);

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked === 'indeterminate' ? false : checked}
      defaultChecked={
        defaultChecked === 'indeterminate' ? false : defaultChecked
      }
      indeterminate={indeterminate}
      onCheckedChange={(value, details) => {
        onCheckedChange?.(value, details);
        if (!details.isCanceled && defaultMixed) setDefaultMixed(false);
      }}
      className={cn(
        'peer inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[indeterminate]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:text-primary-foreground data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {indeterminate ? (
          <Minus className="size-4" />
        ) : (
          <Check className="size-4" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
