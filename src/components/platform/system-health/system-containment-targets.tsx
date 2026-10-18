'use client';

import type { SystemContainmentTargetProjection } from '@/types/platform/system-autopilot';
import { useObservationClock } from '@/hooks/use-observation-clock';

const outcomes: Record<string, string> = {
  paused: 'Pause active',
  release_pending: 'Release pending',
  human_owned: 'Human override',
  human_released: 'Released by a human',
  resumed: 'Released by System Health',
  expired: 'Lease expired',
  unknown: 'Ownership unverified',
};

export function SystemContainmentTargets({
  targets,
}: {
  targets: SystemContainmentTargetProjection[];
}) {
  const now = useObservationClock(targets.length > 0);
  if (!targets.length)
    return (
      <p className="text-sm text-muted-foreground">
        No containment targets recorded.
      </p>
    );
  return (
    <ul className="space-y-2" aria-label="Containment targets">
      {targets.map((target) => {
        const expired =
          ['paused', 'release_pending'].includes(target.outcome) &&
          !!target.until &&
          new Date(target.until).getTime() <= now;
        const outcome = expired ? 'expired' : target.outcome;
        return (
          <li
            key={`${target.episode_id}:${target.sibling}:${target.tenant_id}`}
            className="space-y-1 rounded-md border p-3 text-sm"
          >
            <p className="font-medium">
              {target.sibling.replaceAll('_', ' ')} ·{' '}
              {outcomes[outcome] ?? outcome.replaceAll('_', ' ')}
            </p>
            <p className="break-all text-xs">
              Tenant: <span dir="ltr">{target.tenant_id}</span>
            </p>
            {target.until && (
              <p className="text-xs text-muted-foreground">
                Pause expiry: {new Date(target.until).toLocaleString()}
              </p>
            )}
            {target.reason && (
              <p className="text-xs text-muted-foreground">{target.reason}</p>
            )}
            {outcome === 'paused' && (
              <p className="text-xs text-muted-foreground">
                {target.effect_scope ??
                  (target.sibling === 'pipeline'
                    ? 'Observe-only cockpit pause; canonical pipeline repairs are not stopped by this policy'
                    : 'Policy pause recorded; native admission enforcement has not been reported by CMS')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
