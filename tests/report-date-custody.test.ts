import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/custody-reports.tsx"), "utf8");

describe("custody report date contract", () => {
  it("normalizes calendar boundaries, rejects an inverted period, and withholds results on source failure", () => {
    expect(source).toContain('import { reportDate } from "@shared/operational-report"');
    expect(source).toContain("const normalizedStartDate = reportDate(startDate);");
    expect(source).toContain("const normalizedEndDate = reportDate(endDate);");
    expect(source).toContain("normalizedEndDate < normalizedStartDate");
    expect(source).toContain("startDate: normalizedStartDate,");
    expect(source).toContain("endDate: normalizedEndDate,");
    expect(source).toContain("if (dateRangeError)");
    expect(source).toContain("report && !loading && !error && !reportResult.calculationError");
  });
});
