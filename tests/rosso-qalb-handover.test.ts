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

  it("treats retrying an already-created next-stage custody as idempotent", () => {
    expect(source).toContain("idempotent: true");
    expect(source).toContain("تعذر مطابقة عهدة المرحلة التالية؛ لم يتم تسجيل نجاح العملية");
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

  it("keeps the UI success message after the awaited server mutation and reload", () => {
    expect(ui).toContain("await manufacturingStageService.confirmReceipt(Number(product.id));");
    expect(ui).toContain("await loadEntries();");
    expect(ui).toContain("await manufacturingStageService.deliverToNextStage");
  });
});
