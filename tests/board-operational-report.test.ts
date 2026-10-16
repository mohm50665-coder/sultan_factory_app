import { describe, expect, it } from "vitest";

import { commercialReport, exactPairs, productionMetrics, warehousePeriod } from "../shared/operational-report";

describe("board operational report", () => {
  it("counts invoice records as sales while preserving orders and visits as operational details", () => {
    const report = commercialReport({
      sales: [{ id: 1, invoiceNumber: "SAL-1", invoiceDate: "2026-10-05", amount: 632.5, customerName: "عميل فاتورة" }],
      legacySales: [{ id: 1, invoiceNumber: "LEG-1", invoiceDate: "2026-10-05", amount: "100" }],
      collections: [{ id: 1, collectionDate: "2026-10-05", collectedAmount: 200 }],
      legacyCollections: [],
      transactions: [
        { id: 1, transactionType: "order", orderDate: "2026-10-05", paymentAmount: 99999, items: [{ quantityDozen: 3, quantityPair: 2 }] },
        { id: 2, transactionType: "visit", orderDate: "2026-10-05", visitReport: '{"action":"follow_up","notes":"زيارة متابعة"}' },
      ],
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });

    expect(report.salesAmount).toBe(732.5);
    expect(report.collectionAmount).toBe(200);
    expect(report.salesRows).toHaveLength(2);
    expect(report.salesRows.map((row) => row.reportSource)).toEqual(["مبيعات أداء المندوب", "سجل المبيعات السابق"]);
    expect(report.orderRows).toHaveLength(1);
    expect(report.visitRows).toHaveLength(1);
    expect(exactPairs(report.orderRows[0].items[0], "item")).toBe(38);
  });

  it("retains decimal yarn weights and calculates waste only against yarn grams", () => {
    const metrics = productionMetrics([{
      productionDate: "2026-10-05",
      productionDozen: 1,
      productionPairs: 1,
      secondGradeDozen: 0,
      secondGradePairs: 2,
      yarnCotton: 1.25,
      yarnNylon: 0.5,
      wasteThreadGrams: 3,
      wasteSocksGrams: 1,
      needlesUsed: 0,
      wasteNeedles: 2,
    }]);

    expect(metrics.totalPairs).toBe(13);
    expect(metrics.firstPairs).toBe(11);
    expect(metrics.secondPairs).toBe(2);
    expect(metrics.yarnGrams).toBeCloseTo(22.75, 8);
    expect(metrics.wastePercent).toBeCloseTo(4 / 22.75 * 100, 8);
    expect(metrics.wasteNeedles).toBe(2);
  });

  it("derives a historical closing and opening balance from current finished stock without double-counting stock as a movement", () => {
    const period = warehousePeriod({
      stock: [{ id: 1, totalPairs: 120 }],
      movements: [
        { id: 1, movementType: "receipt", totalPairs: 36, createdAt: "2026-10-05T08:00:00+03:00" },
        { id: 2, movementType: "issue", totalPairs: 12, createdAt: "2026-10-05T10:00:00+03:00" },
        { id: 3, movementType: "receipt", totalPairs: 24, createdAt: "2026-10-06T08:00:00+03:00" },
      ],
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });

    expect(period.movements).toHaveLength(2);
    expect(period.receiptPairs).toBe(36);
    expect(period.issuePairs).toBe(12);
    expect(period.openingPairs).toBe(72);
    expect(period.closingPairs).toBe(96);
    expect(period.currentPairs).toBe(120);
  });
});
