import { api } from '@/lib/api';
import { ApiResponse } from '@/types/common';
import { ChangePasswordRequest, GenericMessageResponse } from '@/types/auth';

export interface DashboardUserResponse {
  userId: string;
  name: string;
  financialProfile?: unknown;
  indicators?: unknown;
  spendingSummary?: Record<string, unknown>;
  topRecommendations?: unknown[];
  financialReserve?: string;
  period?: string;
}

export const userService = {
  async getDashboard(userId: string): Promise<DashboardUserResponse> {
    const { data: response } = await api.get<ApiResponse<DashboardUserResponse>>(`/users/${userId}/dashboard`);

    if (!response.success || !response.data?.name) {
      throw new Error(response.message || 'Resposta de perfil inválida');
    }

    return response.data;
  },

  async changePassword(request: ChangePasswordRequest): Promise<GenericMessageResponse> {
    const { data } = await api.put<GenericMessageResponse>('/users/me/password', request);
    return data;
  },
};
