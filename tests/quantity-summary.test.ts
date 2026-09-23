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
    expect(summary).toContain("difference-positive");
    expect(summary).toContain("difference-negative");
  });

  it("explains the calculation and links remaining quantities to the dedicated inventory", () => {
    expect(summary).toContain("المستلم = ما استلمه الموظف");
    expect(summary).toContain("أيقونة الكمية المتبقية");
    expect(summary).toContain("الموجب باللون الأزرق");
    expect(summary).toContain("السالب باللون الأحمر");
    expect(remaining).toContain("إجمالي الأزواج المتبقية");
    expect(remaining).toContain("(${pairs(row)} زوج)");
  });
});

export {};
