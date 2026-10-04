import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("finished warehouse product search", () => {
  const routerSource = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");

  it("matches product names when the user omits spaces", () => {
    expect(routerSource).toContain("const compactQuery = query.replace(/\\s+/g, \"\");");
    expect(routerSource).toContain("REPLACE(${finishedWarehouseStockTable.productName}, ' ', '')");
  });

  it("keeps variant search scoped to active stock rows", () => {
    expect(routerSource).toContain("eq(finishedWarehouseStockTable.isActive, 1)");
    expect(routerSource).toContain("like(finishedWarehouseStockTable.productSize");
    expect(routerSource).toContain("like(finishedWarehouseStockTable.productColor");
  });
});
