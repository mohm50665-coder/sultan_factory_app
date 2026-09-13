import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/product-tracking.tsx"), "utf8");

describe("Product tracking location and handover report", () => {
  it("supports optional date ranges and independent product or employee filtering", () => {
    expect(source).toContain("dateToFilter");
    expect(source).toContain("rowDate >= dateFilter");
    expect(source).toContain("rowDate <= dateToFilter");
    expect(source).toContain("setProductFilter");
    expect(source).toContain("setEmployeeFilter");
    expect(source).toContain("مسح كل الفلاتر");
  });

  it("renders a current location and status marker for every tracked product", () => {
    expect(source).toContain("locationForProduct");
    expect(source).toContain("بانتظار الاستلام");
    expect(source).toContain("مخزّن في المستودع");
    expect(source).toContain("الموقع الحالي:");
  });

  it("prints location, status, employee, timing, quantity, and shortage details", () => {
    expect(source).toContain("الحالة الحالية");
    expect(source).toContain("الموقع الحالي");
    expect(source).toContain("وقت التسليم");
    expect(source).toContain("وقت الاستلام");
    expect(source).toContain("النقص");
    expect(source).toContain("colspan=\"17\"");
  });
});
