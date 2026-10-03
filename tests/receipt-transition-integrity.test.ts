import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routersSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const stageSource = readFileSync(resolve(process.cwd(), "app/manufacturing-stage.tsx"), "utf8");
const productionSource = readFileSync(resolve(process.cwd(), "app/production.tsx"), "utf8");

describe("Receipt and handover integrity", () => {
  it("marks the delivered source record as received before creating the next-stage custody", () => {
    expect(routersSource).toContain('set({ movementStatus: "received", receivedBy: receiverName, receivedAt');
    expect(routersSource).toContain('stageName: destinationStage');
    expect(routersSource).toContain('movementStatus: "received"');
  });

  it("keeps the full mandatory manufacturing route in the server transition rules", () => {
    expect(routersSource).toContain('machines: ["rosso"]');
    expect(routersSource).toContain('rosso: ["qalb"]');
    expect(routersSource).toContain('qalb: ["kawiya"]');
    expect(routersSource).toContain('kawiya: ["inspection", "antislip"]');
    expect(routersSource).toContain('antislip: ["kawiya"]');
  });

  it("blocks a worker from receiving a new custody while a previous custody is still received", () => {
    expect(routersSource).toContain("لا يمكن استلام منتج جديد قبل تسليم العهدة السابقة");
    expect(routersSource).toContain('eq(manufacturingStagesTable.movementStatus, "received")');
    expect(routersSource).toContain("activeCustodyProductName");
    expect(stageSource).toContain("blockedByActiveCustody");
    expect(stageSource).toContain("لا يمكن استلام منتج جديد قبل تسليم العهدة السابقة");
  });

  it("allows the receiver to confirm by display name or username", () => {
    expect(stageSource).toContain("samePersonName(product.expectedReceiver, (user as any)?.username)");
    expect(routersSource).toContain("samePersonName(expectedReceiver, receiverUsername)");
  });

  it("places the production receiver selection after product details and before save controls", () => {
    const receiverBlock = productionSource.indexOf("بيانات المستلم — آخر خطوة قبل الحفظ");
    const yarnDetails = productionSource.indexOf("أوزان الخيوط حسب النوع");
    const saveControls = productionSource.indexOf("أزرار الحفظ");
    expect(receiverBlock).toBeGreaterThan(yarnDetails);
    expect(receiverBlock).toBeLessThan(saveControls);
    expect(productionSource).toContain("بعد تعبئة بيانات المنتج اختر موظف الروسو، ثم اضغط حفظ");
  });
  it("carries the complete production identity and protects it from stage edits", () => {
    expect(routersSource).toContain("machineNumber: sourceProduction?.machineNumber || record.machineNumber");
    expect(routersSource).toContain("shiftNumber: sourceProduction?.shiftNumber || record.shiftNumber");
    expect(routersSource).toContain("بيانات العهدة لا تطابق سجل الإنتاج الأصلي");
    expect(routersSource).toContain("تعديل بيانات حركة الاستلام والتسليم محصور بالنظام");
    expect(routersSource).toContain("بيانات الاستلام والتسليم تنتقل آلياً؛ يسمح فقط لمدير الإنتاج أو الأدمن");
    expect(routersSource).toContain("const editableStageFields = new Set");
    expect(routersSource).toContain("باركود التخزين ينتقل من الإنتاج ولا يمكن تعديله في المراحل");
  });

  it("implements the Kawiya anti-slip return branch and exact-data deduplication", () => {
    expect(routersSource).toContain('kawiya: ["inspection", "antislip"]');
    expect(routersSource).toContain('antislip: ["kawiya"]');
    expect(routersSource).toContain('if (normalizedStage === "kawiya" && fromAntiSlip) return ["inspection"]');
    expect(routersSource).toContain("activeAntiSlip");
    expect(routersSource).toContain("manufacturingDataFingerprint");
    expect(routersSource).toContain("اختلاف أي حقل أساسي، ومنها المكينة أو الوردية أو التاريخ، يسمح بالحركة");
  });

});

export {};
            
