import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/representative-collections.tsx"), "utf8");

describe("Representative collections i18n", () => {
  it("uses the active language and runtime localization helpers", () => {
    expect(screen).toContain('import { useLanguage } from "@/lib/language-context"');
    expect(screen).toContain("const { language } = useLanguage()");
    expect(screen).toContain("localize(language, arabic, englishText)");
    expect(screen).toContain("isEnglish(language)");
    expect(screen).toContain("textAlignFor(language)");
    expect(screen).toContain("writingDirection(language)");
    expect(screen).toContain("<AttachmentPicker attachments={files} onAttachmentsChange={setFiles} language={language} maxAttachments={3} />");
  });

  it("keeps core Arabic UI copy out of direct JSX so English uses its paired copy", () => {
    for (const arabicLiteral of [
      "التحصيل",
      "اختيار العميل",
      "بحث باسم العميل",
      "المبلغ المحصل *",
      "تاريخ التحصيل *",
      "طريقة التحصيل",
      "لا توجد سجلات تحصيل",
      "حفظ السجل",
      "تعذر الحفظ",
    ]) {
      expect(screen).toContain(`t(\"${arabicLiteral}\",`);
      expect(screen).not.toMatch(new RegExp(`>\\s*${arabicLiteral}\\s*<`));
    }

    expect(screen).toContain('t("التحصيل", "Collections")');
    expect(screen).toContain('t("لا توجد سجلات تحصيل", "No collection records")');
    expect(screen).toContain('t("حفظ السجل", "Save record")');
  });

  it("applies LTR direction and left alignment when English is selected", () => {
    expect(screen).toContain('const align = textAlignFor(language)');
    expect(screen).toContain('const direction = writingDirection(language)');
    expect(screen).toContain('const rowDirection = english ? "row" : "row-reverse"');
    expect(screen).toContain('style={{ backgroundColor: colors.background, direction }}');
  });
});
