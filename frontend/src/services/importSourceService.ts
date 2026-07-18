import { api } from '@/lib/api';
import { ApiResponse } from '@/types/common';

export type ImportSourceType = 'CSV' | 'OPEN_FINANCE';

export interface ImportSource {
  id: string;
  type: ImportSourceType;
  displayName: string;
  provider: string | null;
  status: string;
  transactionCount: number;
  categorizedCount: number;
  sizeBytes: number | null;
  createdAt: string;
  lastSyncAt: string | null;
  errorMessage: string | null;
  defaultSource: boolean;
}

export const importSourceService = {
  async getAll(): Promise<ImportSource[]> {
    const { data: response } = await api.get<ApiResponse<ImportSource[]>>('/imports/sources');
    return response.data;
  },

  async setDefault(source: ImportSource): Promise<void> {
    await api.put(`/imports/sources/${source.type}/${source.id}/default`, null);
  },

  async delete(source: ImportSource): Promise<void> {
    await api.delete(`/imports/sources/${source.type}/${source.id}`);
  },
};
