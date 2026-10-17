import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inReportPeriod, productionMetrics } from "../shared/operational-report";

const board = readFileSync(resolve(process.cwd(), "app/board-monthly-report.tsx"), "utf8");

describe("board report date contract", () => {
  it("keeps a production record whose business date differs from its later save timestamp in a one-day report", () => {
    const rows = [
      {
        id: 1440001,
        date: "2026-10-09",
        createdAt: "2026-10-10T06:50:18.000Z",
        movementAt: "2026-10-10T06:50:18.000Z",
        productionDozen: 6,
        productionPairs: 0,
        yarnCotton: 5.5,
        wasteThreadGrams: 50,
      },
    ];
    const selected = rows.filter((row) =>
      inReportPeriod(row, "production", "2026-10-09", "2026-10-09"),
    );

    expect(selected).toHaveLength(1);
    expect(productionMetrics(selected).totalPairs).toBe(72);
  });

  it("normalizes the selected range, filters each source by its operational date, and places the independent custody cycle after the operating summary", () => {
    expect(board).toContain('reportDate(customStart)');
    expect(board).toContain('reportDate(customEnd)');
    expect(board).toContain('const wasReversed = rawStart > rawEnd;');
    expect(board).toContain('inReportPeriod(row, "production", range.start, range.end)');
    expect(board).toContain('inReportPeriod(row, "general", range.start, range.end)');
    expect(board).toContain('commercialReport({');
    expect(board).toContain('warehousePeriod({');
    expect(board).toContain('sortReportRows(commercial.salesRows, "sale")');
    expect(board).toContain('businessDate(row, "transaction")');
    expect(board).toContain("CalendarDateField");
    const operatingSummary = board.indexOf("{/* Summary Cards */}");
    const independentCustody = board.indexOf("دورة العهد الجديدة المستقلة");
    expect(operatingSummary).toBeGreaterThan(-1);
    expect(independentCustody).toBeGreaterThan(operatingSummary);
  });
});
