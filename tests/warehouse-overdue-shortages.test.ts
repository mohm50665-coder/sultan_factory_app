import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("warehouse overdue and shortage workflow", () => {
  it("exposes a dedicated overdue report and scans before loading", () => {
    const screen = read("app/warehouse-overdue-orders.tsx");
    const warehouse = read("app/warehouse.tsx");
    expect(screen).toContain("طلبات العملاء المتأخرة");
    expect(screen).toContain("scanOverdue");
    expect(warehouse).toContain("warehouse-overdue-orders");
  });

  it("requires structured shortage quantities for partial execution", () => {
    const screen = read("app/warehouse-representative-orders.tsx");
    const service = read("lib/services/representative.service.ts");
    const router = read("server/representative-router.ts");
    expect(screen).toContain("warehouseShortages");
    expect(screen).toContain("issuedDozen");
    expect(service).toContain("warehouseShortages");
    expect(router).toContain("حدد الصنف الناقص والكميات المطلوبة والمنفذة والناقصة");
    expect(router).toContain('type: "warehouse_shortage"');
  });
});
