'use client';

import Link from '@/lib/console-link';
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
  'render' | 'onClick'
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
  const content = (
    <>
      <Bot className="me-2 size-4" />
      {children}
    </>
  );
  if (disabled) {
    return (
      <Button
        variant="outline"
        {...buttonProps}
        className={`cursor-not-allowed opacity-50 ${buttonProps.className ?? ''}`}
        render={
          <span role="link" aria-disabled="true">
            {content}
          </span>
        }
      />
    );
  }
  return (
    <Button
      variant="outline"
      {...buttonProps}
      render={
        <Link
          href={`${OPERATOR_PATH}?${params}`}
          scroll={false}
          onClick={(event) => {
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
          {content}
        </Link>
      }
    />
  );
}
