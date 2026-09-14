import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dailySummary = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");
const apiService = readFileSync(resolve(process.cwd(), "lib/services/api.service.ts"), "utf8");

describe("Marketing and sales daily report", () => {
  it("is located inside the daily summary and is restricted to sales management", () => {
    expect(dailySummary).toContain("التقرير اليومي لإدارة التسويق والمبيعات");
    expect(dailySummary).toContain("canManageMarketingDaily");
    expect(dailySummary).toContain('"sales", "marketing", "sales_manager"');
  });

  it("includes the approved template sections", () => {
    expect(dailySummary).toContain("المبيعات النقدية");
    expect(dailySummary).toContain("المبيعات الآجلة");
    expect(dailySummary).toContain("التحصيل");
    expect(dailySummary).toContain("العملاء الجدد");
    expect(dailySummary).toContain("أوامر التصنيع والمرتجعات والتسويق");
    expect(dailySummary).toContain("حفظ التقرير اليومي");
  });

  it("persists a dated sales report through the reports service", () => {
    expect(dailySummary).toContain('template: "marketing_daily"');
    expect(dailySummary).toContain('reportType: "sales"');
    expect(dailySummary).toContain("startDate: reportDate");
    expect(dailySummary).toContain("endDate: reportDate");
    expect(apiService).toContain('create: (data: { reportName: string; reportType: "sales"');
  });
});
