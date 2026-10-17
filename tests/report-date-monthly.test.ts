import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/monthly-reports.tsx"), "utf8");

describe("monthly report date contract", () => {
  it("normalizes the calendar range and filters every monthly source through the shared date policy", () => {
    expect(source).toContain("<DateField label={isAr ? \"من تاريخ\" : \"Start date\"}");
    expect(source).toContain("const rawStartDate = reportDate(startDate);");
    expect(source).toContain("const rawEndDate = reportDate(endDate);");
    expect(source).toContain("const periodIsReversed = hasValidPeriod && rawStartDate > rawEndDate;");
    expect(source).toContain("inReportPeriod(row, kind, startDate, endDate)");
    expect(source).toContain('businessDate(left, kind).localeCompare(businessDate(right, kind))');
    expect(source).toContain("commercialReport({");
    expect(source).toContain("Promise.allSettled([");
    expect(source).toContain('trpcCall("maintenanceEntries.getBySection"');
    expect(source).toContain("Zero substitutes are not shown when a data source fails to load.");
  });
});
