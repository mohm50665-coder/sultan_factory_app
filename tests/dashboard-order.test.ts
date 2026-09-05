import { describe, expect, it } from "vitest";

import { moveVisibleDashboardItem, normalizeDashboardOrder } from "../lib/dashboard-order";

describe("dashboard icon order", () => {
  const defaults = ["production", "tasks", "administrative", "notifications"];

  it("restores the default order when no saved order exists", () => {
    expect(normalizeDashboardOrder(null, defaults)).toEqual(defaults);
  });

  it("keeps a saved order and appends newly added icons", () => {
    expect(normalizeDashboardOrder(["tasks", "production"], defaults)).toEqual([
      "tasks",
      "production",
      "administrative",
      "notifications",
    ]);
  });

  it("removes unknown and duplicate icon identifiers", () => {
    expect(normalizeDashboardOrder(["tasks", "unknown", "tasks", "production"], defaults)).toEqual([
      "tasks",
      "production",
      "administrative",
      "notifications",
    ]);
  });

  it("moves icons using only the visible permission-filtered list", () => {
    const current = ["production", "tasks", "administrative", "notifications"];
    const visible = ["production", "administrative", "notifications"];
    expect(moveVisibleDashboardItem(current, visible, "administrative", -1)).toEqual([
      "administrative",
      "tasks",
      "production",
      "notifications",
    ]);
  });
});
