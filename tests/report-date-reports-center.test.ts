import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/reports.tsx"), "utf8");

describe("reports center date contract", () => {
  it("normalizes calendar input, filters every operational source by its business date, and never masks an unavailable source as zero activity", () => {
    expect(source).toContain("reportDate(start)");
    expect(source).toContain("reportDate(end || start)");
    expect(source).toContain("startDate: reversed ? requestedEnd : requestedStart");
    expect(source).toContain("endDate: reversed ? requestedStart : requestedEnd");
    expect(source).toContain("inReportPeriod(row, \"production\", period.startDate, period.endDate)");
    expect(source).toContain("inReportPeriod(row, \"general\", period.startDate, period.endDate)");
    expect(source).toContain("warehousePeriod({ stock: sources.stock || [], movements: sources.movements || [], startDate: period.startDate, endDate: period.endDate })");
    expect(source).toContain("commercialReport({");
    expect(source).toContain("sortRowsByBusinessDate");
    expect(source).toContain("businessDate(left, kind)");
    expect(source).toContain("hasReportRows(result.value)");
    expect(source).toContain("else failures[key] = true;");
    expect(source).toContain("copy.notZeroActivity");
  });
});
