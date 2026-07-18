import { api } from '@/lib/api';
import { ApiResponse } from '@/types/common';
import { ProfileAnalysisModel } from '@/types/analysis';

export interface OpenFinanceStatus {
  configured: boolean;
  provider: string;
  includeSandbox: boolean;
}

export interface OpenFinanceConnectToken {
  accessToken: string;
  provider: string;
  includeSandbox: boolean;
}

interface OpenFinanceSyncBackendResponse {
  importedCount: number;
  skippedCount: number;
  analysis: unknown;
}

export const openFinanceService = {
  async getStatus(): Promise<OpenFinanceStatus> {
    const { data: response } = await api.get<ApiResponse<OpenFinanceStatus>>('/open-finance/status');
    return response.data;
  },

  async createConnectToken(): Promise<OpenFinanceConnectToken> {
    const { data: response } = await api.post<ApiResponse<OpenFinanceConnectToken>>(
      '/open-finance/connect-token',
      null,
    );
    return response.data;
  },

  async synchronize(itemId: string, model: ProfileAnalysisModel): Promise<{
    importedCount: number;
    skippedCount: number;
    analysisId: string;
  }> {
    const { data: response } = await api.post<ApiResponse<OpenFinanceSyncBackendResponse>>(
      `/open-finance/items/${encodeURIComponent(itemId)}/sync`,
      { model },
    );
    return {
      importedCount: response.data.importedCount,
      skippedCount: response.data.skippedCount,
      analysisId: (response.data.analysis as { analysisId: string }).analysisId,
    };
  },
};
