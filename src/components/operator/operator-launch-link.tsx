'use client';

import Link from 'next/link';
import type { MouseEventHandler } from 'react';
import { Bot } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { persistOperatorLaunchContext } from '@/lib/operator/launch-context';
import { createOperatorLaunchHref } from '@/lib/operator/route-manifest';
import {
  OPERATOR_PATH,
  rememberConsoleLocation,
  useWorkspaceSession,
} from '@/lib/stores/workspace-session';
import type {
  OperatorIntent,
  OperatorVisibleContext,
} from '@/types/platform/operator';

interface OperatorLaunchLinkProps extends Omit<
  ButtonProps,
  'asChild' | 'onClick'
> {
  context: OperatorVisibleContext;
  intent?: OperatorIntent;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children?: React.ReactNode;
}

// Explicit contextual entry attaches next-question context; switching modes does not.
export function OperatorLaunchLink({
  context,
  intent = 'explain',
  children = 'Ask Operator',
  onClick,
  disabled,
  ...buttonProps
}: OperatorLaunchLinkProps) {
  const resume = useWorkspaceSession((state) => state.operatorHref);
  const params = new URLSearchParams(resume.split('?')[1]?.split('#')[0]);
  for (const key of [
    'subject_type',
    'subject_id',
    'selection_id',
    'inspector',
    'evidence_for',
  ])
    params.delete(key);
  new URLSearchParams(
    createOperatorLaunchHref(context, intent).split('?')[1]
  ).forEach((value, key) => params.set(key, value));
  params.set('panel', 'conversation');
  return (
    <Button variant="outline" {...buttonProps} disabled={disabled} asChild>
      <Link
        href={`${OPERATOR_PATH}?${params}`}
        scroll={false}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
          if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          rememberConsoleLocation();
          persistOperatorLaunchContext(context);
        }}
      >
        <Bot className="me-2 size-4" />
        {children}
      </Link>
    </Button>
  );
}
