import { exactPairs, inReportPeriod, reportDate } from "./operational-report";

/**
 * Read-only bridge for the legacy manufacturing-stage ledger.
 * The `date` field is the batch/production date, not a transfer timestamp. Reports therefore
 * count only movementAt/deliveredAt for delivery and receivedAt for receipt.
 */
export type LegacyCustodyStageTotal = {
  stage: string;
  outboundPairs: number;
  inboundPairs: number;
  pendingPairs: number;
  records: number;
};

export type LegacyCustodyTransfer = {
  id: string;
  businessDate: string;
  event: "delivered" | "received";
  sourceStage: string;
  destinationStage: string;
  deliveredBy: string;
  receivedBy: string;
  expectedReceiver: string;
  productName: string;
  productSize: string;
  productColor: string;
  qualityGrade: string;
  pairs: number;
  status: "confirmed" | "pending";
};

export type LegacyCustodySummary = {
  records: number;
  confirmedRecords: number;
  pendingRecords: number;
  outboundPairs: number;
  inboundPairs: number;
  pendingPairs: number;
  invalidQuantityCount: number;
  stageTotals: LegacyCustodyStageTotal[];
  transfers: LegacyCustodyTransfer[];
};

const text = (value: unknown) => String(value ?? "").trim();
const quantity = (row: any) => exactPairs(row, "handover");
const shortage = (row: any) => {
  const value = Number(row?.shortageDozen ?? 0) * 12 + Number(row?.shortagePairs ?? row?.shortagePair ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};
const deliveryTime = (row: any) => reportDate(row?.movementAt ?? row?.deliveredAt);
const receiptTime = (row: any) => reportDate(row?.receivedAt);

/** A legacy stage row represents a transfer only when it carries a destination or a party. */
const isTransfer = (row: any) => Boolean(
  row?.movementBy || row?.deliveredBy || row?.expectedReceiver || row?.receivedBy || row?.receiverStage,
);

/**
 * The old automatic route could write a duplicate record during a retry. Collapse only an exact
 * AUTO_STAGE repetition; never merge different manual movements or different actual timestamps.
 */
function distinctTransfers(rows: any[]): any[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row?.deletedAt || !isTransfer(row)) return false;
    const source = text(row?.productType);
    const key = source.startsWith("AUTO_STAGE:")
      ? [source, text(row?.stageName), text(row?.receiverStage), deliveryTime(row), receiptTime(row), quantity(row)].join("|")
      : `id:${text(row?.id)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isInRange(actualDate: string, startDate: string, endDate: string): boolean {
  // Present the event date as a movement date so the one canonical report-range filter is used.
  return Boolean(actualDate) && inReportPeriod({ movementAt: actualDate }, "movement", startDate, endDate);
}

/**
 * Summarizes legacy handovers as individual actual events. A delivery on 3 October and its receipt
 * on 4 October appear in their respective daily reports. No event is moved to the batch `date`.
 * This function is read-only: it never creates an event, updates stock, or changes a legacy row.
 */
export function legacyCustodySummary(rows: any[], startDate: string, endDate: string): LegacyCustodySummary {
  const transfers: LegacyCustodyTransfer[] = [];
  const stageMap = new Map<string, LegacyCustodyStageTotal>();
  let invalidQuantityCount = 0;

  const addStage = (stage: string, field: "outboundPairs" | "inboundPairs" | "pendingPairs", pairs: number, record: boolean) => {
    const key = text(stage) || "unspecified";
    const item = stageMap.get(key) || { stage: key, outboundPairs: 0, inboundPairs: 0, pendingPairs: 0, records: 0 };
    item[field] += pairs;
    if (record) item.records += 1;
    stageMap.set(key, item);
  };

  for (const row of distinctTransfers(rows)) {
    const pairs = quantity(row);
    if (!Number.isSafeInteger(pairs) || pairs < 0) {
      invalidQuantityCount += 1;
      continue;
    }
    const sourceStage = text(row.stageName || row.previousStage) || "unspecified";
    const destinationStage = text(row.receiverStage || row.currentStage) || "unspecified";
    const deliveredBy = text(row.movementBy || row.deliveredBy || row.workerName);
    const receivedBy = text(row.receivedBy);
    const expectedReceiver = text(row.expectedReceiver);
    const deliveredPairs = Math.max(0, pairs - shortage(row));
    const sentAt = deliveryTime(row);
    const receivedAt = receiptTime(row);
    const base = {
      sourceStage,
      destinationStage,
      deliveredBy,
      receivedBy,
      expectedReceiver,
      productName: text(row.productName),
      productSize: text(row.productSize),
      productColor: text(row.productColor),
      qualityGrade: text(row.qualityGrade),
      pairs,
    };

    if (isInRange(sentAt, startDate, endDate)) {
      const isPendingAtEnd = !receivedAt || receivedAt > endDate;
      transfers.push({
        ...base,
        id: `${text(row.id)}:delivered:${sentAt}`,
        businessDate: sentAt,
        event: "delivered",
        pairs: deliveredPairs,
        status: isPendingAtEnd ? "pending" : "confirmed",
      });
      addStage(sourceStage, "outboundPairs", deliveredPairs, true);
      if (isPendingAtEnd) addStage(destinationStage, "pendingPairs", deliveredPairs, false);
    }

    if (isInRange(receivedAt, startDate, endDate)) {
      transfers.push({
        ...base,
        id: `${text(row.id)}:received:${receivedAt}`,
        businessDate: receivedAt,
        event: "received",
        status: "confirmed",
      });
      addStage(destinationStage, "inboundPairs", pairs, true);
    }
  }

  const orderedTransfers = [...transfers].sort((left, right) =>
    right.businessDate.localeCompare(left.businessDate) || right.id.localeCompare(left.id),
  );
  const stageTotals = Array.from(stageMap.values()).sort((left, right) => left.stage.localeCompare(right.stage, "ar"));
  return {
    records: orderedTransfers.length,
    confirmedRecords: orderedTransfers.filter((row) => row.status === "confirmed").length,
    pendingRecords: orderedTransfers.filter((row) => row.status === "pending").length,
    outboundPairs: orderedTransfers.filter((row) => row.event === "delivered").reduce((sum, row) => sum + row.pairs, 0),
    inboundPairs: orderedTransfers.filter((row) => row.event === "received").reduce((sum, row) => sum + row.pairs, 0),
    pendingPairs: orderedTransfers.filter((row) => row.event === "delivered" && row.status === "pending").reduce((sum, row) => sum + row.pairs, 0),
    invalidQuantityCount,
    stageTotals,
    transfers: orderedTransfers,
  };
}
