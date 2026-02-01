/**
 * Test utilities for mocking API responses
 */

export interface MockResponse<T> {
  data: T;
  status: number;
}

export function createMockResponse<T>(data: T, status = 200): MockResponse<T> {
  return { data, status };
}

export function createMockError(message: string, status = 500): Error {
  const error = new Error(message);
  (error as Error & { status?: number }).status = status;
  return error;
}

// Mock API client responses
export function mockApiClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  };
}

// Wait for promises to resolve
export function waitForPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
