import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { localize } from "../lib/i18n/runtime";

const screenPath = resolve(process.cwd(), "app/custody-samples.tsx");
const source = readFileSync(screenPath, "utf8");

const principalCopy: Array<[arabic: string, english: string]> = [
  ["عينات متسلسلة V2", "Sequential Samples V2"],
  ["احتياج العميل ← مواصفات الإنتاج ← أمر الدفعة ← إثبات التسليم", "Customer requirement → Production specifications → Batch order → Proof of delivery"],
  ["استقبال العميل — لا رسوم ولا دفعة في هذه المرحلة", "Customer intake — no fee or payment at this stage"],
  ["تحرير مواصفات الإنتاج المعتمدة", "Edit approved production specifications"],
  ["إصدار أمر تصنيع", "Issue manufacturing order"],
  ["لا توجد طلبات عينات V2.", "No V2 sample requests."],
];

describe("custody samples screen i18n", () => {
  it("uses the language context and runtime direction helpers", () => {
    expect(source).toContain('import { useLanguage } from "@/lib/language-context";');
    expect(source).toContain("const { language } = useLanguage();");
    for (const helper of ["isEnglish", "localize", "textAlignFor", "writingDirection"]) {
      expect(source).toContain(helper);
    }
    expect(source).toContain("const direction = writingDirection(language);");
    expect(source).toContain("const textAlign = textAlignFor(language);");
  });

  it("selects English principal fixed copy rather than returning Arabic in English mode", () => {
    for (const [arabic, english] of principalCopy) {
      expect(source).toContain(arabic);
      expect(source).toContain(english);
      expect(localize("en", arabic, english)).toBe(english);
      expect(localize("en", arabic, english)).not.toBe(arabic);
    }
  });

  it("localizes fixed sample statuses but leaves fallback database values untouched", () => {
    expect(source).toContain("function statusLabel(language");
    expect(source).toContain("return label ? localize(language, label.arabic, label.english) : status;");
    expect(source).toContain("{order.clientName}");
    expect(source).toContain("{order.product.name}");
  });
});
