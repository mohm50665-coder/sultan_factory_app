import { describe, expect, it } from "vitest";
import type { CustodyAccount, CustodyBatch, CustodySettings } from "../shared/custody-contract";
import {
  buildCustodyReport,
  buildReportEvents,
  businessMilliseconds,
  custodyReportSummary,
  reportCsv,
  riyadhRange,
} from "../shared/custody-reporting";

// Deterministic fixtures only: these are not production data or generated reports.
const accounts: CustodyAccount[] = [
  { id: 1, name: "أحمد", department: "الإنتاج", role: "worker" },
  { id: 2, name: "سارة", department: "الفحص", role: "worker" },
];

const settings: CustodySettings = {
  enabled: false,
  scheduleCronTaskUid: null,
  stageLimits: { production: { workHours: 8, confirmationHours: 2 } },
  shifts: [{ name: "صباح", start: "08:00", end: "16:00", days: [0, 1, 2, 3, 4, 5, 6] }],
  holidays: ["2026-04-02"],
};

function fixtureBatch(): CustodyBatch {
  return {
    id: "batch-1", trackingNumber: "TR-001", version: 1, purpose: "sale", productionDate: "2026-04-01", machineNumber: "M1", shift: "صباح",
    product: { code: "SAFE", name: "=SAFE", size: "42", color: "أسود", antiSlip: false, yarns: [], yarnWeightGrams: 0, pairWeightGrams: 0 },
    firstPairs: 100, secondPairs: 20, totalPairs: 120, createdBy: 1, createdByName: "أحمد", responsibleUserId: 1, createdAt: "2026-03-31T20:00:00.000Z",
    custodies: [
      { id: "root", batchId: "batch-1", ownerId: 1, ownerName: "أحمد", stage: "production", quality: "first", pairs: 120, status: "sent", receivedAt: "2026-03-31T21:00:00.000Z", startedAt: "2026-04-01T05:00:00.000Z", completedAt: "2026-04-01T07:00:00.000Z", sentAt: "2026-04-01T08:00:00.000Z", progressPairs: 120 },
      { id: "child", batchId: "batch-1", parentCustodyId: "root", ownerId: 2, ownerName: "سارة", stage: "inspection", quality: "second", pairs: 120, status: "received", receivedAt: "2026-04-01T09:00:00.000Z", progressPairs: 0, sourceStage: "production", sourceUserId: 1, sourceName: "أحمد" },
      { id: "stock", batchId: "batch-1", ownerId: 2, ownerName: "سارة", stage: "storage", quality: "first", pairs: 20, status: "stored", receivedAt: "2026-04-01T10:00:00.000Z", progressPairs: 20 },
    ],
    transfers: [{ id: "transfer-1", batchId: "batch-1", sourceCustodyId: "root", destinationCustodyId: "child", fromUserId: 1, fromName: "أحمد", toUserId: 2, toName: "سارة", fromStage: "production", toStage: "inspection", quality: "second", pairs: 120, sentAt: "2026-04-01T08:00:00.000Z", receivedAt: "2026-04-01T09:00:00.000Z", status: "confirmed" }],
    sessions: [
      { id: "work-1", custodyId: "root", userId: 1, startedAt: "2026-04-01T05:00:00.000Z", endedAt: "2026-04-01T06:00:00.000Z", kind: "work" },
      { id: "pause-1", custodyId: "root", userId: 1, startedAt: "2026-04-01T06:00:00.000Z", endedAt: "2026-04-01T06:30:00.000Z", kind: "pause", reason: "صيانة" },
      { id: "work-2", custodyId: "root", userId: 1, startedAt: "2026-04-01T06:30:00.000Z", endedAt: "2026-04-01T07:00:00.000Z", kind: "work" },
    ],
    progress: [
      { id: "p-before", custodyId: "root", userId: 1, pairs: 10, recordedAt: "2026-03-31T20:59:59.000Z" },
      { id: "p-1", custodyId: "root", userId: 1, pairs: 30, recordedAt: "2026-04-01T05:30:00.000Z" },
      { id: "p-2", custodyId: "root", userId: 1, pairs: 25, recordedAt: "2026-04-01T06:30:00.000Z" },
    ],
    disposals: [{ id: "d-1", custodyId: "child", pairs: 5, status: "approved", reason: "عيب", approvedAt: "2026-04-01T12:00:00.000Z" }],
    events: [{ id: "stored-event", batchId: "batch-1", custodyId: "stock", actorId: 2, actorName: "سارة", stage: "storage", action: "stock_stored", pairs: 20, at: "2026-04-01T11:00:00.000Z" }], corrections: [],
  };
}

describe("custody reporting behavioral fixtures", () => {
  it("uses Riyadh half-open boundaries and includes the selected day exactly", () => {
    const range = riyadhRange("2026-04-01", "2026-04-01");
    expect(range.start.toISOString()).toBe("2026-03-31T21:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-04-01T21:00:00.000Z");
    const report = buildCustodyReport({ batches: [fixtureBatch()], accounts, settings, filters: { startDate: "2026-04-01", endDate: "2026-04-01" } });
    expect(report.events.some((event) => event.id === "progress:p-1")).toBe(true);
    expect(report.events.some((event) => event.id === "progress:p-before")).toBe(false);
  });

  it("uses the prior real cumulative progress reading as the baseline and preserves discrepancies", () => {
    const progress = buildReportEvents([fixtureBatch()], accounts, settings).filter((event) => event.source === "progress");
    expect(progress.map((event) => event.pairs)).toEqual([10, 20, -5]);
    expect(progress[2]?.reason).toContain("-5");
  });

  it("keeps parent/child transfers from double-counting employee liability", () => {
    const report = buildCustodyReport({ batches: [fixtureBatch()], accounts, settings, filters: { startDate: "2026-04-01", endDate: "2026-04-01" } });
    const ahmed = report.departments.flatMap((department) => department.employees).find((employee) => employee.employeeId === 1)!;
    const sara = report.departments.flatMap((department) => department.employees).filter((employee) => employee.employeeId === 2);
    expect(ahmed.balance.confirmedOutboundPairs).toBe(120);
    expect(ahmed.balance.endingLiabilityPairs).toBe(0);
    expect(sara.reduce((sum,employee)=>sum+employee.balance.confirmedInboundPairs,0)).toBe(140);
    expect(sara.reduce((sum,employee)=>sum+employee.balance.endingLiabilityPairs,0)).toBe(120); // stock approval releases the stored 20 pairs from personal liability
  });

  it("separates manual work, pause, incomplete productivity, disposal status, final warehouse and sample proof", () => {
    const report = buildCustodyReport({ batches: [fixtureBatch()], accounts, settings, filters: { startDate: "2026-04-01", endDate: "2026-04-01" } });
    const ahmed = report.departments.flatMap((department) => department.employees).find((employee) => employee.employeeId === 1)!;
    expect(ahmed.totals.manualWorkMs).toBe(90 * 60_000);
    expect(ahmed.totals.pauseMs).toBe(30 * 60_000);
    expect(ahmed.totals.completedPairs).toBe(15); // 30 - prior 10, then -5 actual discrepancy; never the whole 120-pair lot
    expect(ahmed.totals.productivityPairsPerHour).toBe(10);
    expect(report.disposal).toEqual({ receivedPairs: 5, approvedPairs: 5, executedPairs: 0 });
    expect(report.warehouseFinalStockPairs).toBe(20);
    expect(report.samplesWithDeliveryProof).toBe(0);
  });

  it("calculates business time only from configured shifts and marks holidays unavailable for work time", () => {
    const normal = businessMilliseconds("2026-04-01T05:00:00.000Z", "2026-04-01T07:00:00.000Z", settings);
    expect(normal.calendarMs).toBe(2 * 60 * 60_000);
    expect(normal.businessMs).toBe(2 * 60 * 60_000);
    const holiday = businessMilliseconds("2026-04-02T05:00:00.000Z", "2026-04-02T07:00:00.000Z", settings);
    expect(holiday.businessMs).toBe(0);
    const unavailable = businessMilliseconds("2026-04-01T05:00:00.000Z", "2026-04-01T07:00:00.000Z", { ...settings, shifts: [] });
    expect(unavailable.state).toBe("unavailable");
  });

  it("exports CSV rather than fake XLS markup and neutralizes spreadsheet formulas", () => {
    const report = buildCustodyReport({ batches: [fixtureBatch()], accounts, settings, filters: { startDate: "2026-04-01", endDate: "2026-04-01" } });
    const csv = reportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=SAFE");
    expect(csv).not.toContain("<table");
  });

  it("keeps imported opening balances out of production and marks their timing incomplete", () => {
    const legacy = fixtureBatch() as CustodyBatch & { openingBalance?: boolean; legacySource?: { id: number; quantityPairs: number } };
    legacy.id = "opening-1";
    legacy.trackingNumber = "OPEN-1";
    legacy.openingBalance = true;
    legacy.legacySource = { id: 77, quantityPairs: 120 };
    legacy.custodies[0] = { ...legacy.custodies[0]!, batchId: legacy.id, legacyTiming: true };
    legacy.sessions = [{ id: "legacy-session", custodyId: "root", userId: 1, startedAt: "2026-04-01T05:00:00.000Z", endedAt: "2026-04-01T06:00:00.000Z", kind: "work" }];
    legacy.transfers = [];
    const report = buildCustodyReport({ batches: [fixtureBatch(), legacy], accounts, settings, filters: { startDate: "2026-04-01", endDate: "2026-04-01" } });
    expect(report.originalProductionPairs).toBe(120);
    expect(report.legacy).toEqual({ openingBatchCount: 1, openingPairs: 120, linkedLegacySourceCount: 1 });
    expect(custodyReportSummary(report).legacyOpeningPairs).toBe(120);
    const ahmed = report.departments.flatMap((department) => department.employees).find((employee) => employee.employeeId === 1)!;
    expect(ahmed.totals.productivityPairsPerHour).toBeNull();
  });
});
