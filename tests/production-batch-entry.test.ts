import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productionSource = readFileSync(resolve(process.cwd(), "app/production.tsx"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "lib/services/api.service.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("Production batch entry", () => {
  it("keeps all machine, shift, and product entries in one draft before saving", () => {
    expect(productionSource).toContain("مسودة إدخال الإنتاج");
    expect(productionSource).toContain("حفظ كل الإنتاج");
    expect(productionSource).toContain("productionService.createBatch(batchEntries)");
    expect(productionSource).toContain("يمكنك الاستمرار بإضافة منتجات ومكائن وورديات، ثم حفظ الكل مرة واحدة");
  });

  it("uses the batch endpoint and creates the Rosso handover for every saved entry", () => {
    expect(apiSource).toContain('createBatch: (entries: any[]) => trpcCall("production.createBatch", { entries })');
    expect(routerSource).toContain("createBatch: protectedProcedure");
    expect(routerSource).toContain("for (const entry of input.entries)");
    expect(routerSource).toContain("const savedProduction = await findExistingProduction(db, entry)");
    expect(routerSource).toContain("createInitialProductionHandover(db, { ...entry, productionId: savedProduction.id }, ctx.user)");
    expect(routerSource).toContain("productionId: record.productionId || null");
  });

  it("rejects manual stage insertion after the automatic production handover cutover", () => {
    expect(routerSource).toContain("لا تتم إضافة المنتجات يدوياً من مراحل التسليم؛ أدخل المنتج من شاشة الإنتاج ليظهر تلقائياً في قائمة الاستلام");
    expect(routerSource).toContain("if (isAutomaticHandoverActive(input.date))");
  });

  it("rejects duplicate production fingerprints and reports already-executed entries", () => {
    expect(routerSource).toContain("productionEntryFingerprint");
    expect(routerSource).toContain("inFlightProductionKeys");
    expect(routerSource).toContain("skippedDuplicates");
    expect(routerSource).toContain("تم تنفيذه مسبقاً");
    expect(productionSource).toContain("تم تنفيذه مسبقاً");
  });
});

export {};
