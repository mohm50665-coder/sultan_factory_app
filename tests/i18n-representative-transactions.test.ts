import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screen = readFileSync(
  resolve(process.cwd(), "app/representative-transactions.tsx"),
  "utf8",
);

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("representative transactions i18n", () => {
  it("uses the language context and runtime localization helpers", () => {
    expect(screen).toContain(
      'import { useLanguage } from "@/lib/language-context"',
    );
    expect(screen).toContain("const { language } = useLanguage()");
    expect(screen).toContain("localize(language");
    expect(screen).toContain("isEnglish(language)");
    expect(screen).toContain("textAlignFor(language)");
    expect(screen).toContain("writingDirection(language)");
  });

  it("does not leave core Arabic interface copy direct in the English branch", () => {
    expect(screen).toContain('order: { ar: "الطلبات", en: "Orders" }');
    expect(screen).toMatch(
      /localize\(\s*language,\s*TRANSACTION_LABELS\[type\]\.ar,\s*TRANSACTION_LABELS\[type\]\.en/,
    );

    const coreCopy = [
      ["جدول بيانات العميل", "Customer information"],
      ["بحث في دليل العملاء", "Search customer directory"],
      ["حفظ كمسودة", "Save as draft"],
      ["لا توجد معاملات من هذا النوع", "No transactions of this type"],
      ["تعذر الحفظ", "Unable to save"],
      ["التوقيع والإرسال", "Sign and send"],
    ];

    for (const [arabic, english] of coreCopy) {
      expect(screen).toMatch(
        new RegExp(
          `t\\(\\s*"${escaped(arabic)}",\\s*"${escaped(english)}"`,
          "s",
        ),
      );
      expect(screen).not.toMatch(
        new RegExp(`<Text[^>]*>\\s*${escaped(arabic)}\\s*</Text>`, "s"),
      );
    }
  });
});
