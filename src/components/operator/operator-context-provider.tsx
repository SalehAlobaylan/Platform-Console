'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from '@/lib/navigation';

import { createRouteVisibleContext, type OperatorContextContribution } from '@/lib/operator/route-manifest';
import type { OperatorVisibleContext } from '@/types/platform/operator';

type OperatorContextValue = {
  context?: OperatorVisibleContext;
  setContribution: (contribution: OperatorContextContribution) => void;
};

const OperatorContext = createContext<OperatorContextValue>({ context: undefined, setContribution: () => undefined });

// One provider sits above every dashboard route, including aliases. Pages may
// contribute only typed navigation hints; cached rows and prose cannot enter.
export function OperatorContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [contribution, setContribution] = useState<OperatorContextContribution>({});
  useEffect(() => { setContribution({}); }, [pathname]);
  const context = useMemo(() => createRouteVisibleContext(pathname, contribution), [pathname, contribution]);
  const value = useMemo(() => ({ context, setContribution }), [context]);
  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>;
}

export function useOperatorPageContext() {
  return useContext(OperatorContext);
}
