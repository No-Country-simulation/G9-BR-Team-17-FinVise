import { jsPDF } from "jspdf";
import { PAGE, COLORS, FONT } from "./ReportGeometry";

export function renderFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(FONT.small);
    doc.setTextColor(COLORS.muted);
    doc.text(
      `FinVise • Página ${i} de ${pageCount}`,
      PAGE.marginX,
      PAGE.height - PAGE.marginBottom / 2,
    );
  }
}