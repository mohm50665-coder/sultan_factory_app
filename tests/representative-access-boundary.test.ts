import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("Representative module access boundary", () => {
  it("requires authenticated access for maintenance records", () => {
    const block = router.slice(router.indexOf("// ===== MAINTENANCE ENTRIES ROUTER"), router.indexOf("// ===== WAREHOUSE ENTRIES ROUTER"));
    expect(block).not.toContain("getBySection: publicProcedure");
    expect(block).not.toContain("create: publicProcedure");
    expect(block).not.toContain("update: publicProcedure");
    expect(block).not.toContain("delete: publicProcedure");
    expect(block).toContain("assertRepresentativeAccess");
  });

  it("recognizes the official representative permission", () => {
    expect(router).toContain('"representative_performance"');
    expect(router).toContain('const REPRESENTATIVE_SECTIONS');
  });
});
