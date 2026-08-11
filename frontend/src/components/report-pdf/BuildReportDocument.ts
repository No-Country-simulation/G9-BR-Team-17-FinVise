import { DashboardReportInput } from "@/types/report-data";
import { ReportDocument } from "@/types/report-document";


export function buildReportDocument(input: DashboardReportInput): ReportDocument {
  const { summary, monthlySeries, categoryBreakdown, activeSource } = input;

  const totalCategoryAmount = categoryBreakdown.reduce((acc, c) => acc + c.amount, 0);

  return {
    meta: {
      title: "Relatório Financeiro",
      subtitle: "Visão geral da saúde financeira",
      generatedAt: new Date(),
      periodLabel: buildPeriodLabel(monthlySeries),
      sourceLabel: activeSource?.displayName ?? "Fonte não identificada",
    },
    summaryCards: [
      { label: "Total de Receitas", value: summary.totalIncome, format: "currency", tone: "positive" },
      { label: "Total de Despesas", value: summary.totalExpense, format: "currency", tone: "negative" },
      {
        label: "Saldo",
        value: summary.balance,
        format: "currency",
        tone: summary.balance >= 0 ? "positive" : "negative",
      },
    ],
    categoryBreakdown: [...categoryBreakdown]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({
        category: c.category,
        amount: c.amount,
        percentage: totalCategoryAmount > 0 ? (c.amount / totalCategoryAmount) * 100 : 0,
      })),
    monthlySeries: monthlySeries.map((m) => ({
      month: m.month,
      income: m.income,
      expense: m.expense,
      balance: m.balance,
    })),
  };
}

function buildPeriodLabel(series: DashboardReportInput["monthlySeries"]): string {
  if (series.length === 0) return "";
  const first = series[0].month;
  const last = series[series.length - 1].month;
  return `${formatMonthLabel(first)} – ${formatMonthLabel(last)}`;
}

function formatMonthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}