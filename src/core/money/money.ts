/** Money is whole pence (DECISIONS: export conventions). */

/** "£12.50", "12.5", "12" → pence; "" or nonsense → null. */
export function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[£,\s]/g, ''));
  return text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** 1250 → "£12.50", 1200 → "£12". */
export function formatPrice(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}
