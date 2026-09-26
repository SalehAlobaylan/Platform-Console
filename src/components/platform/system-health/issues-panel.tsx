'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { issueKey, useDismissedIssues } from '@/hooks/use-dismissed-issues';
import type { SystemIssue } from '@/types/platform/system-health';

export function IssuesPanel({
  issues,
  stale = false,
  onInspect,
}: {
  issues: SystemIssue[];
  stale?: boolean;
  onInspect?: (issue: SystemIssue) => void;
}) {
  const { isDismissed, dismiss, clearAll } = useDismissedIssues();
  const [expanded, setExpanded] = useState(false);
  const visible = issues
    .filter((i) => i.severity === 'critical' || !isDismissed(i))
    .sort(
      (a, b) =>
        Number(b.severity === 'critical') - Number(a.severity === 'critical')
    );
  const hiddenCount = issues.length - visible.length;
  const shown = expanded ? visible : visible.slice(0, 4);

  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Check findings</CardTitle>
          <Badge
            variant={
              issues.some((i) => i.severity === 'critical')
                ? 'destructive'
                : issues.length
                  ? 'warning'
                  : 'secondary'
            }
          >
            {issues.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {stale
            ? 'Last known findings; current conditions are unverified.'
            : 'Probe findings, ordered by urgency. These are not confirmed incidents.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {visible.length === 0 ? (
          <div className="rounded-md bg-muted/30 p-4 text-sm">
            <CheckCircle2 className="mb-2 h-5 w-5 text-muted-foreground" />
            <p className="font-medium">
              {issues.length
                ? 'Warnings are snoozed'
                : stale
                  ? 'No findings in the last snapshot'
                  : 'No check findings'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {issues.length
                ? 'They still count in the summary. Snoozing does not resolve an issue.'
                : 'Review incident monitoring for confirmed incidents.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {shown.map((issue) => {
              const critical = issue.severity === 'critical';
              const Icon = critical ? ShieldAlert : AlertTriangle;
              return (
                <li key={issueKey(issue)} className="py-3 first:pt-0">
                  <div className="flex items-center gap-2 text-xs">
                    <Icon
                      className={`h-3.5 w-3.5 ${critical ? 'text-destructive' : 'text-warning'}`}
                      aria-hidden="true"
                    />
                    <span className="font-medium">
                      {critical ? 'Critical' : 'Warning'}
                    </span>
                    <span className="capitalize text-muted-foreground">
                      {issue.service ?? 'Configuration'}
                    </span>
                  </div>
                  <p className="mt-1.5 break-words text-sm" dir="auto">
                    {issue.message}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {onInspect && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onInspect(issue)}
                      >
                        {issue.service
                          ? 'Inspect service'
                          : 'Review configuration'}
                      </Button>
                    )}
                    {!critical && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => dismiss(issue)}
                        aria-label={`Snooze for 4 hours: ${issue.message}`}
                      >
                        <Clock3 className="me-1 h-3 w-3" />
                        Snooze 4h
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {visible.length > 4 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? 'Show fewer findings'
              : `Show all ${visible.length} findings`}
          </Button>
        )}
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={clearAll}
          >
            Restore {hiddenCount} snoozed warning{hiddenCount === 1 ? '' : 's'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
