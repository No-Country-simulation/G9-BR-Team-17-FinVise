import { jsPDF } from "jspdf";
import { COLORS, FONT, summaryCardColumnX, summaryCardWidth } from "./ReportGeometry";
import { formatCurrency } from "@/lib/utils";
import { ReportDocument } from "@/types/report-document";

const CARD_HEIGHT = 20;

export function renderSummaryCards(doc: jsPDF, report: ReportDocument, startY: number): number {
  const width = summaryCardWidth(report.summaryCards.length);

  report.summaryCards.forEach((card, i) => {
    const x = summaryCardColumnX(i, report.summaryCards.length);

    doc.setDrawColor(COLORS.border);
    doc.roundedRect(x, startY, width, CARD_HEIGHT, 2, 2, "S");

    doc.setFontSize(FONT.small);
    doc.setTextColor(COLORS.muted);
    doc.text(card.label, x + 4, startY + 6);

    doc.setFontSize(FONT.sectionTitle);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(card.tone === "negative" ? COLORS.negative : COLORS.text);
    doc.text(formatCurrency(card.value), x + 4, startY + 14);
    doc.setFont("helvetica", "normal");
  });

  return startY + CARD_HEIGHT + 10;
}