export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseBRL(text: string): number | null {
  const cleaned = text
    .replace(/R\$\s*/i, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const value = parseFloat(cleaned);
  if (isNaN(value)) return null;

  return Math.round(value * 100);
}
