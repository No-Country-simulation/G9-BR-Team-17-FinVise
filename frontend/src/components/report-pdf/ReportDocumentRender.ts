import { jsPDF } from "jspdf";
import { ReportDocument } from "@/types/report-document";
import { PAGE } from "./ReportGeometry";
import { renderHeader } from "./RenderHeader";
import { renderSummaryCards } from "./RenderSummaryCards";
import { renderCategoryBreakdown } from "./RenderCategoryBreakdown";
import { renderMonthlySeries } from "./RenderMonthlySeries";
import { renderFooter } from "./RenderFooter";

export function renderReportDocument(report: ReportDocument): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = renderHeader(doc, report);
  y = renderSummaryCards(doc, report, y);

  y = ensureSpace(doc, y, 60);
  y = renderCategoryBreakdown(doc, report, y);

  y = ensureSpace(doc, y, 60);
  renderMonthlySeries(doc, report, y);

  renderFooter(doc);

  return doc;
}

/** Se não sobrar espaço suficiente antes do rodapé, começa nova página. */
function ensureSpace(doc: jsPDF, currentY: number, needed: number): number {
  if (currentY + needed > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    return PAGE.marginTop;
  }
  return currentY;
}