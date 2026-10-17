import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const report = readFileSync(resolve(process.cwd(), "app/board-monthly-report.tsx"), "utf8");

describe("board monthly report English localization", () => {
  it("gets its active language from the shared language context and runtime helpers", () => {
    expect(report).toContain('import { useLanguage } from "@/lib/language-context";');
    expect(report).toContain("const { language } = useLanguage();");
    expect(report).toContain("isEnglish(language)");
    expect(report).toContain("localize(language, arabic, english)");
    expect(report).toContain("textAlignFor(language)");
    expect(report).toContain("writingDirection(language)");
  });

  it("routes core Arabic screen copy through an English alternative rather than rendering it directly", () => {
    const bilingualLabels: Array<[string, string]> = [
      ["التقرير الموحد لمجلس الإدارة", "Unified Board Report"],
      ["ملخص تشغيلي واضح حسب الفترة", "Clear operating summary by period"],
      ["الفترة:", "Period:"],
      ["اختر الشهر:", "Select Month:"],
      ["جاري تحميل البيانات...", "Loading data..."],
      ["لا توجد بيانات متاحة لهذا الشهر", "No data available for this month"],
      ["إعادة المحاولة", "Retry"],
      ["تصدير التقرير PDF", "Export Report PDF"],
      ["تم تصدير التقرير الشهري بنجاح", "Monthly report exported successfully"],
    ];

    for (const [arabic, english] of bilingualLabels) {
      expect(report).toContain(`copy("${arabic}", "${english}")`);
    }

    // Arabic headings must never be emitted as unguarded JSX children in the English branch.
    expect(report).not.toMatch(/>\s*(?:التقرير الموحد لمجلس الإدارة|الفترة:|اختر الشهر:|مقارنة بالشهر السابق)\s*</);
  });

  it("uses LTR layout helpers in English while retaining RTL support for Arabic", () => {
    expect(report).toContain('const direction = writingDirection(language);');
    expect(report).toContain('const textAlign = textAlignFor(language);');
    expect(report).toContain('const rowDirection = isEn ? "row" as const : "row-reverse" as const;');
    expect(report).toContain('directionalText = { textAlign, writingDirection: direction }');
  });
});
