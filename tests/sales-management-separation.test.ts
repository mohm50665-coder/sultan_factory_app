import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const sales = readFileSync(resolve(process.cwd(), "app/sales.tsx"), "utf8");
const salesManagement = readFileSync(resolve(process.cwd(), "app/sales-management.tsx"), "utf8");
const collection = readFileSync(resolve(process.cwd(), "app/collection.tsx"), "utf8");
const custom = readFileSync(resolve(process.cwd(), "app/custom-manufacturing.tsx"), "utf8");

describe("Sales management separation", () => {
  it("normalizes the Arabic and technical sales-management department values", () => {
    expect(dashboard).toContain('"sales_management"');
    expect(dashboard).toContain('"إدارة التسويق والمبيعات"');
  });

  it("shows the new management entry and hides the representative operational entry from the manager", () => {
    expect(dashboard).toContain('if (item.id === "sales") return true;');
    expect(dashboard).toContain('if (item.id === "representative_performance") return false;');
    expect(dashboard).toContain('labelAr: "إدارة التسويق والمبيعات"');
    expect(dashboard).toContain('route: "/sales-management"');
  });

  it("replaces the legacy sales screen with the new management interface", () => {
    expect(sales).toContain('export { default } from "./sales-management"');
    expect(sales).not.toContain("salesService");
    expect(salesManagement).toContain("تم نقل الطلبات والزيارات والتصنيع الخاص والتحصيل إلى وحدة أداء المندوب");
    expect(collection).toContain("تم نقل التحصيل إلى وحدة أداء المندوب");
  });

  it("guards custom manufacturing from the sales manager", () => {
    expect(custom).toContain("تم نقل التصنيع الخاص إلى وحدة أداء المندوب");
  });
});

export {};
