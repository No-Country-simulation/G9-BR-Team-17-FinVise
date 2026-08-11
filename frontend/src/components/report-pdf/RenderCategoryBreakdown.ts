import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import { PAGE, COLORS, FONT } from "./ReportGeometry";
import { ReportDocument } from "@/types/report-document";


export function renderCategoryBreakdown(doc: jsPDF, report: ReportDocument, startY: number): number {
  doc.setFontSize(FONT.sectionTitle);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.text);
  doc.text("Gastos por Categoria", PAGE.marginX, startY);

  autoTable(doc, {
    startY: startY + 4,
    margin: { left: PAGE.marginX, right: PAGE.marginX },
    head: [["Categoria", "Valor", "% do total"]],
    body: report.categoryBreakdown.map((c) => [
      c.category,
      formatCurrency(c.amount),
      `${c.percentage.toFixed(1)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontSize: FONT.body },
    bodyStyles: { fontSize: FONT.body, textColor: COLORS.text },
    styles: { cellPadding: 2.5 },
  });

  // jspdf-autotable expõe a posição final em doc.lastAutoTable
  return (doc as any).lastAutoTable.finalY + 10;
}