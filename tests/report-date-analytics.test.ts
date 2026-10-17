import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/reports-analytics.tsx"), "utf8");

describe("reports analytics date contract", () => {
  it("uses calendar dates and the unified production-period contract without masking source failures", () => {
    expect(screen).toContain('import { DateField } from "@/components/date-field"');
    expect(screen).toContain("reportDate(dateRange.startDate)");
    expect(screen).toContain("reportDate(dateRange.endDate)");
    expect(screen).toContain('inReportPeriod(row, "production", effectiveStartDate, effectiveEndDate)');
    expect(screen).toContain('businessDate(right, "production")');
    expect(screen).toContain('businessDate(left, "production")');
    expect(screen).toContain("rangeIsReversed");
    expect(screen).toContain("setSourceError");
    expect(screen).toContain("Results are not shown as zeros");
  });
});
