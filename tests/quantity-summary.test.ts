import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const summary = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");
const remaining = readFileSync(resolve(process.cwd(), "app/remaining-quantities.tsx"), "utf8");

describe("handover quantity summary", () => {
  it("shows received, delivered, and remaining quantities as numbers", () => {
    expect(summary).toContain("receivedQuantityPairs");
    expect(summary).toContain("deliveredQuantityPairs");
    expect(summary).toContain("إجمالي المستلم");
    expect(summary).toContain("إجمالي المسلّم");
    expect(summary).toContain("إجمالي المتبقي");
    expect(summary).toContain("quantityLabel(remainingPairs");
    expect(summary).toContain("signedQuantityLabel");
    expect(summary).toContain("quantityDifferencePairs");
    expect(summary).toContain("quantityDifferencePairs");
    expect(summary).toContain("signedQuantityLabel");
    expect(summary).toContain("rawDeliveredQuantityPairs");
    expect(summary).not.toContain("Math.min(receivedQuantityPairs, rawDeliveredQuantityPairs)");
    expect(summary).toContain("CustodySummaryPanel");
  });

  it("separates manufacturing stages in the comprehensive report", () => {
    expect(summary).toContain("stageSummary");
    expect(summary).toContain("مراحل التصنيع — كل مرحلة مستقلة");
    expect(summary).toContain("Delivered: ${quantityLabel(item.delivered, false)}");
    expect(summary).toContain("productionOnlyWorkMinutes");
    expect(summary).toContain("stageDurationSummary");
    expect(summary).toContain("const productionWorkMinutes = productionOnlyWorkMinutes + stageWorkMinutes");
    expect(summary).toContain("مدة المرحلة");
  });

  it("explains the calculation and links remaining quantities to the dedicated inventory", () => {
    expect(summary).toContain("Received is what the employee acknowledged");
    expect(summary).toContain("Remaining Quantities");
    expect(summary).toContain("Blue positive values require review");
    expect(summary).toContain("red negative values indicate a shortage");
    expect(summary).toContain("differenceFilter");
    expect(summary).toContain("Review remaining quantities");
    expect(summary).not.toContain("alertsService.create");
    expect(summary).toContain("buildCustodyReport");
    expect(summary).toContain("/remaining-quantities");
    expect(remaining).toContain("إجمالي الأزواج المتبقية");
    expect(remaining).toContain("(${pairs(row)} زوج)");
  });
});

export {};
