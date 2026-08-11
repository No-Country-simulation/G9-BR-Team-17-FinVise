import { jsPDF } from "jspdf";

export interface DownloadOptions {
  fileName?: string;
}

export function downloadReport(doc: jsPDF, options: DownloadOptions = {}): void {
  const fileName = options.fileName ?? buildDefaultFileName();
  doc.save(fileName);
}

function buildDefaultFileName(): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `relatorio-financeiro-${stamp}.pdf`;
}