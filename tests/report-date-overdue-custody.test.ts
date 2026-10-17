import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/overdue-custody-report.tsx"), "utf8");

describe("overdue custody report date contract", () => {
  it("normalizes receipt dates, filters them through the shared report period, and blocks reversed periods", () => {
    expect(screen).toContain('const custodyReceivedDate = (row: CustodyRow): string => reportDate(row?.receivedAt);');
    expect(screen).toContain('inReportPeriod({ ...row, date: custodyReceivedDate(row) }, "general", normalizedStartDate, normalizedEndDate)');
    expect(screen).toContain("normalizedStartDate > normalizedEndDate");
    expect(screen).toContain("<DateField value={startDate}");
    expect(screen).toContain("<DateField value={endDate}");
    expect(screen).toContain(".sort(sortCustodyRows)");
  });
});
