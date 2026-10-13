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
    expect(router).toContain('candidate.role === "admin"');
    expect(router).toContain('department || "").toLowerCase() === "production"');
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
    expect(api).toContain("productManufacturingRequests.monthlyReport");
    expect(screen).toContain("تم الإنتاج");
    expect(screen).toContain("لم يتم الإنتاج");
    expect(screen).toContain("productionFailureReason");
    expect(screen).toContain("setProductionFilter");
    expect(screen).toContain("التقرير الشهري للإنتاج");
  });

  it("supports expiring and revoking customer approval links", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers.ts");
    const service = read("lib/services/data.service.ts");
    const screen = read("app/sample-requests.tsx");
    expect(schema).toContain('customerApprovalExpiresAt: timestamp("customerApprovalExpiresAt")');
    expect(schema).toContain('customerApprovalRevokedAt: timestamp("customerApprovalRevokedAt")');
    expect(router).toContain("revokeApprovalLink: protectedProcedure");
    expect(router).toContain("رابط اعتماد العينة منتهي أو تم إبطاله");
    expect(router).toContain("addBusinessDays(new Date(), 7)");
    expect(router).toContain("customerApprovalDueAt = addBusinessDays(new Date(), 1)");
    expect(router).toContain("addBusinessHours(now, 4)");
    expect(router).toContain("addBusinessHours(now, 2)");
    expect(router).toContain("correctionDueAt");
    expect(router).toContain("executionLatestDueAt");
    expect(schema).toContain('customerRequestDueAt: timestamp("customerRequestDueAt")');
    expect(schema).toContain('sampleFormDueAt: timestamp("sampleFormDueAt")');
    expect(service).toContain("revokeApprovalLink");
    expect(screen).toContain("إبطال الرابط");
    expect(screen).toContain("صلاحية الرابط حتى");
  });

  it("exports the monthly manufacturing report and shows failure rates on the board report", () => {
    const requestScreen = read("app/product-manufacturing-request.tsx");
    const boardScreen = read("app/board-monthly-report.tsx");
    expect(requestScreen).toContain("application/vnd.ms-excel");
    expect(requestScreen).toContain('exportMonthlyReport("excel")');
    expect(requestScreen).toContain('exportMonthlyReport("pdf")');
    expect(boardScreen).toContain("manufacturingRequests");
    expect(boardScreen).toContain("أسباب التعثر");
    expect(boardScreen).toContain("failureReasons.map");
    expect(boardScreen).toContain("previousManufacturingRequests");
  });
});
