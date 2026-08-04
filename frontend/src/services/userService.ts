import { api } from '@/lib/api';
import { ApiResponse } from '@/types/common';

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
};