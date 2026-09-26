import type { SystemContainmentTargetProjection } from '@/types/platform/system-autopilot';

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
  if (!targets.length)
    return (
      <p className="text-sm text-muted-foreground">
        No containment targets recorded.
      </p>
    );
  return (
    <ul className="space-y-2" aria-label="Containment targets">
      {targets.map((target) => (
        <li
          key={`${target.episode_id}:${target.sibling}:${target.tenant_id}`}
          className="space-y-1 rounded-md border p-3 text-sm"
        >
          <p className="font-medium">
            {target.sibling.replaceAll('_', ' ')} ·{' '}
            {outcomes[target.outcome] ?? target.outcome.replaceAll('_', ' ')}
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
          {target.outcome === 'paused' && (
            <p className="text-xs text-muted-foreground">
              New automation work is paused; previously accepted work may
              finish.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
