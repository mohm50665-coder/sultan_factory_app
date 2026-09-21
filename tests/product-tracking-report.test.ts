import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/product-tracking.tsx"), "utf8");

describe("Product tracking location and handover report", () => {
  it("supports optional date ranges and independent product or employee filtering", () => {
    expect(source).toContain("dateToFilter");
    expect(source).toContain("rowDate >= appliedDateFilter");
    expect(source).toContain("rowDate <= appliedDateToFilter");
    expect(source).toContain("setProductFilter");
    expect(source).toContain("setEmployeeFilter");
    expect(source).toContain("مسح كل الفلاتر");
    expect(source).toContain("defaultSaturdayThursdayRange");
    expect(source).toContain("start: dateKey(start), end: dateKey(end)");
  });

  it("uses a date picker for both report range boundaries", () => {
    expect(source).toContain("<DateField value={dateFilter}");
    expect(source).toContain("<DateField value={dateToFilter}");
    expect(source).toContain('style={{ width: "100%", marginBottom: 10 }}');
    expect(source).toContain('style={{ width: "100%", marginBottom: 4 }}');
    expect(source).toContain("اضغط داخل خانة التاريخ لفتح التقويم، ثم اضغط بحث لعرض النتائج");
    expect(source).toContain("applyDateFilter");
    expect(source).toContain("بحث وعرض التقرير");
    expect(source).toContain("appliedDateFilter");
    expect(source).toContain("appliedDateToFilter");
    expect(source).not.toContain('placeholder={isAr ? "من تاريخ YYYY-MM-DD"');
    expect(source).not.toContain('placeholder={isAr ? "إلى تاريخ YYYY-MM-DD"');
  });

  it("renders a current location and status marker for every tracked product", () => {
    expect(source).toContain("locationForProduct");
    expect(source).toContain("latestProductionForProduct");
    expect(source).toContain("تاريخ ووقت إدخال المنتج:");
    expect(source).toContain("آخر حركة:");
    expect(source).toContain('weekday: "long"');
    expect(source).toContain("بانتظار الاستلام");
    expect(source).toContain("مخزّن في المستودع");
    expect(source).toContain("الموقع الحالي:");
  });

  it("prints location, status, employee, timing, quantity, and shortage details", () => {
    expect(source).toContain("طباعة تقرير الاستلام والتسليم");
    expect(source).toContain('accessibilityLabel={isAr ? "طباعة تقرير الاستلام والتسليم"');
    expect(source).toContain("الحالة الحالية");
    expect(source).toContain("الموقع الحالي");
    expect(source).toContain("وقت التسليم");
    expect(source).toContain("وقت الاستلام");
    expect(source).toContain("يوم وتاريخ ووقت التسليم");
    expect(source).toContain("يوم وتاريخ ووقت الاستلام");
    expect(source).toContain("مدة بقاء المنتج لدى المرحلة");
    expect(source).toContain("تاريخ ووقت طباعة التقرير");
    expect(source).toContain("النقص");
    expect(source).toContain("مدة بقاء المنتج لدى المرحلة:");
    expect(source).toContain("المستلم الفعلي:");
    expect(source).toContain("colspan=\"7\"");
    expect(source).toContain("@page{size:A4 landscape;margin:8mm}");
    expect(source).toContain("thead{display:table-header-group}");
  });
});
