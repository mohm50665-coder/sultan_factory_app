import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Global date picker contract", () => {
  it("uses the shared native/web date picker instead of a text input", () => {
    const shared = read("components/date-field.tsx");
    expect(shared).toContain("@react-native-community/datetimepicker");
    expect(shared).toContain('mode="date"');
    expect(shared).not.toContain("placeholder=\"YYYY-MM-DD\"");
  });

  it("keeps all known operational date fields on DateField", () => {
    const files = [
      "app/production.tsx",
      "app/production-export.tsx",
      "app/production-totals.tsx",
      "app/production-requests.tsx",
      "app/manufacturing-stage.tsx",
      "app/custom-manufacturing.tsx",
      "app/orders-visits.tsx",
      "app/collection.tsx",
      "app/representative-collections.tsx",
      "app/representative-transactions.tsx",
      "app/representative-reports.tsx",
      "app/maintenance-section.tsx",
      "app/board-representative.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain("DateField");
      expect(source, file).not.toContain("placeholder=\"YYYY-MM-DD\"");
    }
  });

  it("does not let custom dates override the selected monthly period", () => {
    const source = read("app/board-monthly-report.tsx");
    expect(source).toContain('period === "custom" && customStart && customEnd');
    expect(source).toContain('period === "monthly"');
    expect(source).toContain('setCustomStart(value); setPeriod("custom")');
    expect(source).toContain('setCustomEnd(value); setPeriod("custom")');
  });

  it("includes operational dates used by sales, collections, orders, and warehouse movements", () => {
    const source = read("app/daily-summary.tsx");
    const policy = read("shared/operational-report.ts");
    expect(source).toContain("inReportPeriod");
    for (const field of ["orderDate", "visitDate", "collectionDate", "receiptDate", "invoiceDate", "movementDate", "movementAt", "deliveredAt", "receivedAt"]) {
      expect(policy, field).toContain(field);
    }
    expect(policy).not.toContain('"createdAt"');
    expect(policy).not.toContain('"updatedAt"');
    expect(policy).not.toContain('"closedAt"');
  });

  it("enforces the selected date range in comprehensive and representative reports", () => {
    const comprehensive = read("app/daily-summary.tsx");
    const representatives = read("app/representative-reports.tsx");

    // A report must never offer or activate a bypass for records outside the selected dates.
    for (const source of [comprehensive, representatives]) {
      expect(source).not.toContain("setShowAllDates");
      expect(source).not.toContain("setAllDates");
      expect(source).not.toContain("All records");
      expect(source).not.toContain("كامل البيانات المسجلة");
    }
    expect(comprehensive).toContain("rowForReportPeriod(row, kind)");
    expect(comprehensive).toContain("startDate: reportPeriodStart");
    expect(comprehensive).toContain("endDate: reportPeriodEnd");
    expect(comprehensive).toContain("رصيد نهاية الفترة المختارة");
    expect(comprehensive).not.toContain("warehouseStock.map");
    expect(representatives).toContain("const filters = { startDate: dateRange.start, endDate: dateRange.end };");
  });

  it("does not render department zero cards while the report is loading", () => {
    const source = read("app/daily-summary.tsx");
    expect(source).toContain("جارٍ تحميل بيانات جميع الإدارات...");
    expect(source).toContain("loading ? (");
  });
});
