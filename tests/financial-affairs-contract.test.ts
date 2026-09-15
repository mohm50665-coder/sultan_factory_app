import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const screen = readFileSync(resolve(root, "app/financial.tsx"), "utf8");
const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const dashboard = readFileSync(resolve(root, "app/(tabs)/index.tsx"), "utf8");

describe("Administrative and financial affairs contract", () => {
  it("exposes the renamed dashboard unit", () => {
    expect(dashboard).toContain("الشؤون الإدارية والمالية");
    expect(dashboard).toContain('route: "/financial"');
  });

  it("contains all requested finance and administration sections", () => {
    expect(screen).toContain("رصيد البنك");
    expect(screen).toContain("المصروفات اليومية");
    expect(screen).toContain("تقرير العهد");
    expect(screen).toContain("التقرير المالي اليومي");
    expect(screen).toContain("الأعمال الإدارية");
    expect(screen).toContain("جدول الأعمال المطلوبة");
    expect(screen).toContain("التقرير الإداري اليومي");
  });

  it("has server procedures for custody, work items, and daily reports", () => {
    for (const procedure of [
      "listCustodies",
      "createCustody",
      "listAdministrativeWork",
      "createAdministrativeWork",
      "createFinancialDailyReport",
      "createAdministrativeDailyReport",
    ]) {
      expect(router).toContain(procedure);
    }
  });
});
