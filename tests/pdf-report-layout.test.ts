import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("board report print layout", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/services/pdf-export.service.ts"), "utf8");
  it("keeps the printed report compact and adds a visible print action", () => {
    expect(source).toContain("padding: 10px");
    expect(source).toContain(".print-button");
    expect(source).toContain("window.print()");
    expect(source).toContain("grid-template-columns: repeat(4, 1fr)");
  });
});
