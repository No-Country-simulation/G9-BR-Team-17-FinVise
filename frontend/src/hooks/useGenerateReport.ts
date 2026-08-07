import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { TransactionSource } from "@/types/transaction";
import { buildReportDocument } from "@/components/report-pdf/BuildReportDocument";
import { renderReportDocument } from "@/components/report-pdf/ReportDocumentRender";
import { downloadReport } from "@/components/report-pdf/DownloadReport";
import { DashboardReportInput } from "@/types/report-data";

interface UseGenerateReportParams {
  source: TransactionSource;
  importSourceId?: string;
}

export function useGenerateReport({ source, importSourceId }: UseGenerateReportParams) {
  const queryClient = useQueryClient();

  const generate = useCallback(() => {
    const summary = queryClient.getQueryData(['transactions', 'summary', source, importSourceId]);
    const monthlySummary = queryClient.getQueryData(['transactions', 'monthly-summary', source, importSourceId]);
    const categorySummary = queryClient.getQueryData(['transactions', 'category-summary', source, importSourceId]);
    const importSources = queryClient.getQueryData<Array<{
      id: string;
      displayName: string;
      transactionCount: number;
      categorizedCount: number;
      lastSyncAt: string;
      defaultSource: boolean;
    }>>(['import-sources']);

    const input = normalizeDashboardCache({
      summary,
      monthlySummary,
      categorySummary,
      importSources,
      importSourceId,
    });

    if (!input) {
      throw new Error("Dados do dashboard ainda não carregados. Aguarde o carregamento antes de gerar o relatório.");
    }

    const document = buildReportDocument(input);
    const pdf = renderReportDocument(document);
    downloadReport(pdf);
  }, [queryClient, source, importSourceId]);

  return { generate };
}

function normalizeDashboardCache(raw: {
  summary: any;
  monthlySummary: any;
  categorySummary: any;
  importSources: any[] | undefined;
  importSourceId?: string;
}): DashboardReportInput | null {
  if (!raw.summary || !raw.monthlySummary || !raw.categorySummary) return null;

  const activeSource = raw.importSources?.find((s) => s.id === raw.importSourceId)
    ?? raw.importSources?.find((s) => s.defaultSource)
    ?? raw.importSources?.[0];

  return {
    summary: raw.summary, // já é { totalIncome, totalExpense, balance }
    monthlySeries: raw.monthlySummary, // já é MonthlyPoint[]
    categoryBreakdown: raw.categorySummary, // já é { category, amount }[]
    activeSource: activeSource
      ? {
          displayName: activeSource.displayName,
          transactionCount: activeSource.transactionCount,
          categorizedCount: activeSource.categorizedCount,
          lastSyncAt: activeSource.lastSyncAt,
        }
      : null,
  };
}