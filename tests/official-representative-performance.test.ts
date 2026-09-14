import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const usersManagement = readFileSync(resolve(process.cwd(), "app/users-management.tsx"), "utf8");
const server = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const extraTools = readFileSync(resolve(process.cwd(), "app/admin-tools-permissions.tsx"), "utf8");
const representativeScreen = readFileSync(resolve(process.cwd(), "app/representative-performance.tsx"), "utf8");

describe("Official representative performance permission", () => {
  it("keeps separate employee and representative performance icons", () => {
    expect(dashboard).toContain('id: "employee_performance"');
    expect(dashboard).toContain('labelAr: "تقييم أداء الموظفين"');
    expect(dashboard).toContain('route: "/employee-performance"');
    expect(dashboard).toContain('id: "representative_performance"');
    expect(dashboard).toContain('labelAr: "أداء المندوب"');
    expect(dashboard).toContain('route: "/representative-performance"');
    expect(representativeScreen).toContain("orders_visits");
    expect(representativeScreen).toContain("custom_manufacturing");
  });

  it("does not classify the feature as an extra tool", () => {
    const extraSetStart = dashboard.indexOf("const EXTRA_DASHBOARD_PERMISSION_IDS");
    const extraSetEnd = dashboard.indexOf("]);", extraSetStart);
    expect(dashboard.slice(extraSetStart, extraSetEnd)).not.toContain('"employee_performance"');
    const serverSetStart = server.indexOf("const EXTRA_TOOL_PERMISSION_IDS");
    const serverSetEnd = server.indexOf("]);", serverSetStart);
    expect(server.slice(serverSetStart, serverSetEnd)).not.toContain('"employee_performance"');
    expect(extraTools).not.toContain("id: 'employee_performance'");
  });

  it("exposes the official permission in Arabic and English user management lists", () => {
    expect(usersManagement).toContain('{ id: "employee_performance", label: "تقييم أداء الموظفين" }');
    expect(usersManagement).toContain('{ id: "representative_performance", label: "أداء المندوب" }');
    expect(usersManagement).toContain('{ id: "employee_performance", label: "Employee Performance" }');
    expect(usersManagement).toContain('{ id: "representative_performance", label: "Representative Performance" }');
  });
});
