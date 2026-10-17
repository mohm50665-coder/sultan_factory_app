import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { localize } from "../lib/i18n/runtime";

const root = resolve(__dirname, "..");
const screen = readFileSync(resolve(root, "app/finished-warehouse-inventory.tsx"), "utf8");

const coreCopy: Array<[arabic: string, english: string]> = [
  ["التخزين والمستودعات — إنتاج تام", "Storage & Warehouses — Finished Goods"],
  ["إجمالي الأصناف", "Total items"],
  ["اكتب اسم المنتج أو المقاس أو اللون للبحث فقط", "Search by product name, size, or color only"],
  ["طلب تصنيع منتج", "Request product manufacturing"],
  ["جارٍ تحميل الرصيد...", "Loading inventory..."],
  ["لا توجد أصناف في العرض الحالي", "No items in the current view"],
  ["اسم المنتج", "Product name"],
  ["الحالة", "Status"],
  ["تعذر تحميل المخزون", "Unable to load inventory"],
  ["تقرير مستودع الإنتاج التام", "Finished Goods Warehouse Report"],
];

describe("finished warehouse inventory localization", () => {
  it("reads the selected language and applies the runtime direction helpers", () => {
    expect(screen).toContain('import { useLanguage } from "@/lib/language-context"');
    expect(screen).toContain("const { language } = useLanguage()");
    expect(screen).toContain("isEnglish(language)");
    expect(screen).toContain("writingDirection(language)");
    expect(screen).toContain("textAlignFor(language)");
  });

  it("selects English core UI copy instead of exposing its Arabic source text in English", () => {
    expect(screen).toContain("const copy = (arabic: string, englishText: string) => localize(language, arabic, englishText)");
    for (const [arabic, english] of coreCopy) {
      expect(screen).toContain(JSON.stringify(arabic));
      expect(screen).toContain(JSON.stringify(english));
      expect(localize("en", arabic, english)).toBe(english);
    }
  });

  it("does not place Arabic fixed copy directly in an explicit English branch", () => {
    const explicitEnglishBranches = [
      ...screen.matchAll(/(?:english|isEnglish\(language\)|language\s*===\s*["']en["'])\s*\?\s*([^:\n;]+)/g),
    ].map((match) => match[1]);

    expect(explicitEnglishBranches).not.toContainEqual(expect.stringMatching(/[\u0600-\u06FF]/));
  });
});
