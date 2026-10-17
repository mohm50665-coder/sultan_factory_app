import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");

const requiredEnglishCopy: Array<[string, string]> = [
  ["إدخال إنتاج الماكينة والوردية", "Machine & shift production entry"],
  ["مراجعة رصيد افتتاحي سابق", "Review previous opening balance"],
  ["العهد", "Custody"],
  ["ابحث في دليل المنتجات", "Search product catalog"],
  ["بيانات الماكينة والوردية المشتركة", "Shared machine and shift details"],
  ["منتجات هذه الماكينة والوردية", "Items for this machine and shift"],
  ["الخيوط والأوزان", "Yarns and weights"],
  ["الكميات حسب الجودة", "Quantities by grade"],
  ["هدر الخيوط (جرام)", "Yarn waste (grams)"],
  ["حفظ كل المنتجات وإنشاء عهد الإنتاج", "Save all items and create Production custody"],
  ["اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review"],
  ["مثال: SP", "Example: SP"],
  ["اختر الماكينة والوردية وأكمل تاريخ ووقت العمل.", "Select machine and shift and complete work date and time."],
  ["تعذر الحفظ", "Unable to save the batch."],
];

describe("custody batch entry i18n", () => {
  it("uses the shared language context and runtime helpers", () => {
    expect(source).toContain('import { useLanguage } from "@/lib/language-context";');
    expect(source).toContain('import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";');
    expect(source).toContain("const { language } = useLanguage();");
    expect(source).toContain("const english = isEnglish(language);");
    expect(source).toContain("const l = (arabic: string, englishText: string) => localize(language, arabic, englishText);");
  });

  it("routes the principal fixed Arabic UI copy through explicit English counterparts", () => {
    for (const [arabic, english] of requiredEnglishCopy) {
      expect(source).toContain(`l("${arabic}", "${english}")`);
    }
    expect(source).not.toMatch(/>إدخال إنتاج الماكينة والوردية</);
    expect(source).not.toMatch(/>حفظ كل المنتجات وإنشاء عهد الإنتاج</);
  });

  it("uses LTR direction and left alignment in English mode while retaining Arabic user data verbatim", () => {
    expect(source).toContain("const textAlign = textAlignFor(language);");
    expect(source).toContain("const direction = writingDirection(language);");
    expect(source).toContain("const textStyle = { textAlign, writingDirection: direction } as const;");
    expect(source).toContain('const flowStyle = { flexDirection: english ? "row" : "row-reverse" } as const;');
    expect(source).toContain("{account.name}");
    expect(source).toContain("{product.name}");
  });
});
