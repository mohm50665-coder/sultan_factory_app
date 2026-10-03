import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("representative order save flow", () => {
  it("uses atomic create-and-submit and exposes inline save errors", () => {
    const screen = read("app/representative-transactions.tsx");
    const service = read("lib/services/representative.service.ts");
    const router = read("server/representative-router.ts");
    expect(screen).toContain("createAndSubmitOrder(payload)");
    expect(screen).toContain("saveError");
    expect(screen).toContain("جارٍ الحفظ والإرسال");
    expect(service).toContain("representative.transactions.createAndSubmitOrder");
    expect(router).toContain('status: "PENDING_WAREHOUSE_ISSUE"');
    expect(router).toContain("create_and_submit_order");
  });
});
