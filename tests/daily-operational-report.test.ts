import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { commercialReport, exactPairs, inReportPeriod, productionMetrics, warehousePeriod } from "../shared/operational-report";

const screen = readFileSync(resolve(process.cwd(), "app/daily-summary.tsx"), "utf8");

describe("daily operational report", () => {
  it("keeps invoice sales separate from orders and visits, while retaining their details", () => {
    const report = commercialReport({
      sales: [{ id: 1, invoiceDate: "2026-10-05", amount: 632.5 }],
      legacySales: [],
      collections: [{ id: 1, collectionDate: "2026-10-05", collectedAmount: 200 }],
      legacyCollections: [],
      transactions: [
        { id: 1, transactionType: "order", orderDate: "2026-10-05", paymentAmount: 99999 },
        { id: 2, transactionType: "visit", orderDate: "2026-10-05", paymentAmount: 99999 },
      ],
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });

    expect(report.salesAmount).toBe(632.5);
    expect(report.collectionAmount).toBe(200);
    expect(report.salesRows).toHaveLength(1);
    expect(report.orderRows).toHaveLength(1);
    expect(report.visitRows).toHaveLength(1);
    expect(screen).toContain("representativeService.sales.list({})");
    expect(screen).toContain("المبيعات — فواتير فقط");
    expect(screen).toContain("reportOrderRows");
    expect(screen).toContain("reportVisitRows");
    expect(screen).toContain("تفاصيل فواتير المبيعات");
  });

  it("uses source business dates and does not leak an old operation through an update or delivery date", () => {
    const staleOrder = { orderDate: "2026-10-04", deliveryDate: "2026-10-05", updatedAt: "2026-10-05", createdAt: "2026-10-05" };
    expect(inReportPeriod(staleOrder, "transaction", "2026-10-05", "2026-10-05")).toBe(false);
    expect(screen).toContain("inReportPeriod(row, kind, reportDate, reportEndDate, showAllDates)");
    expect(screen).toContain("لا يسمح createdAt/updatedAt/deliveryDate");
  });

  it("keeps item units and collection fields explicit in UI and print output", () => {
    expect(exactPairs({ quantity: 3, quantityUnit: "dozen" }, "item")).toBe(36);
    expect(exactPairs({ quantity: 7, quantityUnit: "pair" }, "item")).toBe(7);
    expect(screen).toContain("transactionItemsLabel");
    expect(screen).toContain("attachmentLabel");
    expect(screen).toContain("receiptNumber");
    expect(screen).toContain("invoiceAmount == null");
    expect(screen).toContain("remainingAmount == null");
    expect(screen).toContain("تفاصيل التحصيل");
  });

  it("uses production metrics and ledger balances without fabricating a waste rate or duplicating storage", () => {
    const production = productionMetrics([{ productionPairs: 5, secondGradePairs: 6, wasteThreadGrams: 2 }]);
    expect(production.firstPairs).toBe(-1);
    expect(production.invalidQuantityCount).toBe(1);
    expect(production.wastePercent).toBeNull();

    const ledger = warehousePeriod({
      movements: [{ id: 1, movementType: "receipt", totalPairs: 24, movementDate: "2026-10-05" }],
      stock: [{ totalPairs: 24 }],
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });
    expect(ledger.receiptPairs).toBe(24);
    expect(ledger.closingPairs).toBe(24);
    expect(screen).toContain("productionMetrics(filtered.production)");
    expect(screen).toContain("warehousePeriod({ movements: data.warehouseMovements");
    expect(screen).toContain("التخزين والمستودعات — إنتاج تام");
    expect(screen).toContain("totalWastePercentage === null");
  });

  it("uses full source data in both screen and print, including custody, without mutations on opening", () => {
    expect(screen).toContain("custodyService.list()");
    expect(screen).toContain("buildCustodyReport");
    expect(screen).toContain("reportPrintHtml(custodyReport)");
    expect(screen).toContain("custodyPrintBody");
    expect(screen).not.toContain("alertsService.create");
    expect(screen).not.toContain("handovers.slice(");
    expect(screen).not.toContain("remaining.slice(");
    expect(screen).not.toContain("warehouseStock.slice(");
  });
});
