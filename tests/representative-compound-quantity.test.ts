import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("representative compound quantity", () => {
  const routerSource = readFileSync(join(process.cwd(), "server/representative-router.ts"), "utf8");
  const schemaSource = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");
  const screenSource = readFileSync(join(process.cwd(), "app/representative-transactions.tsx"), "utf8");

  it("stores dozen and pair as separate item fields", () => {
    expect(schemaSource).toContain('quantityDozen: int("quantityDozen")');
    expect(schemaSource).toContain('quantityPair: int("quantityPair")');
    expect(screenSource).toContain('quantityDozen: 0');
    expect(screenSource).toContain('quantityPair: 0');
  });

  it("converts 3 dozen and 2 pairs to 3 plus 2/12 dozen for stock deduction", () => {
    const dozen = 3;
    const pairs = 2;
    expect(dozen + pairs / 12).toBeCloseTo(3.1666666667, 10);
    expect(routerSource).toContain("function itemQuantityDozen(item: any)");
    expect(routerSource).toContain("return dozen + pairs / 12");
    expect(routerSource).toContain("const quantityDozen = itemQuantityDozen(item)");
  });

  it("keeps enough decimal precision in finished-stock quantities", () => {
    expect(schemaSource).toContain('decimal("quantityDozen", { precision: 12, scale: 6, mode: "number" })');
  });
});
