'use client';

import * as React from 'react';
import {
  DirectionProvider,
  useDirection,
} from '@base-ui/react/direction-provider';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';

type SelectProps = Omit<SelectPrimitive.Root.Props<string>, 'onValueChange'> & {
  dir?: 'ltr' | 'rtl';
  onValueChange?: (value: string) => void;
};

// The closed popup is unmounted. Supply labels from the declared options so
// the trigger can display them before opening, including on the server.
function readSelectItems(children: React.ReactNode) {
  const items: { value: string; label: React.ReactNode }[] = [];
  function visit(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (node) => {
      if (
        !React.isValidElement<{
          children?: React.ReactNode;
          value?: string;
          label?: string;
        }>(node)
      )
        return;

      if (node.type === SelectItem || node.type === SelectOption) {
        const { value, label, children } = node.props;
        if (value !== undefined)
          items.push({ value, label: label ?? children ?? value });
      } else if (
        node.type === SelectContent ||
        node.type === SelectGroup ||
        node.type === React.Fragment
      ) {
        visit(node.props.children);
      }
    });
  }
  visit(children);
  return items;
}

function Select({
  dir,
  onValueChange,
  items,
  children,
  ...props
}: SelectProps) {
  const select = (
    <SelectPrimitive.Root
      {...props}
      items={items ?? readSelectItems(children)}
      onValueChange={(value) => {
        if (value !== null) onValueChange?.(value);
      }}
    >
      {children}
    </SelectPrimitive.Root>
  );
  return dir ? (
    <DirectionProvider direction={dir}>{select}</DirectionProvider>
  ) : (
    select
  );
}

const SelectOption = SelectPrimitive.Item;
const SelectOptionText = SelectPrimitive.ItemText;
const SelectOptionIndicator = SelectPrimitive.ItemIndicator;
const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpArrow>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpArrow>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpArrow
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpArrow>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpArrow.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownArrow>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownArrow>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownArrow
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownArrow>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownArrow.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Popup>,
  SelectPrimitive.Popup.Props &
    Pick<
      SelectPrimitive.Positioner.Props,
      'side' | 'align' | 'sideOffset' | 'collisionPadding'
    >
>(function SelectContent(
  {
    className,
    children,
    side,
    align,
    sideOffset,
    collisionPadding,
    dir,
    ...props
  },
  ref
) {
  const direction = useDirection();
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="z-50"
        alignItemWithTrigger={false}
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      >
        <SelectPrimitive.Popup
          ref={ref}
          dir={dir ?? direction}
          className={cn(
            'relative max-h-[min(24rem,var(--available-height))] min-w-[max(8rem,var(--anchor-width))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150',
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Popup.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.GroupLabel>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.GroupLabel
    ref={ref}
    className={cn('py-1.5 pe-2 ps-8 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.GroupLabel.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pe-2 ps-8 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  SelectOption,
  SelectOptionText,
  SelectOptionIndicator,
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
