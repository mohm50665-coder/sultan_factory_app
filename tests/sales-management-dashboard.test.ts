import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const usersSource = readFileSync(resolve(process.cwd(), "app/users-management.tsx"), "utf8");

describe("Sales and Marketing management dashboard", () => {
  it("defines the four official management entries", () => {
    expect(dashboardSource).toContain('id: "daily_sales_collection_report"');
    expect(dashboardSource).toContain('id: "representative_evaluation"');
    expect(dashboardSource).toContain('id: "sales_approvals_requests"');
    expect(dashboardSource).toContain('id: "representative_comprehensive_report"');
  });

  it("replaces the moved sales entry with one management gateway", () => {
    expect(dashboardSource).toContain('labelAr: "إدارة التسويق والمبيعات"');
    expect(dashboardSource).toContain('route: "/sales-management"');
    expect(dashboardSource).toContain('if (item.id === "sales") return true;');
    expect(dashboardSource).toContain('if (salesManagerOfficialItems.has(item.id)) return false;');
  });

  it("exposes the new entries in the admin permission selector", () => {
    expect(usersSource).toContain('id: "daily_sales_collection_report"');
    expect(usersSource).toContain('id: "representative_evaluation"');
    expect(usersSource).toContain('id: "sales_approvals_requests"');
    expect(usersSource).toContain('id: "representative_comprehensive_report"');
  });
});

export {};
