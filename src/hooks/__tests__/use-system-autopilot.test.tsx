import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

jest.mock('@/lib/api/cms/system-autopilot', () => ({
  getSystemAutopilotStatus: jest.fn(),
  getSystemIncidentEpisode: jest.fn(),
  updateSystemAutopilotPolicy: jest.fn(),
  closeSystemIncidentEpisode: jest.fn(),
  getSystemAutopilotRun: jest.fn(),
  listSystemAutopilotRuns: jest.fn(),
  listSystemIncidentEpisodes: jest.fn(),
  pauseSystemAutopilotContainment: jest.fn(),
  runSystemAutopilotNow: jest.fn(),
}));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));

import {
  getSystemAutopilotStatus,
  getSystemIncidentEpisode,
  listSystemAutopilotRuns,
  listSystemIncidentEpisodes,
  updateSystemAutopilotPolicy,
} from '@/lib/api/cms/system-autopilot';
import { systemHealthKeys } from '@/hooks/use-system-health';
import {
  systemAutopilotKeys,
  useSystemAutopilotStatus,
  useSystemIncidentEpisode,
  useSystemAutopilotRuns,
  useSystemIncidentEpisodes,
  useUpdateSystemAutopilotPolicy,
} from '../use-system-autopilot';

const mockStatus = getSystemAutopilotStatus as jest.MockedFunction<
  typeof getSystemAutopilotStatus
>;
const mockEpisode = getSystemIncidentEpisode as jest.MockedFunction<
  typeof getSystemIncidentEpisode
>;
const mockUpdate = updateSystemAutopilotPolicy as jest.MockedFunction<
  typeof updateSystemAutopilotPolicy
>;

function statusFixture() {
  return {
    state: 'observe' as const,
    policy: {
      scope: 'platform' as const,
      enabled: false,
      mode: 'observe' as const,
      interval_minutes: 10,
      confirm_probes: 2,
      resolve_probes: 3,
      flap_cycles_24h: 3,
      containment_ttl_minutes: 60,
    },
    latest_run: null,
    open_episodes: [],
    recent_episodes: [],
    registered_autopilots: [],
  };
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe('System Health Autopilot hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exposes CMS status success and failure states', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockStatus.mockResolvedValueOnce(statusFixture());
    const success = renderHook(() => useSystemAutopilotStatus(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(success.result.current.isSuccess).toBe(true));
    expect(success.result.current.data?.state).toBe('observe');

    const failingClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockStatus.mockRejectedValueOnce(new Error('CMS unavailable'));
    const failure = renderHook(() => useSystemAutopilotStatus(), {
      wrapper: wrapper(failingClient),
    });
    await waitFor(() => expect(failure.result.current.isError).toBe(true));
    expect(failure.result.current.error).toEqual(new Error('CMS unavailable'));
  });

  it('does not fetch incident detail until an episode id is selected', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const result = renderHook(() => useSystemIncidentEpisode(null), {
      wrapper: wrapper(client),
    });
    expect(result.result.current.fetchStatus).toBe('idle');
    expect(mockEpisode).not.toHaveBeenCalled();
  });

  it('invalidates System Health reads after a policy update', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    mockUpdate.mockResolvedValueOnce({
      ...statusFixture().policy,
      enabled: true,
    });
    const result = renderHook(() => useUpdateSystemAutopilotPolicy(), {
      wrapper: wrapper(client),
    });
    result.result.current.mutate({ enabled: true });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: systemAutopilotKeys.all,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: systemHealthKeys.all });
  });
});


test('closed history sheets do not fetch, then load when opened', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(listSystemAutopilotRuns).mockResolvedValue({ items: [] });
  jest.mocked(listSystemIncidentEpisodes).mockResolvedValue({ items: [] });
  const result = renderHook(({ open }) => ({
    runs: useSystemAutopilotRuns(20, open),
    episodes: useSystemIncidentEpisodes(50, open),
  }), { initialProps: { open: false }, wrapper: wrapper(client) });
  expect(listSystemAutopilotRuns).not.toHaveBeenCalled();
  expect(listSystemIncidentEpisodes).not.toHaveBeenCalled();
  result.rerender({ open: true });
  await waitFor(() => expect(result.result.current.runs.isSuccess).toBe(true));
  expect(listSystemAutopilotRuns).toHaveBeenCalledTimes(1);
  expect(listSystemIncidentEpisodes).toHaveBeenCalledTimes(1);
});
