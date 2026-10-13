import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("sample approval and manufacturing production result", () => {
  it("keeps customer approval publicly accessible with decision reason and attachments", () => {
    const router = read("server/routers.ts");
    const screen = read("app/sample-approval.tsx");
    const layout = read("app/_layout.tsx");
    expect(router).toContain("getCustomerApproval: publicProcedure");
    expect(router).toContain("approveByCustomer: publicProcedure");
    expect(router).toContain("customerApprovalAttachments");
    expect(router).toContain("سبب عدم الموافقة إلزامي");
    expect(screen).toContain("AttachmentPicker");
    expect(screen).toContain("غير موافق");
    expect(layout).toContain('"sample-approval"');
  });

  it("notifies the requester after the customer approves or rejects the sample", () => {
    const router = read("server/routers.ts");
    expect(router).toContain('type: "sample_delivery"');
    expect(router).toContain("تمت موافقة العميل على العينة");
    expect(router).toContain("لم يوافق العميل على العينة");
    expect(router).toContain("request.requesterId");
  });

  it("provides an explicit production result and requires a reason when production fails", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers.ts");
    const api = read("lib/services/api.service.ts");
    const screen = read("app/product-manufacturing-request.tsx");
    expect(schema).toContain('productionStatus: varchar("productionStatus"');
    expect(schema).toContain('productionFailureReason: text("productionFailureReason")');
    expect(router).toContain("setProductionResult");
    expect(router).toContain('z.enum(["produced", "not_produced"])');
    expect(router).toContain("سبب عدم الإنتاج إلزامي");
    expect(router).toContain("يجب تسجيل نتيجة الإنتاج أولاً");
    expect(api).toContain("productManufacturingRequests.setProductionResult");
    expect(screen).toContain("تم الإنتاج");
    expect(screen).toContain("لم يتم الإنتاج");
    expect(screen).toContain("productionFailureReason");
  });
});
