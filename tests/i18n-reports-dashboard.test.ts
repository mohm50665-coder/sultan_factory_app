import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/reports.tsx"), "utf8");

describe("reports dashboard localization", () => {
  it("uses the selected language and runtime direction helpers", () => {
    expect(source).toContain('import { useLanguage } from "@/lib/language-context";');
    expect(source).toContain("const { language } = useLanguage();");
    expect(source).toContain("isEnglish(language)");
    expect(source).toContain("textAlignFor(language)");
    expect(source).toContain("writingDirection(language)");
  });

  it("keeps core Arabic dashboard copy behind localize with English alternatives", () => {
    const fixedCopy: Array<[string, string]> = [
      ["التقارير والإحصائيات", "Reports & Analytics"],
      ["من تاريخ", "Start date"],
      ["إلى تاريخ", "End date"],
      ["تحديث البيانات", "Refresh data"],
      ["تعذر تحميل المصدر", "Source could not be loaded"],
      ["فتح التفاصيل", "Open details"],
      ["الإنتاج الإجمالي", "Total production"],
      ["المبيعات — الفواتير", "Sales — invoices"],
      ["رصيد نهاية الفترة", "Closing balance"],
      ["المصروفات التشغيلية", "Operating expenses"],
      ["لم تكتمل المصادر التالية:", "The following sources did not finish loading:"],
      ["فتح التقرير الشامل — التفاصيل والطباعة بنفس مصادر الحساب", "Open comprehensive report — details and printing use the same calculation sources"],
    ];

    for (const [arabic, english] of fixedCopy) {
      expect(source).toContain(`localize(language, "${arabic}", "${english}")`);
    }

    expect(source).not.toMatch(/english\s*\?\s*["'][^"']*[\u0600-\u06FF]/);
  });
});
