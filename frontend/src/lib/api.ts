import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { ApiError } from '@/types/common';

const API_BASE_URL =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_BASE_URL) || '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('finance_ai_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'Erro inesperado',
      code: error.response?.data?.code,
      status: error.response?.status,
    };

    if (error.response?.status === 401) {
      localStorage.removeItem('finance_ai_token');
      localStorage.removeItem('finance_ai_user_id');
      window.location.href = '/login';
    }

    return Promise.reject(apiError);
  }
);

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiError)?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'Ocorreu um erro inesperado';
}
