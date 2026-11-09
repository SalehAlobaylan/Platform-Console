import { consoleRuntime } from '@/lib/runtime-config';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { clearAuthState } from '@/lib/stores/auth';
import { recoverSession } from '@/lib/auth-session';

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
};

let on403Handler: ErrorHandler = (error) => {
  console.error('Permission denied:', error.message);
};
let onSessionUnavailable = () => {};

export function setErrorHandlers(handlers: {
  on401?: ErrorHandler;
  on403?: ErrorHandler;
  onSessionUnavailable?: () => void;
}) {
  if (handlers.on401) on401Handler = handlers.on401;
  if (handlers.on403) on403Handler = handlers.on403;
  if (handlers.onSessionUnavailable) onSessionUnavailable = handlers.onSessionUnavailable;
}

function createAxiosInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    // Array params serialize as repeated keys (a=1&a=2) — the CMS query
    // parser reads repeated keys; its filter fields reject bracket syntax.
    paramsSerializer: { indexes: null },
  });

  instance.interceptors.request.use((config) => {
    const runtime = consoleRuntime().runtimeId;
    if (runtime) config.headers.set('X-Wahb-Runtime-ID', runtime);
    return config;
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
        const session = await recoverSession();
        if (session.state === 'valid') {
          if (session.refreshed && originalRequest && !originalRequest._retried) {
            originalRequest._retried = true;
            return instance(originalRequest);
          }
          apiError.code = 'upstream_authentication_failed';
        } else if (session.state === 'signed_out' || session.state === 'runtime_changed') {
          apiError.code = session.state;
          on401Handler(apiError);
        } else {
          onSessionUnavailable();
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
