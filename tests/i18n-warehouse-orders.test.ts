import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screenPath = resolve(process.cwd(), "app/warehouse-representative-orders.tsx");
const source = readFileSync(screenPath, "utf8");

describe("warehouse representative orders localization", () => {
  it("uses the language context and runtime direction helpers", () => {
    expect(source).toContain('import { useLanguage } from "@/lib/language-context"');
    expect(source).toContain("const { language } = useLanguage()");
    expect(source).toContain("localize");
    expect(source).toContain("isEnglish(language)");
    expect(source).toContain("textAlignFor(language)");
    expect(source).toContain("writingDirection(language)");
  });

  it("provides English alternatives instead of directly rendering core Arabic UI copy in English", () => {
    const coreCopy: Array<[string, string]> = [
      ["طلبات المناديب", "Representative orders"],
      ["طلبات العملاء المحولة للمستودعات للإخراج والتنفيذ", "Customer orders sent to warehouses for picking and fulfillment"],
      ["ابحث برقم الطلب أو العميل أو المندوب", "Search by order number, customer, or representative"],
      ["لا توجد طلبات مطابقة للبحث والفلترة", "No orders match the search and filters"],
      ["تم التنفيذ وخصم الرصيد", "Fulfill and deduct inventory"],
      ["عرض التفاصيل والسجل الزمني", "View details and timeline"],
      ["تعذر تحميل الطلبات", "Unable to load orders"],
      ["تعذر تنفيذ الإجراء", "Unable to complete the action"],
    ];

    for (const [arabic, english] of coreCopy) {
      expect(source).toContain(`l("${arabic}", "${english}")`);
    }

    expect(source).not.toMatch(/isEnglish\(language\)\s*\?\s*["'][^"']*[\u0600-\u06FF]/);
    expect(source).not.toMatch(/language\s*===\s*["']en["']\s*\?\s*["'][^"']*[\u0600-\u06FF]/);
  });

  it("applies localized direction and alignment to English and Arabic UI content", () => {
    expect(source).toContain("const rowDirection = english ? \"row\" : \"row-reverse\"");
    expect(source).toContain("textAlign={textAlign}");
    expect(source).toContain("writingDirection: direction");
    expect(source).toContain('dir="${direction}"');
  });
});
