import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the API client
jest.mock('@/lib/api/cms/sources', () => ({
  listSources: jest.fn(),
  getSource: jest.fn(),
}));

import { listSources, getSource } from '@/lib/api/cms/sources';
import { useSources, useSource, sourceKeys } from '../use-sources';

const mockListSources = listSources as jest.MockedFunction<typeof listSources>;
const mockGetSource = getSource as jest.MockedFunction<typeof getSource>;

// Create a wrapper with QueryClient for testing
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSources hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch sources list successfully', async () => {
    const mockData = {
      data: [
        { id: '1', name: 'Source 1', type: 'RSS', is_active: true },
        { id: '2', name: 'Source 2', type: 'PODCAST', is_active: false },
      ],
      total: 2,
      page: 1,
      limit: 10,
      total_pages: 1,
    };

    mockListSources.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useSources({ page: 1, limit: 10 }), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockListSources).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('should handle error when fetching sources fails', async () => {
    const error = new Error('Failed to fetch sources');
    mockListSources.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSources(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should use correct query keys for caching', () => {
    const params = { page: 1, limit: 10, search: 'test' };
    const keys = sourceKeys.list(params);

    expect(keys).toEqual(['sources', 'list', params]);
  });
});

describe('useSource hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch single source successfully', async () => {
    const mockSource = {
      id: '1',
      name: 'Test Source',
      type: 'RSS',
      is_active: true,
      fetch_interval_minutes: 60,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockGetSource.mockResolvedValueOnce(mockSource);

    const { result } = renderHook(() => useSource('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSource);
    expect(mockGetSource).toHaveBeenCalledWith('1');
  });

  it('should not fetch when id is empty', () => {
    const { result } = renderHook(() => useSource(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should use correct query key for single source', () => {
    const keys = sourceKeys.detail('123');
    expect(keys).toEqual(['sources', 'detail', '123']);
  });
});
