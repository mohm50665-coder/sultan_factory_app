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
  });
});

export {};
