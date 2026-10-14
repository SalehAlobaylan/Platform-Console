'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSystemHealth } from '@/hooks/use-system-health';
import { useFeedIntegrityStatus } from '@/hooks/use-feed-integrity';

function OwnerEvidence() {
  const system = useSystemHealth();
  const feed = useFeedIntegrityStatus();
  const timestamp = system.data?.timestamp;
  const fresh =
    timestamp && Date.now() - new Date(timestamp).getTime() <= 45_000;
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>
        <Link className="underline" href="/platform/system-health">
          System Health
        </Link>{' '}
        ·{' '}
        {system.isError
          ? 'Probe evidence unavailable'
          : !timestamp
            ? 'No probe evidence'
            : `${system.data?.overall || 'unknown'} service probes · ${fresh ? 'current' : 'stale'} snapshot ${new Date(timestamp).toLocaleString()}`}
      </p>
      <p>
        <Link className="underline" href="/platform/feed-integrity">
          Feed Integrity
        </Link>{' '}
        ·{' '}
        {feed.isError
          ? 'Synthetic evidence unavailable'
          : feed.data?.headline ||
            (feed.data?.latest_run
              ? `Latest synthetic run: ${feed.data.latest_run.status}`
              : 'No synthetic run evidence')}
      </p>
      <p className="text-xs text-muted-foreground">
        Service probes and synthetic checks support investigation. Real
        Experience health uses its own client journey outcomes and decision
        windows.
      </p>
    </div>
  );
}

export function RelatedExperienceEvidence() {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-md border p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Related reliability evidence
      </summary>
      {open && <OwnerEvidence />}
    </details>
  );
}
