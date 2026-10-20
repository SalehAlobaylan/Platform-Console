import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as api from '@/lib/api/cms/workload';
import { useWorkloadStatus, useWorkloadVisible } from '../use-workload';
import { status } from '@/components/platform/workload/__tests__/fixtures';
jest.mock('@/lib/api/cms/workload');
let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  jest.clearAllMocks();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
it('does not begin polling while the page is hidden and resumes on visibility', async () => {
  visibility = 'hidden';
  (api.getWorkloadStatus as jest.Mock).mockResolvedValue(status);
  const { wrapper, client } = setup();
  const view = renderHook(() => useWorkloadStatus(true), { wrapper });
  expect(api.getWorkloadStatus).not.toHaveBeenCalled();
  act(() => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => expect(view.result.current.data).toEqual(status));
  expect(api.getWorkloadStatus).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});
it('aborts the active read when its observer unmounts', async () => {
  let signal: AbortSignal | undefined;
  (api.getWorkloadStatus as jest.Mock).mockImplementation(
    (input: AbortSignal) => {
      signal = input;
      return new Promise(() => {});
    }
  );
  const { wrapper, client } = setup();
  const view = renderHook(() => useWorkloadStatus(true), { wrapper });
  await waitFor(() => expect(signal).toBeInstanceOf(AbortSignal));
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
  client.clear();
});
it('removes visibility listeners when leaving the workspace', () => {
  const add = jest.spyOn(document, 'addEventListener'),
    remove = jest.spyOn(document, 'removeEventListener');
  const view = renderHook(() => useWorkloadVisible());
  const handler = add.mock.calls.find(
    ([event]) => event === 'visibilitychange'
  )?.[1];
  view.unmount();
  expect(remove).toHaveBeenCalledWith('visibilitychange', handler);
  add.mockRestore();
  remove.mockRestore();
});
it('keeps disabled sections from issuing reads', () => {
  const { wrapper, client } = setup();
  const view = renderHook(() => useWorkloadStatus(false), { wrapper });
  expect(api.getWorkloadStatus).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
