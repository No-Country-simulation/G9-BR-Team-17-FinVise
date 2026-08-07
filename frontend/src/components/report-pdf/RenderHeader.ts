import { jsPDF } from "jspdf";
import { PAGE, COLORS, FONT } from "./ReportGeometry";
import { ReportDocument } from "@/types/report-document";

export function renderHeader(doc: jsPDF, report: ReportDocument): number {
  let y = PAGE.marginTop;

  doc.setTextColor(COLORS.text);
  doc.setFontSize(FONT.title);
  doc.setFont("helvetica", "bold");
  doc.text(report.meta.title, PAGE.marginX, y);

  y += 6;
  doc.setFontSize(FONT.subtitle);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.muted);
  doc.text(report.meta.subtitle, PAGE.marginX, y);

  y += 5;
  const generated = report.meta.generatedAt.toLocaleString("pt-BR");
  doc.text(
    `Período: ${report.meta.periodLabel}   •   Fonte: ${report.meta.sourceLabel}   •   Gerado em ${generated}`,
    PAGE.marginX,
    y,
  );

  return y + 6; // próximo Y disponível
}