import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/cost-comparison-report.tsx"), "utf8");

describe("cost comparison report date contract", () => {
  it("normalizes calendar bounds and filters each source through the shared operational-date contract", () => {
    expect(source).toContain('import { DateField } from "@/components/date-field"');
    expect(source).toContain('import { businessDate, exactPairs, inReportPeriod, reportDate } from "@shared/operational-report"');
    expect(source).toContain("const normalizedStart = reportDate(startDate);");
    expect(source).toContain("const normalizedEnd = reportDate(endDate);");
    expect(source).toContain("const periodStart = reversedPeriod ? normalizedEnd : normalizedStart;");
    expect(source).toContain("const periodEnd = reversedPeriod ? normalizedStart : normalizedEnd;");
    expect(source).toContain("const date = businessDate(row, kind);");
    expect(source).toContain("if (!inReportPeriod(row, kind, startDate, endDate)) continue;");
    expect(source).toContain(".sort((a, b) => a.month.localeCompare(b.month))");
    expect(source).not.toContain("mockData");
  });
});
