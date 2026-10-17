import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/representative-reports.tsx"), "utf8");

describe("Representative report date contract", () => {
  it("normalizes the selected range and delegates each operational source to the shared commercial filter", () => {
    expect(source).toContain("reportDate(startValue)");
    expect(source).toContain("reportDate(endValue || startValue)");
    expect(source).toContain("commercialReport({");
    expect(source).toContain("startDate: dateRange?.start || \"\"");
    expect(source).toContain("endDate: dateRange?.end || \"\"");
    expect(source).toContain("sortReportRows");
    expect(source).toContain("const leftDate = businessDate(left, kind)");
    expect(source).toContain("const rightDate = businessDate(right, kind)");
    expect(source).toContain("<DateField value={startDate}");
    expect(source).toContain("<DateField value={endDate}");
  });
});
