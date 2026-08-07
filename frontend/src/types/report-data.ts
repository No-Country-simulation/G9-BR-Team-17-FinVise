export interface MonthlySeriesPoint {
  month: string; // "2026-07"
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface ImportSourceInfo {
  displayName: string;
  transactionCount: number;
  categorizedCount: number;
  lastSyncAt: string;
}

/** Tudo que a Dashboard já tem em memória/cache e que o relatório precisa. */
export interface DashboardReportInput {
  summary: FinancialSummary;
  monthlySeries: MonthlySeriesPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  activeSource: ImportSourceInfo | null;
}