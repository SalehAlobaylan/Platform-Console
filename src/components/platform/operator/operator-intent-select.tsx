'use client';

import { useId } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import {
  Check,
  GitCompare,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Search,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OperatorIntent } from '@/types/platform/operator';
import { cn } from '@/lib/utils';
import { operatorCopy, type OperatorLocale } from './operator-copy';

const intentIcons = {
  explain: MessageSquare,
  investigate: Search,
  compare: GitCompare,
  recommend: Lightbulb,
  resolve: ListChecks,
};

export function OperatorIntentSelect({
  locale,
  value,
  allowed,
  disabled,
  onChange,
  compact = false,
}: {
  locale: OperatorLocale;
  value: OperatorIntent;
  allowed: readonly OperatorIntent[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (intent: OperatorIntent) => void;
}) {
  const id = useId();
  const t = operatorCopy(locale);
  const labels: Record<OperatorIntent, string> = {
    explain: t.ask,
    investigate: t.investigate,
    compare: t.compare,
    recommend: t.recommend,
    resolve: t.resolve,
  };
  const Icon = intentIcons[value];
  return (
    <Select
      value={value}
      onValueChange={(intent) => {
        if (allowed.includes(intent as OperatorIntent))
          onChange(intent as OperatorIntent);
      }}
      disabled={disabled}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <SelectTrigger
        aria-label={t.mode}
        title={t.modeDescriptions[value]}
        className={cn(
          'h-9 min-w-0 gap-1.5 px-2 text-xs shadow-none hover:bg-muted [&>span]:truncate',
          compact
            ? 'w-full border-0 bg-transparent sm:w-auto sm:shrink-0'
            : 'w-auto shrink-0 border-input bg-muted/30 sm:text-sm'
        )}
      >
        <Icon
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground',
            compact && 'hidden sm:block'
          )}
          aria-hidden="true"
        />
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="max-h-[min(28rem,var(--radix-select-content-available-height))] w-[min(340px,calc(100vw-2rem))]"
      >
        <SelectGroup>
          <SelectLabel className="px-3 pb-2 pt-2 text-xs font-medium text-muted-foreground">
            {t.mode}
          </SelectLabel>
          {allowed.map((intent) => {
            const OptionIcon = intentIcons[intent];
            return (
              <SelectPrimitive.Item
                key={intent}
                value={intent}
                textValue={labels[intent]}
                aria-describedby={`${id}-${intent}-description`}
                className="relative flex cursor-pointer select-none items-start gap-3 rounded-md px-3 py-2.5 outline-none data-[highlighted]:bg-accent data-[state=checked]:bg-primary/5 data-[highlighted]:text-accent-foreground"
              >
                <OptionIcon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    value === intent ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 text-start">
                  <SelectPrimitive.ItemText className="text-sm font-medium">
                    {labels[intent]}
                  </SelectPrimitive.ItemText>
                  <p
                    id={`${id}-${intent}-description`}
                    className="mt-0.5 text-xs leading-5 text-muted-foreground"
                  >
                    {t.modeDescriptions[intent]}
                  </p>
                </div>
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-primary"
                  aria-hidden="true"
                >
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
