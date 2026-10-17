import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");

const requiredEnglishCopy: Array<[string, string]> = [
  ["دفعة إنتاج جديدة", "New production batch"],
  ["مراجعة رصيد افتتاحي سابق", "Review previous opening balance"],
  ["العهد", "Custody"],
  ["اختيار صنف موجود أو إدخال تعريف جديد", "Select an existing item or enter a new definition"],
  ["تعريف الصنف — مستقل عن الدفعة", "Item definition — independent of the batch"],
  ["الخيوط والأوزان", "Yarns and weights"],
  ["بيانات دفعة الإنتاج", "Production batch details"],
  ["الكميات — جودة منفصلة وحساب بالزوج الصحيح", "Quantities — separate quality and whole-pair calculation"],
  ["هدر الإنتاج — قياس فعلي بالجرام", "Production waste — actual measurement in grams"],
  ["حفظ الدفعة وإنشاء عهد الإنتاج", "Save batch and create Production custody"],
  ["اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review"],
  ["اكتب حرفين من اسم الصنف للبحث — المقاس اختياري", "Type two letters of an item name to search — size is optional"],
  ["أكمل رمز الصنف واسمه والمقاس واللون والخاصية والماكينة والوردية والتاريخ", "Complete the item code, name, size, color, feature, machine, shift, and date."],
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
    expect(source).not.toMatch(/>دفعة إنتاج جديدة</);
    expect(source).not.toMatch(/>حفظ الدفعة وإنشاء عهد الإنتاج</);
  });

  it("uses LTR direction and left alignment in English mode while retaining Arabic user data verbatim", () => {
    expect(source).toContain("const textAlign = textAlignFor(language);");
    expect(source).toContain("const direction = writingDirection(language);");
    expect(source).toContain("const textStyle = { textAlign, direction } as const;");
    expect(source).toContain('const flowStyle = { flexDirection: english ? "row" : "row-reverse" } as const;');
    expect(source).toContain("{account.name}");
    expect(source).toContain("{product.name}");
  });
});
