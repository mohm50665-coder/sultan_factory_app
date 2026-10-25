import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");
const api = readFileSync(resolve(process.cwd(), "lib/services/api.service.ts"), "utf8");

describe("إدخال إنتاج الماكينة والوردية — دليل المنتجات", () => {
  it("يحمل دليل المنتجات مستقلاً ولا يفقد نتائج البحث عند تعذر مصدر الموظفين", () => {
    expect(page).toContain("Promise.allSettled");
    expect(page).toContain('productsService.list()');
    expect(page).toContain('setCatalog(Array.isArray(productsResult.value) ? productsResult.value : [])');
    expect(page).toContain("البحث في دليل المنتجات متاح");
  });

  it("يرسل اعتماد جلسة الويب في طلبات API بين نطاق الواجهة والخادم", () => {
    expect(api).toContain('credentials: "include"');
    expect(api).toContain('headers["x-session-id"] = sessionId');
  });

  it("يفتح البحث بعد حرفين ويوجه الاختيار إلى بطاقة المنتج المحددة", () => {
    expect(page).toContain("needle.length < 2");
    expect(page).toContain("activeDraftIndex");
    expect(page).toContain("Search target");
    expect(page).toContain("draftFromCatalog(product)");
  });

  it("لا يقص نتائج البحث المطابقة بعدد ثابت؛ حد الخمسة خاص ببطاقات الدفعة فقط", () => {
    expect(page).not.toContain(".slice(0, 30)");
    expect(page).toContain("MAX_PRODUCTS_PER_MACHINE_SHIFT = 5");
    expect(page).toContain("suggestions.map(product");
  });

  it("يعرض كمية كل نوع خيط بالجرام مع النسبة من نفس وزن الدفعة المصروف", () => {
    expect(page).toContain("calculateYarnBreakdown");
    expect(page).toContain("الكمية المحسوبة (جرام)");
    expect(page).toContain("إجمالي الوزن المصروف للدفعة");
    expect(page).toContain("غير مسجلة");
  });
});
