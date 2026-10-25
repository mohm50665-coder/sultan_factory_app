export type YarnPercentage = {
  name?: string | null;
  percentage?: number | string | null;
};

export type YarnBreakdownItem = {
  name: string;
  percentage: number | null;
  grams: number | null;
};

/**
 * The issued yarn weight is the single source of truth for a production batch.
 * A missing or invalid value remains unavailable rather than becoming a
 * misleading zero in the interface.
 */
export function normalizeIssuedYarnGrams(value: unknown): number | null {
  const grams = Number(value);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

/**
 * Derives every yarn type's grams from the recorded batch total and its saved
 * percentage. This is intentionally a display/calculation helper: it never
 * changes the recorded batch total or creates a competing source of weight.
 */
export function calculateYarnBreakdown(
  issuedYarnGrams: unknown,
  yarns: YarnPercentage[],
): YarnBreakdownItem[] {
  const total = normalizeIssuedYarnGrams(issuedYarnGrams);
  return yarns.map((yarn) => {
    const percentageValue = Number(yarn?.percentage);
    const percentage = Number.isFinite(percentageValue) && percentageValue >= 0
      ? percentageValue
      : null;

    return {
      name: String(yarn?.name || "").trim(),
      percentage,
      grams: total !== null && percentage !== null ? (total * percentage) / 100 : null,
    };
  });
}
