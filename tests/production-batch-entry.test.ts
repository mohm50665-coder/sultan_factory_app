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
    expect(routerSource).toContain("createInitialProductionHandover(db, entry, ctx.user)");
  });
});

export {};

