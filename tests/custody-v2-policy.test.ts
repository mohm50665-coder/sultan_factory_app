import { describe, expect, it } from "vitest";
import type { CustodyBatch, CustodyLot, CustodySettings } from "../shared/custody-contract";
import {
  allowedDestinationStages,
  computeTimingMetrics,
  exactQuantityError,
  isWithinConfiguredShift,
  pairsAsDozenAndPairs,
  validateProductSnapshot,
} from "../shared/custody-policy";

const product = {
  code: "SOCK-42-BLK", name: "جورب رياضي", size: "42", color: "أسود", antiSlip: false,
  yarns: [{ name: "قطن", percentage: 80 }, { name: "نايلون", percentage: 20 }], yarnWeightGrams: 30, pairWeightGrams: 40,
};
const sale = { purpose: "sale" as const, product };
const antiSlipSale = { purpose: "sale" as const, product: { ...product, antiSlip: true } };

function lot(overrides: Partial<CustodyLot> = {}): CustodyLot {
  return {
    id: "lot-1", batchId: "batch-1", ownerId: 7, ownerName: "عامل", stage: "rosso", quality: "first", pairs: 120,
    status: "completed", receivedAt: "2026-10-01T05:00:00.000Z", startedAt: "2026-10-01T05:30:00.000Z",
    completedAt: "2026-10-01T08:00:00.000Z", sentAt: "2026-10-01T08:15:00.000Z", progressPairs: 120, ...overrides,
  };
}

describe("Custody V2 behavioral policy", () => {
  it("routes ordinary sale lots through rosso, qalb, kawiya, inspection, packing, then storage", () => {
    expect(allowedDestinationStages(sale, "production", "first")).toEqual(["rosso"]);
    expect(allowedDestinationStages(sale, "rosso", "first")).toEqual(["qalb"]);
    expect(allowedDestinationStages(sale, "qalb", "first")).toEqual(["kawiya"]);
    expect(allowedDestinationStages(sale, "kawiya", "first")).toEqual(["inspection"]);
    expect(allowedDestinationStages(sale, "inspection", "first")).toEqual(["packing"]);
    expect(allowedDestinationStages(sale, "packing", "first")).toEqual(["storage"]);
  });

  it("routes anti-slip lots through anti-slip and branches suspected lots only to inspection", () => {
    expect(allowedDestinationStages(antiSlipSale, "qalb", "first")).toEqual(["antislip"]);
    expect(allowedDestinationStages(antiSlipSale, "antislip", "first")).toEqual(["kawiya"]);
    expect(allowedDestinationStages(antiSlipSale, "antislip", "suspected")).toEqual(["inspection"]);
  });

  it("keeps samples separate from sale stock route", () => {
    const sample = { purpose: "sample" as const, product: { ...product, antiSlip: false } };
    const antiSlipSample = { purpose: "sample" as const, product: { ...product, antiSlip: true } };
    expect(allowedDestinationStages(sample, "production", "first")).toEqual(["customer_service"]);
    expect(allowedDestinationStages(antiSlipSample, "production", "first")).toEqual(["antislip"]);
    expect(allowedDestinationStages(antiSlipSample, "antislip", "suspected")).toEqual(["customer_service"]);
    expect(allowedDestinationStages(sample, "packing", "first")).toEqual([]);
  });

  it("does not discard extra pairs when displaying quantity or explaining a shortage", () => {
    expect(pairsAsDozenAndPairs(125)).toMatchObject({ dozen: 10, pairs: 5, label: "10 درزن و5 زوج" });
    const short = exactQuantityError(120, 115);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.message).toContain("5 أزواج");
    const excess = exactQuantityError(120, 121);
    expect(excess.ok).toBe(false);
    if (!excess.ok) expect(excess.message).toContain("تزيد");
  });

  it("requires a valid immutable product definition including yarn blend totaling 100 percent", () => {
    expect(() => validateProductSnapshot(product)).not.toThrow();
    expect(() => validateProductSnapshot({ ...product, yarns: [{ name: "قطن", percentage: 90 }] })).toThrow(/100/);
    expect(() => validateProductSnapshot({ ...product, pairWeightGrams: 0 })).toThrow();
  });

  it("computes only observed work and pause time and never invents productivity", () => {
    const metrics = computeTimingMetrics(lot(), [
      { id: "w1", custodyId: "lot-1", userId: 7, kind: "work", startedAt: "2026-10-01T05:30:00.000Z", endedAt: "2026-10-01T06:30:00.000Z" },
      { id: "p1", custodyId: "lot-1", userId: 7, kind: "pause", reason: "صيانة", startedAt: "2026-10-01T06:30:00.000Z", endedAt: "2026-10-01T07:00:00.000Z" },
      { id: "w2", custodyId: "lot-1", userId: 7, kind: "work", startedAt: "2026-10-01T07:00:00.000Z", endedAt: "2026-10-01T08:00:00.000Z" },
    ]);
    expect(metrics.activeWorkMinutes).toBe(120);
    expect(metrics.pausedMinutes).toBe(30);
    expect(metrics.waitingToStartMinutes).toBe(30);
    expect(metrics.waitingToSendMinutes).toBe(15);
    expect(metrics.productivityPairsPerHour).toBe(60);
    expect(computeTimingMetrics(lot({ completedAt: undefined, progressPairs: 0 }), []).productivityPairsPerHour).toBeNull();
  });

  it("returns shift time unavailable without configured shifts instead of guessing", () => {
    const settings: CustodySettings = { enabled: true, stageLimits: {}, shifts: [], holidays: [] };
    expect(isWithinConfiguredShift("2026-10-01T08:00:00.000Z", settings)).toBeNull();
  });
});
