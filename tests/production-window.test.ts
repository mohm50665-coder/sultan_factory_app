import { describe, expect, it } from "vitest";
import { normalizeProductionWindow } from "../shared/production-window";

describe("production work window", () => {
  it("stores a same-day window with exact hours and minutes", () => {
    expect(normalizeProductionWindow({
      productionDate: "2026-10-17",
      productionEndDate: "2026-10-17",
      workStartTime: "08:15",
      workEndTime: "16:45",
    })).toMatchObject({ productionHours: 8, productionMinutes: 30, totalMinutes: 510 });
  });

  it("supports Arabic numerals and a window spanning two calendar days", () => {
    expect(normalizeProductionWindow({
      productionDate: "٢٠٢٦-١٠-١٧",
      productionEndDate: "٢٠٢٦-١٠-١٨",
      workStartTime: "٢٢:٣٠",
      workEndTime: "٠١:٠٠",
    })).toMatchObject({ productionDate: "2026-10-17", productionEndDate: "2026-10-18", totalMinutes: 150 });
  });

  it("rejects a partial or reversed operational window instead of guessing a duration", () => {
    expect(() => normalizeProductionWindow({ productionDate: "2026-10-17", workStartTime: "08:00" })).toThrow();
    expect(() => normalizeProductionWindow({ productionDate: "2026-10-17", productionEndDate: "2026-10-17", workStartTime: "16:00", workEndTime: "08:00" })).toThrow();
  });
});
