import { Suspense } from 'react';
import RedundancyWorkspace from '@/components/platform/media/redundancy/workspace';

export default function RedundancyPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Loading… / جار التحميل…</p>}>
      <RedundancyWorkspace />
    </Suspense>
  );
}
