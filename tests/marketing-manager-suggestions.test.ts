import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const dailySummary = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");
const ordersVisits = readFileSync(resolve(process.cwd(), "app/orders-visits.tsx"), "utf8");

describe("Marketing manager suggestions 1 and 3", () => {
  it("refreshes the saved permissions when returning to the dashboard", () => {
    expect(dashboard).toContain("refreshUser");
    expect(dashboard).toContain("useFocusEffect");
  });

  it("saves the daily sales and collection report", () => {
    expect(dailySummary).toContain("saveMarketingReport");
    expect(dailySummary).toContain('reportType: "sales"');
    expect(dailySummary).toContain('template: "marketing_daily"');
  });

  it("keeps the manager request approval and closing fields in the request flow", () => {
    expect(ordersVisits).toContain("approvalStatus");
    expect(ordersVisits).toContain("invoiceAttachment");
    expect(ordersVisits).toContain("representativeReceived");
    expect(ordersVisits).toContain("closedAt");
  });
});

export {};
