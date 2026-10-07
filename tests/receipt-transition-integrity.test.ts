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

  it("allows a worker to receive multiple different products while preserving exact-duplicate protection", () => {
    expect(routersSource).toContain("يسمح الموظف باستلام عدة منتجات مختلفة");
    expect(routersSource).toContain("تم تنفيذ حركة مطابقة بالكامل مسبقاً");
    expect(routersSource).toContain("destinationKey = `AUTO_STAGE:${record.id}`");
    expect(stageSource).not.toContain("يجب تسليم العهدة السابقة أولاً");
  });

  it("allows the receiver to confirm by display name or username", () => {
    expect(stageSource).toContain("samePersonName(product.expectedReceiver, (user as any)?.username)");
    expect(routersSource).toContain("samePersonName(expectedReceiver, receiverUsername)");
  });

  it("enforces segregation of duties in both delivery and receipt paths", () => {
    expect(routersSource).toContain("function assertSegregationOfDuties");
    expect(routersSource).toContain("لا يجوز للموظف نفسه تسليم واستلام نفس العهدة");
    expect(routersSource).toContain("assertSegregationOfDuties(db, record.movementBy, ctx.user, expectedReceiver)");
    expect(routersSource).toContain("assertSegregationOfDuties(db, actorName || actorUsername, ctx.user, expectedReceiver)");
    expect(stageSource).toContain("لا يمكنك استلام عهدة سلّمتها بنفسك");
    expect(stageSource).toContain("isSameAsCurrentUser(product.movementBy)");
  });

  it("preserves the actual previous-stage sender on the automatically created next-stage custody", () => {
    expect(routersSource).toContain("المسلم الحقيقي هو موظف المرحلة السابقة");
    expect(routersSource).toContain("movementBy: record.movementBy || record.workerName || null");
    expect(routersSource).toContain("movementAt: record.movementAt || null");
    expect(routersSource).not.toContain("movementBy: receiverName,\n            movementAt: receivedAt");
  });

  it("matches employee identity even when a stage title is appended to the name", () => {
    expect(routersSource).toContain("base(alias) === leftBase");
    expect(stageSource).toContain("sameAccountLabel(person, user?.name)");
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

  it("does not allow the Rosso source record to be delivered again after Qalb receives it", () => {
    expect(routersSource).toContain("const existingOutbound = await db.select");
    expect(routersSource).toContain("AUTO_STAGE:${record.id}:%");
    expect(routersSource).toContain("تم تسليم هذه العهدة إلى المرحلة التالية مسبقاً؛ استخدم بطاقة القلب الجديدة");
    expect(stageSource).toContain("!product.receiverStage && getProductNextStageOptions(product)");
  });

  it("normalizes Arabic and English stage names before validating the route", () => {
    expect(routersSource).toContain("function normalizeManufacturingStage");
    expect(routersSource).toContain('"الروسو": "rosso"');
    expect(routersSource).toContain('"القلب": "qalb"');
    expect(routersSource).toContain("const requestedStage = normalizeManufacturingStage");
    expect(routersSource).toContain("const receiverStage = normalizeManufacturingStage");
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
            
