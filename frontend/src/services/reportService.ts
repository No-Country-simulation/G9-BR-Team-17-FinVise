import { api } from '@/lib/api';

export const reportService = {
  async downloadFinancialReport(userId: string): Promise<void> {
    const { data } = await api.post<Blob>(
      `/reports/financial/${userId}/export`,
      null,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finvise-relatorio-financeiro.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
