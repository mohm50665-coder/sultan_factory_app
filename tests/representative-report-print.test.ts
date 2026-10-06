import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/representative-reports.tsx"), "utf8");

describe("Representative performance report printing", () => {
  it("uses a browser print window on web and native Print on mobile", () => {
    expect(source).toContain('Platform.OS === "web"');
    expect(source).toContain('window.open("", "_blank"');
    expect(source).toContain("printWindow.document.write(html)");
    expect(source).toContain("window.print()");
    expect(source).toContain("Print.printAsync({ html })");
  });

  it("prints the complete representative report sections", () => {
    expect(source).toContain("تقييم المندوبين");
    expect(source).toContain("تفاصيل الطلبات والمعاملات");
    expect(source).toContain("تفاصيل التحصيل");
    expect(source).toContain("@page{size:A4 landscape");
  });
});
