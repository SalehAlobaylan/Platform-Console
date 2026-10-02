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

// Single in-flight refresh promise shared across all parallel 401-ed requests
let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
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

function createAxiosInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
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

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retried &&
        !originalRequest.url?.includes('/api/auth/')
      ) {
        originalRequest._retried = true;
        const refreshed = await attemptRefresh();
        if (refreshed) {
          return instance(originalRequest);
        }
      }

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
        on401Handler(apiError);
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
