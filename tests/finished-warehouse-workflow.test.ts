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

  it("requires and carries a barcode for production, warehouse stock, and manufacturing requests", () => {
    const router = read("server/routers.ts");
    const productionScreen = read("app/production.tsx");
    const requestScreen = read("app/product-manufacturing-request.tsx");
    expect(router).toContain("resolveProductionBarcode");
    expect(router).toContain("لا يمكن نقل منتج إلى مراحل التصنيع بدون باركود");
    expect(router).toContain("barcode: z.string().min(2, \"باركود المنتج إلزامي\")");
    expect(productionScreen).toContain("باركود المنتج");
    expect(requestScreen).toContain("الباركود *");
    expect(requestScreen).toContain("setBarcode");
  });

  it("requires selecting an exact warehouse variant before treating its quantity as selected", () => {
    const screen = read("app/product-manufacturing-request.tsx");
    const router = read("server/routers.ts");
    expect(screen).toContain("selectedStock");
    expect(screen).toContain("اختر المنتج المحدد");
    expect(screen).toContain("الكمية أدناه تخص هذا المقاس واللون فقط");
    expect(screen).toContain("handleProductNameChange");
    expect(screen).toContain("حدد نسخة المنتج");
    expect(router).toContain("like(finishedWarehouseStockTable.productSize");
    expect(router).toContain("like(finishedWarehouseStockTable.productColor");
  });
});
