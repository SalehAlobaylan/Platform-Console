import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { getCampaign } from '@/lib/api/cms/embedding-lifecycle';
import { useEmbeddingCampaign } from '../use-embedding-lifecycle';

jest.mock('@/lib/api/cms/embedding-lifecycle', () => ({
  getCampaign: jest.fn(),
}));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));

it('reads final campaign history when work completes even while the active response is fresh', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const get = getCampaign as jest.Mock;
  get.mockResolvedValueOnce({
    campaign: { state: 'running' },
    actions: [],
    exceptions: [],
  });
  get.mockResolvedValueOnce({
    campaign: { state: 'completed' },
    actions: [{ id: 1, status: 'completed' }],
    exceptions: [],
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  const hook = renderHook(({ active }) => useEmbeddingCampaign(10, active), {
    initialProps: { active: true },
    wrapper: Wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.data?.campaign.state).toBe('running')
  );
  hook.rerender({ active: false });
  await waitFor(() =>
    expect(hook.result.current.data?.actions).toHaveLength(1)
  );
  expect(get).toHaveBeenCalledTimes(2);
  hook.unmount();
  client.clear();
});
