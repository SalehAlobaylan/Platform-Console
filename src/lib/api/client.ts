import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { clearAuthState } from '@/lib/stores/auth';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export interface ApiClient {
  get<T>(url: string, params?: object, signal?: AbortSignal): Promise<T>;
  post<T>(url: string, data?: object, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: object): Promise<T>;
  patch<T>(url: string, data?: object): Promise<T>;
  delete<T>(url: string): Promise<T>;
}

type ErrorHandler = (error: ApiError) => void;

let on401Handler: ErrorHandler = () => {
  clearAuthState();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

let on403Handler: ErrorHandler = (error) => {
  console.error('Permission denied:', error.message);
};

export function setErrorHandlers(handlers: {
  on401?: ErrorHandler;
  on403?: ErrorHandler;
}) {
  if (handlers.on401) on401Handler = handlers.on401;
  if (handlers.on403) on403Handler = handlers.on403;
}

// Share recovery across clients without caching authentication decisions.
type RefreshState = 'refreshed' | 'expired' | 'unknown';
let refreshInFlight: Promise<RefreshState> | null = null;
type SessionState = 'valid' | 'expired' | 'unknown';
let sessionCheckInFlight: Promise<SessionState> | null = null;

async function authRequest(
  path: string,
  method: 'GET' | 'POST',
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(path, {
      method,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptRefresh(): Promise<RefreshState> {
  if (!refreshInFlight) {
    refreshInFlight = authRequest('/api/auth/refresh', 'POST', 10_000)
      .then(
        (res): RefreshState =>
          res.ok ? 'refreshed' : res.status === 401 ? 'expired' : 'unknown'
      )
      .catch((): RefreshState => 'unknown')
      .finally(() => {
        // small delay so concurrent requests that started while refresh
        // was pending see the resolved value before nulling
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      });
  }
  return refreshInFlight;
}

// A service can reject a token even while IAM still recognizes the operator.
// Only an authoritative session rejection should clear the Console session;
// network failures and upstream token-contract errors remain request errors.
function inspectSession(): Promise<SessionState> {
  if (!sessionCheckInFlight) {
    sessionCheckInFlight = authRequest('/api/auth/me', 'GET', 5_000)
      .then(
        (res): SessionState =>
          res.ok ? 'valid' : res.status === 401 ? 'expired' : 'unknown'
      )
      .catch((): SessionState => 'unknown')
      .finally(() => {
        sessionCheckInFlight = null;
      });
  }
  return sessionCheckInFlight;
}

function createAxiosInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID
        ? { 'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID }
        : {}),
    },
    withCredentials: true,
    // Array params serialize as repeated keys (a=1&a=2) — the CMS query
    // parser reads repeated keys; its filter fields reject bracket syntax.
    paramsSerializer: { indexes: null },
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError<{ message?: string; error?: string }>) => {
      const originalRequest = error.config as
        | (InternalAxiosRequestConfig & { _retried?: boolean })
        | undefined;

      const apiError: ApiError = {
        message:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'An error occurred',
        status: error.response?.status || 500,
        code: error.code,
      };

      if (apiError.status === 401) {
        if (originalRequest?.url?.includes('/api/auth/')) {
          on401Handler(apiError);
        } else {
          const session = await inspectSession();
          if (session === 'expired') {
            if (originalRequest && !originalRequest._retried) {
              originalRequest._retried = true;
              const refresh = await attemptRefresh();
              if (refresh === 'refreshed') return instance(originalRequest);
              if (refresh === 'unknown') return Promise.reject(apiError);
            }
            on401Handler(apiError);
          } else if (session === 'valid') {
            apiError.code = 'upstream_authentication_failed';
          }
        }
      } else if (apiError.status === 403) {
        on403Handler(apiError);
      }

      return Promise.reject(apiError);
    }
  );

  return instance;
}

function createApiClient(axiosInstance: AxiosInstance): ApiClient {
  return {
    async get<T>(
      url: string,
      params?: object,
      signal?: AbortSignal
    ): Promise<T> {
      const config: AxiosRequestConfig = {
        ...(params ? { params } : {}),
        signal,
      };
      const response = await axiosInstance.get<T>(url, config);
      return response.data;
    },

    async post<T>(
      url: string,
      data?: object,
      config?: AxiosRequestConfig
    ): Promise<T> {
      const response = await axiosInstance.post<T>(url, data, config);
      return response.data;
    },

    async put<T>(url: string, data?: object): Promise<T> {
      const response = await axiosInstance.put<T>(url, data);
      return response.data;
    },

    async patch<T>(url: string, data?: object): Promise<T> {
      const response = await axiosInstance.patch<T>(url, data);
      return response.data;
    },

    async delete<T>(url: string): Promise<T> {
      const response = await axiosInstance.delete<T>(url);
      return response.data;
    },
  };
}

const cmsAxios = createAxiosInstance('/api/cms');
const iamAxios = createAxiosInstance('/api/iam');

export const cmsClient: ApiClient = createApiClient(cmsAxios);
export const iamClient: ApiClient = createApiClient(iamAxios);

export function createClient(baseURL: string): ApiClient {
  return createApiClient(createAxiosInstance(baseURL));
}
