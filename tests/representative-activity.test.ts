import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/employee-performance.tsx"), "utf8");
const daily = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");

describe("Representative activity integration", () => {
  it("loads orders, custom manufacturing and collection sources", () => {
    expect(screen).toContain('getBySection("orders_visits")');
    expect(screen).toContain('getBySection("custom_manufacturing")');
    expect(screen).toContain("collectionService.getAll()");
  });

  it("shows activity counts in the representative performance card", () => {
    expect(screen).toContain("الطلبات والزيارات");
    expect(screen).toContain("التصنيع الخاص");
    expect(screen).toContain("عمليات التحصيل");
  });

  it("saves the marketing daily report with a dated source template", () => {
    expect(daily).toContain('template: "marketing_daily"');
    expect(daily).toContain("reportDate");
    expect(daily).toContain("marketingRows");
  });
});
