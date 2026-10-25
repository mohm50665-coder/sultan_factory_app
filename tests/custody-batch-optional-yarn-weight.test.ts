import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productionMetrics } from "../shared/operational-report";
import { calculateYarnBreakdown } from "../shared/yarn-breakdown";

const source = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");

describe("optional issued-yarn weight in production entry", () => {
  it("allows saving a product without an issued-yarn weight while retaining a valid pair weight", () => {
    expect(source).toContain('const hasIssuedYarnWeight = draft.yarnWeight.trim().length > 0;');
    expect(source).toContain('yarnWeightGrams: grams');
    expect(source).toContain('وزن الخيوط المصروفة للدفعة (اختياري)');
    expect(source).not.toContain('!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(perPair)');
  });

  it("uses the same grams formula as the reports and never presents an absent denominator as zero", () => {
    const absentWeight = productionMetrics([{ productionDozen: 0, productionPairs: 24, wasteThreadGrams: 6 }]);
    const recordedWeight = productionMetrics([{ productionDozen: 0, productionPairs: 24, yarnIssuedGrams: 240, wasteThreadGrams: 6, wasteSocksGrams: 3 }]);

    expect(absentWeight.wastePercent).toBeNull();
    expect(recordedWeight.wastePercent).toBeCloseTo((6 + 3) / 240 * 100, 10);
    expect(source).toContain('productionMetrics([{');
    expect(source).toContain('نسبة الهدر الإجمالية (تلقائية)');
    expect(source).toContain('وزن الخيوط المصروفة غير مدخل؛ يمكن الحفظ');
  });

  it("derives each yarn quantity from the same issued batch weight and saved percentage", () => {
    const breakdown = calculateYarnBreakdown(2_000, [
      { name: "قطن", percentage: 65 },
      { name: "نايلون", percentage: 35 },
    ]);

    expect(breakdown).toEqual([
      { name: "قطن", percentage: 65, grams: 1_300 },
      { name: "نايلون", percentage: 35, grams: 700 },
    ]);
    expect(breakdown.reduce((sum, yarn) => sum + (yarn.grams || 0), 0)).toBe(2_000);
  });

  it("keeps the percentage but labels the amount unavailable when issued yarn weight was not entered", () => {
    const breakdown = calculateYarnBreakdown(null, [{ name: "قطن", percentage: 100 }]);
    expect(breakdown).toEqual([{ name: "قطن", percentage: 100, grams: null }]);
  });
});
