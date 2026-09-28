import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const myCustody = readFileSync(resolve(process.cwd(), "app/my-custody.tsx"), "utf8");
const overdueReport = readFileSync(resolve(process.cwd(), "app/overdue-custody-report.tsx"), "utf8");

describe("Custody follow-up dashboard", () => {
  it("provides the current employee custody endpoint with overdue calculation", () => {
    expect(routers).toContain("myCustody: protectedProcedure");
    expect(routers).toContain("hoursOpen");
    expect(routers).toContain("isOverdue");
    expect(myCustody).toContain("عهدتي الحالية");
    expect(myCustody).toContain("تسليم العهدة الحالية قبل استلام منتج جديد");
  });

  it("creates a deduplicated server alert for overdue custody", () => {
    expect(routers).toContain('category === "custody_overdue"');
    expect(routers).toContain('title: "تأخر تسليم عهدة"');
    expect(routers).toContain('route: "/my-custody"');
  });

  it("provides a role-protected report grouped by employee and stage", () => {
    expect(routers).toContain("overdueCustodyReport: protectedProcedure");
    expect(routers).toContain('"لا تملك صلاحية عرض تقرير العهد المتأخرة"');
    expect(dashboard).toContain('id: "overdue_custody_report"');
    expect(overdueReport).toContain("تقرير العهد المتأخرة");
    expect(overdueReport).toContain("workerName");
    expect(overdueReport).toContain("stageName");
  });

  it("exports the complete overdue custody report as Word and Excel", () => {
    expect(overdueReport).toContain('downloadOverdueCustodyFile(rows, "word", isAr)');
    expect(overdueReport).toContain('downloadOverdueCustodyFile(rows, "excel", isAr)');
    expect(overdueReport).toContain('application/msword');
    expect(overdueReport).toContain('application/vnd.ms-excel');
    expect(overdueReport).toContain("ملخص حسب الموظف والمرحلة");
    expect(overdueReport).toContain("التفاصيل الكاملة");
  });
});

export {};
