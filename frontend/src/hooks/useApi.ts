import { useMutation, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiResponse } from '@/types/common';

export function useApiQuery<T>(
  key: unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const { data: response } = await api.get<ApiResponse<T>>(url);
      return response.data;
    },
    ...options,
  });
}

export function useApiMutation<TRequest, TResponse>(url: string, method: 'post' | 'put' | 'patch' | 'delete' = 'post') {
  return useMutation<TResponse, unknown, TRequest>({
    mutationFn: async (payload) => {
      const { data: response } = await api[method]<ApiResponse<TResponse>>(url, payload);
      return response.data;
    },
  });
}
