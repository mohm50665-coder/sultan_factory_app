import { describe, expect, it } from "vitest";
import { legacyCustodySummary } from "../shared/legacy-custody-report";

describe("legacy custody report date semantics", () => {
  const row = {
    id: 77,
    // The batch was entered for Oct 1, but transferred and received later.
    date: "2026-10-01",
    createdAt: "2026-10-01T08:00:00Z",
    stageName: "rosso",
    receiverStage: "qalb",
    workerName: "Anam",
    movementBy: "Anam",
    expectedReceiver: "Ata Allah",
    receivedBy: "Ata Allah",
    movementAt: "2026-10-03T11:00:00Z",
    receivedAt: "2026-10-04T09:00:00Z",
    quantityDozen: 3,
    quantityPair: 2,
  };

  it("does not report a handover on batch-entry or production date", () => {
    const report = legacyCustodySummary([row], "2026-10-01", "2026-10-01");
    expect(report.records).toBe(0);
    expect(report.outboundPairs).toBe(0);
    expect(report.inboundPairs).toBe(0);
  });

  it("reports delivery only on its actual date and keeps the named parties", () => {
    const report = legacyCustodySummary([row], "2026-10-03", "2026-10-03");
    expect(report.outboundPairs).toBe(38);
    expect(report.inboundPairs).toBe(0);
    expect(report.transfers).toMatchObject([{
      event: "delivered",
      deliveredBy: "Anam",
      receivedBy: "Ata Allah",
      sourceStage: "rosso",
      destinationStage: "qalb",
      businessDate: "2026-10-03",
    }]);
  });

  it("reports receipt only on the actual receipt date", () => {
    const report = legacyCustodySummary([row], "2026-10-04", "2026-10-04");
    expect(report.outboundPairs).toBe(0);
    expect(report.inboundPairs).toBe(38);
    expect(report.transfers).toMatchObject([{ event: "received", businessDate: "2026-10-04" }]);
  });
});
