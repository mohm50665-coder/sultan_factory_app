import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("finished warehouse workflow", () => {
  it("provides stock search and minimum-level monitoring", () => {
    const screen = read("app/finished-warehouse-inventory.tsx");
    const api = read("lib/services/api.service.ts");
    expect(screen).toContain("مستودع الإنتاج التام");
    expect(screen).toContain("راكدة");
    expect(screen).toContain("طلب تصنيع منتج");
    expect(api).toContain("finishedWarehouseService");
    expect(api).toContain("finishedWarehouse.search");
  });

  it("shows stock availability in representative orders and offers manufacturing escalation", () => {
    const screen = read("app/representative-transactions.tsx");
    expect(screen).toContain("stockAvailability");
    expect(screen).toContain("رصيد المستودع بالدرزن");
    expect(screen).toContain("product-manufacturing-request");
  });

  it("updates finished stock when a manufacturing handover reaches storage", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("isStorageStage");
    expect(router).toContain("finishedWarehouseStockTable");
    expect(router).toContain("manufacturing_storage");
    expect(router).toContain("تنبيه انخفاض مخزون الإنتاج التام");
  });

  it("contains the approval chain and official evidence fields for manufacturing requests", () => {
    const screen = read("app/product-manufacturing-request.tsx");
    const router = read("server/routers.ts");
    expect(screen).toContain("SignaturePad");
    expect(screen).toContain("AttachmentPicker");
    expect(screen).toContain("اعتماد التسويق");
    expect(screen).toContain("اعتماد الإنتاج");
    expect(router).toContain("productManufacturingRequests");
    expect(router).toContain("PENDING_PRODUCTION");
    expect(router).toContain("PENDING_ADMIN");
  });
});
