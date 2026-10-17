import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/production-totals.tsx"), "utf8");

describe("production totals report date contract", () => {
  it("normalizes the calendar range and filters production rows through the shared operational contract", () => {
    expect(screen).toContain('reportDate(startDate)');
    expect(screen).toContain('reportDate(endDate)');
    expect(screen).toContain('inReportPeriod(entry, "production", startDate, endDate)');
    expect(screen).toContain('businessDate(item, "production")');
    expect(screen).toContain('sort((a, b) => b.date.localeCompare(a.date))');
    expect(screen).toContain('<DateField value={startDate} onChange={setNormalizedStartDate}');
    expect(screen).toContain('<DateField value={endDate} onChange={setNormalizedEndDate}');
    expect(screen).toContain('rangeReversed');
  });
});
