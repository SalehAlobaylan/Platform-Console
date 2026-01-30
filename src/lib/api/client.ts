import axios, {
    AxiosError,
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
} from 'axios';
import { getToken, clearAuthState } from '@/lib/stores/auth';

// API Error type
export interface ApiError {
    message: string;
    status: number;
    code?: string;
}

// ApiClient interface as defined in the refactoring plan
export interface ApiClient {
    get<T>(url: string, params?: object): Promise<T>;
    post<T>(url: string, data?: object): Promise<T>;
    put<T>(url: string, data?: object): Promise<T>;
    patch<T>(url: string, data?: object): Promise<T>;
    delete<T>(url: string): Promise<T>;
}

// Error handler function type for custom error handling
type ErrorHandler = (error: ApiError) => void;

// Default error handlers
let on401Handler: ErrorHandler = () => {
    // Clear auth state and redirect to login
    clearAuthState();
    if (typeof window !== 'undefined') {
        window.location.href = '/login';
    }
};

let on403Handler: ErrorHandler = (error) => {
    // Permission denied - will be overridden by AuthProvider to show toast
    console.error('Permission denied:', error.message);
};

// Set custom error handlers
export function setErrorHandlers(handlers: {
    on401?: ErrorHandler;
    on403?: ErrorHandler;
}) {
    if (handlers.on401) on401Handler = handlers.on401;
    if (handlers.on403) on403Handler = handlers.on403;
}

// Create an axios instance with interceptors
function createAxiosInstance(baseURL: string): AxiosInstance {
    const instance = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor - inject JWT token
    instance.interceptors.request.use(
        (config) => {
            const token = getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor - handle errors
    instance.interceptors.response.use(
        (response: AxiosResponse) => response,
        (error: AxiosError<{ message?: string }>) => {
            const apiError: ApiError = {
                message: error.response?.data?.message || error.message || 'An error occurred',
                status: error.response?.status || 500,
                code: error.code,
            };

            // Handle specific status codes
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

// Create an API client from an axios instance
function createApiClient(axiosInstance: AxiosInstance): ApiClient {
    return {
        async get<T>(url: string, params?: object): Promise<T> {
            const config: AxiosRequestConfig = params ? { params } : {};
            const response = await axiosInstance.get<T>(url, config);
            return response.data;
        },

        async post<T>(url: string, data?: object): Promise<T> {
            const response = await axiosInstance.post<T>(url, data);
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

// Environment variables for base URLs
const CMS_BASE_URL = process.env.NEXT_PUBLIC_CMS_BASE_URL || 'http://localhost:8080';
const CRM_BASE_URL = process.env.NEXT_PUBLIC_CRM_BASE_URL || 'http://localhost:8081';

// Create axios instances
const cmsAxios = createAxiosInstance(CMS_BASE_URL);
const crmAxios = createAxiosInstance(CRM_BASE_URL);

// Export pre-configured API clients
export const cmsClient: ApiClient = createApiClient(cmsAxios);
export const crmClient: ApiClient = createApiClient(crmAxios);

// Export a function to create custom clients if needed
export function createClient(baseURL: string): ApiClient {
    return createApiClient(createAxiosInstance(baseURL));
}
