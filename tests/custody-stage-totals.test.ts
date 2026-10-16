import { describe, expect, it } from "vitest";
import type { CustodyAccount, CustodyBatch } from "../shared/custody-contract";
import {
  buildCustodyReport,
  reportStageTotalRows,
  reportTransferRows,
} from "../shared/custody-reporting";

const accounts: CustodyAccount[] = [
  { id: 1, name: "فهد", department: "الإنتاج", role: "worker" },
  { id: 2, name: "ليلى", department: "التغليف", role: "worker" },
  { id: 3, name: "ناصر", department: "المستودعات", role: "worker" },
];

function batch(): CustodyBatch {
  return {
    id: "a2d6a901-5ee0-4a5b-91e0-a44444444444",
    trackingNumber: "CUST-LEDGER-1",
    version: 1,
    purpose: "sale",
    productionDate: "2026-05-01",
    machineNumber: "M-7",
    shift: "الصباحية",
    product: { code: "SK-42", name: "جورب", size: "42", color: "أسود", antiSlip: false, yarns: [], yarnWeightGrams: 0, pairWeightGrams: 1 },
    firstPairs: 120,
    secondPairs: 0,
    totalPairs: 120,
    createdBy: 1,
    createdByName: "فهد",
    responsibleUserId: 1,
    createdAt: "2026-04-30T18:00:00.000Z",
    custodies: [
      { id: "root", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", ownerId: 1, ownerName: "فهد", stage: "production", quality: "first", pairs: 120, status: "sent", receivedAt: "2026-04-30T18:00:00.000Z", sentAt: "2026-05-02T06:00:00.000Z", progressPairs: 0 },
      { id: "packing", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", parentCustodyId: "root", ownerId: 2, ownerName: "ليلى", stage: "packing", quality: "first", pairs: 120, status: "sent", receivedAt: "2026-05-02T07:00:00.000Z", sentAt: "2026-05-03T06:00:00.000Z", progressPairs: 0 },
      { id: "storage", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", parentCustodyId: "packing", ownerId: 3, ownerName: "ناصر", stage: "storage", quality: "first", pairs: 100, status: "stored", receivedAt: "2026-05-03T07:00:00.000Z", progressPairs: 0 },
    ],
    transfers: [
      { id: "t-production-packing", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", sourceCustodyId: "root", destinationCustodyId: "packing", fromUserId: 1, fromName: "فهد", toUserId: 2, toName: "ليلى", fromStage: "production", toStage: "packing", quality: "first", pairs: 120, sentAt: "2026-05-02T06:00:00.000Z", receivedAt: "2026-05-02T07:00:00.000Z", status: "confirmed" },
      { id: "t-packing-storage", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", sourceCustodyId: "packing", destinationCustodyId: "storage", fromUserId: 2, fromName: "ليلى", toUserId: 3, toName: "ناصر", fromStage: "packing", toStage: "storage", quality: "first", pairs: 100, sentAt: "2026-05-03T06:00:00.000Z", receivedAt: "2026-05-03T07:00:00.000Z", status: "confirmed" },
      { id: "t-packing-pending", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", sourceCustodyId: "packing", fromUserId: 2, fromName: "ليلى", toUserId: 3, toName: "ناصر", fromStage: "packing", toStage: "storage", quality: "first", pairs: 20, sentAt: "2026-05-03T08:00:00.000Z", status: "pending" },
    ],
    sessions: [],
    progress: [],
    disposals: [],
    events: [
      { id: "stored", batchId: "a2d6a901-5ee0-4a5b-91e0-a44444444444", custodyId: "storage", actorId: 3, actorName: "ناصر", stage: "storage", action: "stock_stored", pairs: 100, at: "2026-05-03T09:00:00.000Z" },
    ],
  };
}

describe("custody stage totals", () => {
  it("counts a confirmed receipt exactly once as inbound to target and outbound from source, without treating stage flow as production", () => {
    const report = buildCustodyReport({
      batches: [batch()],
      accounts,
      filters: { startDate: "2026-05-01", endDate: "2026-05-03" },
    });
    const production = report.stageTotals.find((total) => total.stage === "production")!;
    const packing = report.stageTotals.find((total) => total.stage === "packing")!;

    expect(report.originalProductionPairs).toBe(120);
    expect(production).toMatchObject({ openingPairs: 120, confirmedInboundPairs: 0, confirmedOutboundPairs: 120, pendingOutboundPairs: 0, releasedPairs: 0, remainingPairs: 0 });
    expect(packing).toMatchObject({ openingPairs: 0, confirmedInboundPairs: 120, confirmedOutboundPairs: 100, pendingOutboundPairs: 20, releasedPairs: 0, remainingPairs: 20 });
  });

  it("reduces storage responsibility only on stock_stored and keeps no separate storage receipt as stock availability", () => {
    const report = buildCustodyReport({
      batches: [batch()],
      accounts,
      filters: { startDate: "2026-05-01", endDate: "2026-05-03" },
    });
    const storage = report.stageTotals.find((total) => total.stage === "storage")!;

    expect(storage.stageLabel).toBe("التخزين والمستودعات — إنتاج تام");
    expect(storage).toMatchObject({ openingPairs: 0, confirmedInboundPairs: 100, confirmedOutboundPairs: 0, pendingOutboundPairs: 0, releasedPairs: 100, remainingPairs: 0 });
    expect(report.warehouseFinalStockPairs).toBe(100);
  });

  it("renders exactly one transfer fact per immutable transfer ID with both named departments and timestamps", () => {
    const report = buildCustodyReport({
      batches: [batch()],
      accounts,
      filters: { startDate: "2026-05-01", endDate: "2026-05-03" },
    });
    const first = report.transfers.find((transfer) => transfer.id === "transfer:t-production-packing")!;

    expect(report.transfers).toHaveLength(3);
    expect(report.events.filter((event) => event.id.includes("t-production-packing"))).toHaveLength(1);
    expect(first).toMatchObject({ sourceDepartment: "الإنتاج", sourceName: "فهد", destinationDepartment: "التغليف", destinationName: "ليلى", expectedPairs: 120, actualPairs: 120, quantityDifferencePairs: 0, status: "confirmed" });
    expect(first.sentAt).toBe("2026-05-02T06:00:00.000Z");
    expect(first.receivedAt).toBe("2026-05-02T07:00:00.000Z");

    const transferExport = reportTransferRows(report);
    expect(transferExport).toHaveLength(3);
    expect(transferExport[0]).toMatchObject({ "قسم المرسل": "الإنتاج", "اسم المرسل": "فهد", "قسم المستلم": "التغليف", "اسم المستلم": "ليلى", "المرسل (زوج)": 120, "الفعلي (زوج)": 120, "الفرق الفعلي - المرسل (زوج)": 0 });
    expect(reportStageTotalRows(report).find((row) => row["المرحلة"] === "التغليف")).toMatchObject({ "مرسل معلق (زوج)": 20, "المتبقي / المسؤولية (زوج)": 20 });
  });
});
