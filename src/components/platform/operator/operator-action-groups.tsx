'use client';

import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OperatorAction } from '@/hooks/use-operator';
import {
  actionLabel,
  operatorCopy,
  operatorDomainLabel,
  type OperatorLocale,
} from './operator-copy';

export type OperatorActionRecommendation = {
  id: string;
  rank: number;
  title: string;
  summary: string;
  deep_link: string;
  manual_only: boolean;
};

type ManualAction = Extract<OperatorAction, { kind: 'manual' }>;
type Workflow = {
  key: string;
  href: string;
  domain?: string;
  tasks: ManualAction[];
  recommendations: OperatorActionRecommendation[];
};

function groupWorkflows(
  actions: OperatorAction[],
  recommendations: OperatorActionRecommendation[]
) {
  const groups = new Map<string, Workflow>();
  for (const action of actions) {
    if (action.kind !== 'manual') continue;
    // Exact owner and URL preserve record/query scopes; labels never authorize work.
    const key = `${action.affected_domain}\0${action.deep_link}`;
    const group: Workflow = groups.get(key) ?? {
      key,
      href: action.deep_link,
      domain: action.affected_domain,
      tasks: [],
      recommendations: [],
    };
    group.tasks.push(action);
    groups.set(key, group);
  }
  for (const recommendation of recommendations) {
    const matches = [...groups.values()].filter(
      (group) => group.href === recommendation.deep_link && group.domain
    );
    const key = `inspect\0${recommendation.deep_link}`;
    const group: Workflow =
      matches.length === 1
        ? matches[0]
        : (groups.get(key) ?? {
            key,
            href: recommendation.deep_link,
            tasks: [],
            recommendations: [],
          });
    group.recommendations.push(recommendation);
    groups.set(group.key, group);
  }
  const priority = (group: Workflow) =>
    Math.min(
      Number.MAX_SAFE_INTEGER,
      ...group.recommendations
        .filter((item) => item.rank > 0)
        .map((item) => item.rank)
    );
  return [...groups.values()].sort(
    (left, right) => priority(left) - priority(right)
  );
}

export function OperatorActionGroups({
  locale,
  actions,
  recommendations,
  onPrepare,
  compact = false,
  onAllActions,
  narrow = false,
}: {
  locale: OperatorLocale;
  actions: OperatorAction[];
  recommendations: OperatorActionRecommendation[];
  onPrepare: (action: Extract<OperatorAction, { kind: 'plan' }>) => void;
  compact?: boolean;
  narrow?: boolean;
  onAllActions?: () => void;
}) {
  const t = operatorCopy(locale);
  const plans = actions.filter((action) => action.kind === 'plan');
  const workflows = groupWorkflows(actions, recommendations);
  if (!plans.length && !workflows.length) return null;
  if (compact) {
    const firstPlan = plans.find((action) =>
      actionLabel(action.localized_action_key, locale)
    );
    const firstWorkflow = workflows[0];
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        role="region"
        aria-label={t.groupedActions}
      >
        {firstPlan ? (
          <Button size="sm" onClick={() => onPrepare(firstPlan)}>
            {t.reviewPlan}
          </Button>
        ) : firstWorkflow ? (
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link href={firstWorkflow.href}>
              {firstWorkflow.tasks.length ? t.manualAction : t.openRecord}
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={onAllActions}
        >
          {t.allActions}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Button>
      </div>
    );
  }
  return (
    <section className="space-y-5 p-4 sm:p-5" aria-label={t.groupedActions}>
      <h3 className="text-sm font-semibold">{t.groupedActions}</h3>
      {plans.length ? (
        <section className="space-y-3" aria-label={t.planActions}>
          <div>
            <h4 className="text-sm font-medium">
              {t.planActions} ({plans.length})
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t.planActionsDescription}
            </p>
          </div>
          <div className="divide-y">
            {plans.map((action) => {
              const label = actionLabel(action.localized_action_key, locale);
              return (
                <div
                  key={action.key}
                  className={
                    narrow
                      ? 'flex flex-col gap-3 py-3 first:pt-0'
                      : 'flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between'
                  }
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {label ?? t.unavailable}
                      </p>
                      <Badge
                        variant={
                          action.risk_tier === 'high_impact'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {action.risk_tier === 'high_impact'
                          ? t.highImpact
                          : t.routine}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.selectedRecords}: {action.target_ids.length} ·{' '}
                      {action.affected_domains
                        .map((domain) => operatorDomainLabel(domain, locale))
                        .join(' · ')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!label}
                    onClick={() => onPrepare(action)}
                  >
                    {t.reviewPlan}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {workflows.length ? (
        <section className="space-y-3" aria-label={t.workflowActions}>
          <div>
            <h4 className="text-sm font-medium">
              {t.workflowActions} ({workflows.length})
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t.workflowActionsDescription}
            </p>
          </div>
          <div className="divide-y">
            {workflows.map((workflow) => (
              <article key={workflow.key} className="space-y-3 py-3 first:pt-0">
                <div
                  className={
                    narrow
                      ? 'flex flex-col gap-3'
                      : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
                  }
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-medium" dir="auto">
                        {workflow.domain
                          ? operatorDomainLabel(workflow.domain, locale)
                          : workflow.recommendations[0]?.title}
                      </h5>
                      {workflow.recommendations.some(
                        (item) => item.rank === 1
                      ) ? (
                        <Badge variant="secondary">{t.recommended}</Badge>
                      ) : null}
                    </div>
                    {workflow.recommendations.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs leading-5 text-muted-foreground"
                        dir="auto"
                      >
                        {workflow.domain ||
                        workflow.recommendations.length > 1 ? (
                          <p className="font-medium text-foreground">
                            {item.title}
                          </p>
                        ) : null}
                        <p>{item.summary}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    <Link href={workflow.href}>
                      {workflow.tasks.length ? t.manualAction : t.openRecord}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </div>
                {workflow.tasks.length ? (
                  <details className="group text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90"
                      />
                      {t.supportedTasks} ({workflow.tasks.length})
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                      {workflow.tasks.map((task, index) => (
                        <li key={`${task.localized_action_key}-${index}`}>
                          {actionLabel(task.localized_action_key, locale) ??
                            t.unavailable}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
