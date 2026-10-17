import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = () => readFileSync(resolve(process.cwd(), "app/representative-sales.tsx"), "utf8");

describe("representative sales screen localization", () => {
  it("gets the active language and uses runtime localization and direction helpers", () => {
    const source = screen();

    expect(source).toContain('import { useLanguage } from "@/lib/language-context"');
    expect(source).toContain("const { language } = useLanguage()");
    expect(source).toContain("localize, isEnglish, textAlignFor, writingDirection");
    expect(source).toContain("const textAlign = textAlignFor(language)");
    expect(source).toContain("const direction = writingDirection(language)");
  });

  it("keeps core Arabic interface copy in localize-backed calls for the English view", () => {
    const source = screen();

    expect(source).toContain('copy("المبيعات", "Sales")');
    expect(source).toContain('copy("إضافة عملية بيع", "Add sale")');
    expect(source).toContain('copy("رقم الفاتورة *", "Invoice number *")');
    expect(source).toContain('copy("المبلغ *", "Amount *")');
    expect(source).toContain('copy("لا توجد سجلات مبيعات بعد", "There are no sales records yet")');
    expect(source).not.toMatch(/(?:language\s*===\s*["']en["']|isEnglish\(language\))\s*\?\s*["'`][\u0600-\u06FF]/);
  });
});
