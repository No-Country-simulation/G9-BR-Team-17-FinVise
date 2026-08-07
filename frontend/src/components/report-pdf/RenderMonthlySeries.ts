import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PAGE, COLORS, FONT } from "./ReportGeometry";
import { ReportDocument } from "@/types/report-document";
import { formatCurrency } from "@/lib/utils";

export function renderMonthlySeries(doc: jsPDF, report: ReportDocument, startY: number): number {
  doc.setFontSize(FONT.sectionTitle);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.text);
  doc.text("Resumo Mensal", PAGE.marginX, startY);

  autoTable(doc, {
    startY: startY + 4,
    margin: { left: PAGE.marginX, right: PAGE.marginX },
    head: [["Mês", "Receitas", "Despesas", "Saldo"]],
    body: report.monthlySeries.map((m) => [
      m.month,
      formatCurrency(m.income),
      formatCurrency(m.expense),
      formatCurrency(m.balance),
    ]),
    theme: "striped",
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: FONT.body },
    bodyStyles: { fontSize: FONT.small },
    didParseCell: (data) => {
      // saldo negativo em vermelho
      if (data.column.index === 3 && data.section === "body") {
        const raw = report.monthlySeries[data.row.index]?.balance ?? 0;
        if (raw < 0) data.cell.styles.textColor = COLORS.negative;
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
}