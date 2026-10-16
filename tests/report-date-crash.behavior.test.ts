import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeReportDateInput, dateFieldCommit, calendarDateKey } from "../shared/report-date-input";
import { buildCustodyReport, riyadhRange } from "../shared/custody-reporting";

describe("report calendar regression — partial edits must not crash a report", () => {
  it.each(["", "2", "2026", "2026-", "2026-10-", "05/10/", "2026-02-30", "2026-13-01", "hello"])("does not commit incomplete or impossible date %s", value => {
    expect(dateFieldCommit(value)).toBeNull();
  });
  it("keeps the last valid report through every keystroke and clearing", () => {
    let committed = "2026-10-16";
    for (const partial of ["", "2", "20", "2026-", "2026-10", "2026-10-", "2026-10-05"]) {
      const next = dateFieldCommit(partial);
      if (next !== null) committed = next;
      expect(() => buildCustodyReport({ batches: [], accounts: [], settings: { enabled: false, stageLimits: {}, shifts: [], holidays: [] }, filters: { startDate: committed, endDate: "2026-10-16" } })).not.toThrow();
    }
    expect(committed).toBe("2026-10-05");
  });
  it.each(["05/10/2026", "٥/١٠/٢٠٢٦", "۰۵/۱۰/۲۰۲۶", "\u200f٢٠٢٦-١٠-٠٥\u200e", "2026-10-5"])("normalizes complete date %s", value => {
    expect(normalizeReportDateInput(value)).toBe("2026-10-05");
    const range = riyadhRange(value, value);
    expect(range.start.toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });
  it("rejects impossible dates instead of rolling them into a different month", () => {
    expect(normalizeReportDateInput("2024-02-29")).toBe("2024-02-29");
    expect(() => riyadhRange("2026-02-30", "2026-03-02")).toThrow();
    expect(() => riyadhRange("2026-10-16", "2026-10-05")).toThrow();
  });
  it("allows intentional clearing only on optional date fields", () => {
    expect(dateFieldCommit("", false)).toBe("");
    expect(dateFieldCommit("", true)).toBeNull();
  });
  it("serializes the native selected day in local calendar time, not UTC", () => {
    const selected = new Date(2026, 9, 5, 0, 0);
    expect(calendarDateKey(selected)).toBe("2026-10-05");
    expect(calendarDateKey(new Date("invalid"))).toBe("");
  });
  it("both main reports use the shared calendar and the comprehensive report contains local error recovery", () => {
    const daily = readFileSync("app/daily-summary.tsx", "utf8");
    const board = readFileSync("app/board-monthly-report.tsx", "utf8");
    expect(daily).toContain('<DateField value={reportDate}');
    expect(daily).toContain('<DateField value={reportEndDate}');
    expect(daily).not.toContain('placeholder="YYYY-MM-DD"');
    expect(daily).toContain("custodyCalculation.error");
    expect(daily).toContain("catch (error)");
    expect(daily).toContain('accessibilityLabel={isAr ? "طباعة التقرير الشامل"');
    expect(board).toContain("CalendarDateField");
    expect(board).not.toContain('placeholder="YYYY-MM-DD"');
    const picker = readFileSync("components/date-field.tsx", "utf8");
    expect(picker).toContain('type: "date"');
    expect(picker).toContain("input.showPicker()");
    expect(picker).toContain("dateFieldCommit(raw, defaultToToday)");
  });
});
