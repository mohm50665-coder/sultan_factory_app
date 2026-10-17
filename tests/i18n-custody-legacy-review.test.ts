import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "../lib/i18n/runtime";

const screenSource = readFileSync(
  resolve(process.cwd(), "app/custody-legacy-review.tsx"),
  "utf8",
);

describe("legacy custody review localization", () => {
  it("uses the language context and runtime direction helpers", () => {
    expect(screenSource).toContain('import {useLanguage} from "@/lib/language-context";');
    expect(screenSource).toContain("const {language}=useLanguage()");
    expect(screenSource).toContain("isEnglish(language)");
    expect(screenSource).toContain("textAlignFor(language)");
    expect(screenSource).toContain("writingDirection(language)");
  });

  it("selects English fixed interface copy instead of the main Arabic labels", () => {
    const fixedCopy: Array<[string, string]> = [
      ["مراجعة العهد السابقة — رصيد افتتاحي", "Review legacy custodies — opening balance"],
      ["تحديث", "Refresh"],
      ["بحث بالموظف أو الصنف أو المرحلة", "Search by employee, product, or stage"],
      ["مراجعة وترحيل", "Review & migrate"],
      ["لا توجد عهد سابقة مؤهلة ضمن البحث. لم يتم حذف السجلات غير المؤهلة أو تغييرها.", "No eligible legacy custodies match the search. Ineligible records have not been deleted or changed."],
    ];

    expect(isEnglish("en")).toBe(true);
    expect(textAlignFor("en")).toBe("left");
    expect(writingDirection("en")).toBe("ltr");
    for (const [arabic, english] of fixedCopy) {
      expect(screenSource).toContain(`localize(language,${JSON.stringify(arabic)},${JSON.stringify(english)})`);
      expect(localize("en", arabic, english)).toBe(english);
      expect(localize("en", arabic, english)).not.toContain(arabic);
    }
  });
});
