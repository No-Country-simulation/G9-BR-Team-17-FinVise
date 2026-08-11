export const PAGE = {
  width: 210, // A4 mm
  height: 297,
  marginX: 16,
  marginTop: 18,
  marginBottom: 16,
};

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

export const COLORS = {
  text: "#0F172A",
  muted: "#64748B",
  positive: "#0F9D58",
  negative: "#D93025",
  accent: "#0EA5B7", // ciano do FinVise
  border: "#E2E8F0",
  headerBg: "#0B1220",
  headerText: "#FFFFFF",
};

export const FONT = {
  title: 18,
  subtitle: 10,
  sectionTitle: 12,
  body: 9,
  small: 8,
};

export const SPACING = {
  afterHeader: 12,
  afterSection: 10,
  cardGap: 6,
  lineHeight: 5,
};

/** Layout dos summary cards: 3 colunas iguais dentro do CONTENT_WIDTH */
export function summaryCardColumnX(index: number, columns = 3): number {
  const cardWidth = (CONTENT_WIDTH - SPACING.cardGap * (columns - 1)) / columns;
  return PAGE.marginX + index * (cardWidth + SPACING.cardGap);
}

export function summaryCardWidth(columns = 3): number {
  return (CONTENT_WIDTH - SPACING.cardGap * (columns - 1)) / columns;
}