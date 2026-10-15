import { describe, expect, it, vi } from "vitest";

// These UI primitives are not under test; the workbench selectors themselves are pure.
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@/lib/services/api.service", () => ({ trpcCall: vi.fn() }));

const { formatPairs, selectWorkbenchCounts, selectWorkbenchRows } = await import("../components/custody-ui");
const { isAllocationAllowed, nextCustodyStage, validateFullAllocations } = await import("../lib/services/custody.service");

type CustodyBatch = import("../shared/custody-contract").CustodyBatch;
type CustodySettings = import("../shared/custody-contract").CustodySettings;

const now = new Date().toISOString();
const batch: CustodyBatch = {
  id: "99125b70-eb8b-4591-a816-aaee48fc9e66",
  trackingNumber: "B-100",
  version: 1,
  product: { code: "S-1", name: "جورب", size: "42", color: "أسود", antiSlip: true, yarns: [], yarnWeightGrams: 0, pairWeightGrams: 1 },
  purpose: "sale",
  productionDate: "2026-10-15",
  machineNumber: "M1",
  shift: "الصباحية",
  firstPairs: 12,
  secondPairs: 0,
  totalPairs: 12,
  createdBy: 1,
  createdByName: "منشئ",
  responsibleUserId: 1,
  createdAt: now,
  custodies: [{ id: "2be4f3fd-865f-44f9-831e-3c6d47de5feb", batchId: "99125b70-eb8b-4591-a816-aaee48fc9e66", ownerId: 7, ownerName: "مالك", stage: "antislip", quality: "first", pairs: 12, status: "completed", receivedAt: now, progressPairs: 12 }],
  transfers: [{ id: "968b9d54-477b-4694-99b6-b4bfb8462bb9", batchId: "99125b70-eb8b-4591-a816-aaee48fc9e66", sourceCustodyId: "from", fromUserId: 3, fromName: "مرسل", toUserId: 7, toName: "مالك", fromStage: "qalb", toStage: "antislip", quality: "first", pairs: 12, sentAt: now, status: "pending" }],
  sessions: [], progress: [], disposals: [], events: [],
};

const settings: CustodySettings = { enabled: true, stageLimits: {}, shifts: [], holidays: [] };

describe("custody workbench selectors", () => {
  it("formats complete pairs without losing the additional pairs", () => {
    expect(formatPairs(125)).toBe("10 درزن + 5 زوج");
  });

  it("keeps incoming transfer and owned lots as distinct workbench rows", () => {
    const rows = selectWorkbenchRows([batch], 7, { search: "", status: "" });
    expect(rows.map((row) => row.kind).sort()).toEqual(["incoming", "lot"]);
  });

  it("does not create overdue counts unless a stage time policy is configured", () => {
    const noPolicy = selectWorkbenchCounts([batch], 7, settings);
    expect(noPolicy.overdue).toBe(0);
    expect(noPolicy.pendingReceive).toBe(1);
    expect(noPolicy.completed).toBe(1);
  });

  it("uses the approved anti-slip and normal manufacturing routes", () => {
    expect(nextCustodyStage("qalb", true, "sale")).toBe("antislip");
    expect(nextCustodyStage("qalb", false, "sale")).toBe("kawiya");
    expect(nextCustodyStage("antislip", true, "sale")).toBeNull();
  });

  it("requires a complete, allowed allocation sum for split stages", () => {
    expect(isAllocationAllowed("antislip", { toStage: "inspection", quality: "suspected" })).toBe(true);
    expect(isAllocationAllowed("antislip", { toStage: "kawiya", quality: "suspected" })).toBe(false);
    expect(validateFullAllocations("inspection", 12, [
      { toStage: "packing", toUserId: 8, quality: "first", pairs: 10 },
      { toStage: "followup", toUserId: 9, quality: "damaged", pairs: 2 },
    ]).valid).toBe(true);
    expect(validateFullAllocations("inspection", 12, [
      { toStage: "packing", toUserId: 8, quality: "first", pairs: 11 },
    ]).valid).toBe(false);
  });
});
