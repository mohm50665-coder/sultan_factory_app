import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");

describe("دفعة إنتاج موحدة للماكينة والوردية", () => {
  it("يتيح حتى خمسة منتجات ولا يخلط البيانات التشغيلية المشتركة ببيانات المنتج", () => {
    expect(page).toContain("MAX_PRODUCTS_PER_MACHINE_SHIFT = 5");
    expect(page).toContain("drafts.length >= MAX_PRODUCTS_PER_MACHINE_SHIFT");
    expect(page).toContain("بيانات الماكينة والوردية المشتركة");
    expect(page).toContain("منتجات هذه الماكينة والوردية");
    expect(page).toContain("حتى 5 منتجات");
  });

  it("يحسب لكل بطاقة رمز الصنف آلياً من الاسم والمقاس واللون ويحتفظ بالكميات والجودة والهدر مستقلة", () => {
    expect(page).toContain("automaticItemCode(draft.name, draft.size, draft.color)");
    expect(page).toContain("رمز الصنف (آلي)");
    expect(page).toContain("النخب الأول / درزن");
    expect(page).toContain("النخب الثاني / درزن");
    expect(page).toContain("هدر الخيوط (جرام)");
  });

  it("يرسل المجموعة إلى مسار حفظ ذري واحد ولا يرسل دفعات منفردة للمنتجات العادية", () => {
    expect(page).toContain('trpcCall("custodyV2.createBatchGroup"');
    expect(page).toContain('products: batches.map');
    expect(page).toContain('sampleId\n        ? await trpcCall("custodyV2.createBatch", batches[0])');
  });
});
