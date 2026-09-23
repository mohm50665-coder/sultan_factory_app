import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const ui = readFileSync(resolve(process.cwd(), "app/manufacturing-stage.tsx"), "utf8");

describe("Rosso to Qalb handover hardening", () => {
  it("verifies the source and destination after the atomic receipt transaction", () => {
    expect(source).toContain("verifiedSource[0]?.movementStatus !== \"received\"");
    expect(source).toContain("verifiedDestination[0]?.stageName !== destinationStage");
    expect(source).toContain("لم يثبت النظام انتقال العهدة فعلياً");
  });

  it("does not treat the previous-stage receipt timestamp as a duplicate next-stage receipt", () => {
    expect(source).toContain("if (record.movementStatus !== \"delivered\") return false;");
    expect(source).toContain("receivedAt هو وقت استلام هذه المرحلة من المرحلة السابقة");
    expect(source).not.toContain("if (record.receivedAt) throw new Error(\"تم تأكيد استلام هذه العهدة مسبقاً\")");
  });

  it("treats retrying an already-created next-stage custody as idempotent", () => {
    expect(source).toContain("idempotent: true");
    expect(source).toContain("تعذر مطابقة عهدة المرحلة التالية؛ لم يتم تسجيل نجاح العملية");
  });

  it("locks the source delivery state before creating the next-stage custody", () => {
    expect(source).toContain('eq(manufacturingStagesTable.movementStatus, "delivered")');
    expect(source).toContain("تمت معالجة الاستلام مسبقاً أو لم تعد العهدة بانتظار الاستلام");
    expect(source).toContain("const affectedRows = Number((sourceUpdate as any)?.[0]?.affectedRows || 0);");
  });

  it("uses the sole active account of a stage as a safe fallback for legacy receiver names", () => {
    expect(source).toContain("isSoleStageReceiver");
    expect(source).toContain("isSoleStageAssignment");
    expect(source).toContain("record.receiverStage === input.stageName");
  });

  it("requires the service layer to receive an explicit success result", () => {
    const service = readFileSync(resolve(process.cwd(), "lib/services/data.service.ts"), "utf8");
    expect(service).toContain("لم يثبت الخادم الاستلام؛ لم يتم تسجيل نجاح العملية");
    expect(service).toContain("if (!result?.success)");
  });

  it("rejects self-stage records, invalid routes, negative quantities, and same-person handovers", () => {
    expect(source).toContain("assertValidTrackingTransition");
    expect(source).toContain("لا يمكن تسجيل تسليم واستلام داخل المرحلة نفسها");
    expect(source).toContain("مسار غير مسموح");
    expect(source).toContain("لا يمكن حفظ كمية سالبة في حركة التتبع");
    expect(source).toContain("samePersonName(input.deliveredBy, input.expectedReceiver)");
    expect(source).toContain("samePersonName(next.deliveredBy, next.receivedBy)");
  });

  it("keeps the UI success message after the awaited server mutation and reload", () => {
    expect(ui).toContain("await manufacturingStageService.confirmReceipt(productId);");
    expect(ui).toContain("await loadEntries();");
    expect(ui).toContain("await manufacturingStageService.deliverToNextStage");
  });
});
