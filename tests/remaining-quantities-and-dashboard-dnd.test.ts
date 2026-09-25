import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { moveVisibleDashboardItemToTarget } from "../lib/dashboard-order";

const dashboardSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const remainingSource = readFileSync(resolve(process.cwd(), "app/remaining-quantities.tsx"), "utf8");
const summarySource = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("Dashboard drag ordering and remaining quantities", () => {
  it("moves a visible icon to the dropped position and preserves hidden entries", () => {
    expect(moveVisibleDashboardItemToTarget(["a", "hidden", "b", "c"], ["a", "b", "c"], "c", "a")).toEqual(["c", "hidden", "a", "b"]);
    expect(moveVisibleDashboardItemToTarget(["a", "b"], ["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });

  it("exposes mouse drag/drop and persists the dashboard order", () => {
    expect(dashboardSource).toContain("draggable: isReorderingIcons");
    expect(dashboardSource).toContain("onDrop:");
    expect(dashboardSource).toContain("onMouseDown:");
    expect(dashboardSource).toContain("event?.button === 2");
    expect(dashboardSource).toContain("persistDashboardOrder(nextOrder)");
    expect(dashboardSource).toContain("اسحب الأيقونة بالفأرة");
  });

  it("shows full product details for remaining quantities and clears old remaining records on later delivery", () => {
    expect(remainingSource).toContain("الكمية المتبقية");
    expect(remainingSource).toContain("productSize");
    expect(remainingSource).toContain("productColor");
    expect(remainingSource).toContain("currentStage");
    expect(summarySource).toContain("الكمية المتبقية حسب المرحلة");
    expect(routerSource).toContain("تم تسليم الكمية المتبقية لاحقاً");
    expect(routerSource).toContain("shortagePairs: 0");
    expect(routerSource).toContain("تنبيه كمية متبقية");
    expect(routerSource).toContain('category: "remaining_quantity"');
    expect(routerSource).toContain('eq(usersTable.role, "admin")');
    expect(remainingSource).toContain('exportReport("word")');
    expect(remainingSource).toContain('exportReport("excel")');
    expect(remainingSource).toContain("application/vnd.ms-excel");
    expect(remainingSource).toContain("application/msword");
  });
  it("creates an active carryover custody for the next day and normalizes mixed units", () => {
    expect(routerSource).toContain("const remainingTotalPairs = currentPairs - deliveredPairs");
    expect(routerSource).toContain("const remainingDozen = Math.floor(remainingTotalPairs / 12)");
    expect(routerSource).toContain("const remainingPairs = remainingTotalPairs % 12");
    expect(routerSource).toContain("AUTO_REMAINING:${record.id}");
    expect(routerSource).toContain('movementStatus: "received"');
    expect(routerSource).toContain("quantityDozen: remainingDozen");
    expect(routerSource).toContain("quantityPair: remainingPairs");
    expect(routerSource).toContain("أغلق كل سجلات المتبقي");
    expect(routerSource).toContain("or(gt(productTrackingTable.shortageDozen, 0), gt(productTrackingTable.shortagePairs, 0))");
  });
});

export {};
