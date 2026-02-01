import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the API client
jest.mock('@/lib/api/crm/customers', () => ({
  listCustomers: jest.fn(),
  getCustomer: jest.fn(),
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
}));

import {
  listCustomers,
  getCustomer,
  createCustomer,
  deleteCustomer,
} from '@/lib/api/crm/customers';
import {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useDeleteCustomer,
  customerKeys,
} from '../use-customers';

const mockListCustomers = listCustomers as jest.MockedFunction<
  typeof listCustomers
>;
const mockGetCustomer = getCustomer as jest.MockedFunction<typeof getCustomer>;
const mockCreateCustomer = createCustomer as jest.MockedFunction<
  typeof createCustomer
>;
const mockDeleteCustomer = deleteCustomer as jest.MockedFunction<
  typeof deleteCustomer
>;

// Mock toast
jest.mock('@/components/ui/toast', () => ({
  toast: jest.fn(),
}));

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

describe('useCustomers hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch customers list with pagination', async () => {
    const mockData = {
      data: [
        {
          id: '1',
          name: 'Customer 1',
          email: 'cust1@example.com',
          status: 'active',
        },
        {
          id: '2',
          name: 'Customer 2',
          email: 'cust2@example.com',
          status: 'lead',
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      total_pages: 1,
    };

    mockListCustomers.mockResolvedValueOnce(mockData);

    const { result } = renderHook(
      () => useCustomers({ page: 1, limit: 10, search: 'test' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockListCustomers).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: 'test',
    });
  });

  it('should handle empty params', async () => {
    const mockData = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      total_pages: 0,
    };

    mockListCustomers.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCustomers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListCustomers).toHaveBeenCalledWith({});
  });
});

describe('useCustomer hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch single customer', async () => {
    const mockCustomer = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
    };

    mockGetCustomer.mockResolvedValueOnce(mockCustomer);

    const { result } = renderHook(() => useCustomer('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCustomer);
  });

  it('should not fetch when id is empty', () => {
    const { result } = renderHook(() => useCustomer(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateCustomer hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create customer and invalidate list', async () => {
    const newCustomer = {
      id: '3',
      name: 'New Customer',
      email: 'new@example.com',
      status: 'lead',
    };

    mockCreateCustomer.mockResolvedValueOnce(newCustomer);

    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'New Customer',
      email: 'new@example.com',
      status: 'lead',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith({
      name: 'New Customer',
      email: 'new@example.com',
      status: 'lead',
    });
  });
});

describe('useDeleteCustomer hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete customer and invalidate list', async () => {
    mockDeleteCustomer.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteCustomer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDeleteCustomer).toHaveBeenCalledWith('1');
  });
});

describe('customerKeys', () => {
  it('should generate correct query keys', () => {
    expect(customerKeys.all).toEqual(['customers']);
    expect(customerKeys.lists()).toEqual(['customers', 'list']);
    expect(customerKeys.list({ page: 1, limit: 10 })).toEqual([
      'customers',
      'list',
      { page: 1, limit: 10 },
    ]);
    expect(customerKeys.details()).toEqual(['customers', 'detail']);
    expect(customerKeys.detail('123')).toEqual(['customers', 'detail', '123']);
    expect(customerKeys.contacts('123')).toEqual([
      'customers',
      'detail',
      '123',
      'contacts',
    ]);
  });
});
