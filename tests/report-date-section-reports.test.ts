import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/section-reports.tsx"), "utf8");

describe("section reports report-date contract", () => {
  it("normalizes calendar boundaries, explains reversed periods, and routes each source through its shared period contract", () => {
    expect(source).toContain("reportDate(startDate)");
    expect(source).toContain("reportDate(endDate)");
    expect(source).toContain("periodIsReversed");
    expect(source).toContain("inReportPeriod(row, kind, reportStartDate, reportEndDate)");
    expect(source).toContain("businessDate(left, kind)");
    expect(source).toContain("warehousePeriod({stock:reportRows(stock),movements:sortReportRows(reportRows(movements), \"movement\"),startDate:reportStartDate,endDate:reportEndDate})");
    expect(source).toContain("commercialReport({sales:sortReportRows(reportRows(sales), \"sale\")");
    expect(source).toContain("<DateField label=\"من تاريخ\"");
    expect(source).toContain("updateReportDate(\"start\", value)");
    expect(source).toContain('trpcCall("maintenanceEntries.getBySection"');
    expect(source).toContain("لم تُعرض كصفر");
  });
});
