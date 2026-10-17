import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isEnglish, localize, textAlignFor, writingDirection } from "../lib/i18n/runtime";

const screen = readFileSync(resolve(process.cwd(), "app/custody-workbench.tsx"), "utf8");

describe("custody workbench localization", () => {
  it("uses the selected language context and runtime direction helpers", () => {
    expect(screen).toContain('import { useLanguage } from "@/lib/language-context";');
    expect(screen).toContain("const { language } = useLanguage();");
    expect(screen).toContain("textAlignFor(language)");
    expect(screen).toContain("writingDirection(language)");
    expect(isEnglish("en")).toBe(true);
    expect(textAlignFor("en")).toBe("left");
    expect(writingDirection("en")).toBe("ltr");
  });

  it("provides English paths for the main fixed workbench copy", () => {
    expect(localize("en", "منضدة العهد", "Custody Workbench")).toBe("Custody Workbench");
    expect(localize("en", "ابحث برقم الدفعة أو الصنف", "Search by batch number or item")).toBe("Search by batch number or item");
    expect(localize("en", "لا توجد عهد أو تحويلات مطابقة", "No matching custody records or transfers")).toBe("No matching custody records or transfers");

    expect(screen).toContain('localize(language, "منضدة العهد", "Custody Workbench")');
    expect(screen).toContain('localize(language, "ابحث برقم الدفعة أو الصنف", "Search by batch number or item")');
    expect(screen).toContain('localize(language, "لا توجد عهد أو تحويلات مطابقة", "No matching custody records or transfers")');
    expect(screen).toContain('localize(language, "إعدادات العهد", "Custody settings")');
    expect(screen).toContain('localize(language, "حفظ الإعدادات", "Save settings")');
  });

  it("does not render fixed Arabic text directly in English-only UI attributes", () => {
    expect(screen).not.toMatch(/(?:label|placeholder|accessibilityLabel|language)="[^"\n]*[\u0600-\u06FF]/);
    expect(screen).not.toMatch(/>[^<{\n]*[\u0600-\u06FF][^<{\n]*</);
  });
});
