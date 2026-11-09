'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from '@/lib/navigation';

import { useOperatorPageContext } from '@/components/operator/operator-context-provider';
import { createRouteVisibleContext, type OperatorContextContribution } from '@/lib/operator/route-manifest';

// A page can contribute only its typed location/selection hints. This hook
// deliberately returns no cached row data, authority, or action definition.
export function useOperatorContextContribution(contribution: OperatorContextContribution = {}) {
  const pathname = usePathname();
  const { setContribution } = useOperatorPageContext();
  const context = useMemo(() => createRouteVisibleContext(pathname, contribution), [pathname, contribution]);
  useEffect(() => {
    setContribution(contribution);
    return () => setContribution({});
  }, [contribution, setContribution]);
  return context;
}
