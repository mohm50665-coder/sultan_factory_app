import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const sales = readFileSync(resolve(process.cwd(), "app/sales.tsx"), "utf8");
const collection = readFileSync(resolve(process.cwd(), "app/collection.tsx"), "utf8");
const custom = readFileSync(resolve(process.cwd(), "app/custom-manufacturing.tsx"), "utf8");

describe("Sales management separation", () => {
  it("hides the legacy sales entry for the sales manager", () => {
    expect(dashboard).toContain('if (item.id === "sales" || item.id === "representative_performance") return false;');
  });

  it("guards legacy sales and collection screens from the sales manager", () => {
    expect(sales).toContain("تم نقل المبيعات والتحصيل إلى وحدة أداء المندوب");
    expect(collection).toContain("تم نقل التحصيل إلى وحدة أداء المندوب");
  });

  it("guards custom manufacturing from the sales manager", () => {
    expect(custom).toContain("تم نقل التصنيع الخاص إلى وحدة أداء المندوب");
  });
});

export {};
