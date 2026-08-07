export interface ReportMeta {
  title: string;
  subtitle: string;
  generatedAt: Date;
  periodLabel: string; // "jan/2024 – jul/2026"
  sourceLabel: string; // "dataset-sucesso.csv"
}

export interface ReportSummaryCard {
  label: string;
  value: number;
  format: "currency";
  tone: "positive" | "negative" | "neutral";
}

export interface ReportCategoryRow {
  category: string;
  amount: number;
  percentage: number;
}

export interface ReportMonthlyRow {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface ReportDocument {
  meta: ReportMeta;
  summaryCards: ReportSummaryCard[];
  categoryBreakdown: ReportCategoryRow[];
  monthlySeries: ReportMonthlyRow[];
}
