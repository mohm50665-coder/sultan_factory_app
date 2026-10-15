import { describe, expect, it } from "vitest";
import type { CustodyProduct } from "../shared/custody-contract.js";
import {
  createIntakePayload,
  makeSampleReferenceCode,
  normalizeApprovedProduct,
  productsMatchApproved,
  transitionSampleOrder,
  type CustodySampleAggregate,
} from "../server/custody-samples.js";

const product: CustodyProduct = {
  code: "SK-101",
  name: "جورب رياضي",
  size: "42",
  color: "أسود",
  antiSlip: true,
  yarnWeightGrams: 1250,
  pairWeightGrams: 62,
  yarns: [
    { name: "قطن", percentage: 80 },
    { name: "نايلون", percentage: 20 },
  ],
};

function intakeOrder(): CustodySampleAggregate {
  return {
    id: 7,
    referenceCode: makeSampleReferenceCode("intake-key"),
    requesterId: 11,
    payload: createIntakePayload({
      clientName: "عميل الاختبار",
      requirements: "عينة للتجربة",
      requestedPairs: 5,
      operationKey: "intake-key",
      actor: { id: 11, name: "خدمة العملاء" },
      at: "2026-10-15T12:00:00.000Z",
    }),
    status: "intake",
    batchId: null,
    version: 1,
  };
}

describe("custody samples V2 behavior", () => {
  it("requires a positive integer pair count at intake and produces a stable idempotency reference", () => {
    expect(() => createIntakePayload({
      clientName: "عميل", requirements: "احتياج", requestedPairs: 0,
      operationKey: "invalid", actor: { id: 1 },
    })).toThrow(/موجب/);
    expect(() => createIntakePayload({
      clientName: "عميل", requirements: "احتياج", requestedPairs: 1.5,
      operationKey: "invalid-decimal", actor: { id: 1 },
    })).toThrow(/صحيح/);
    expect(makeSampleReferenceCode("same-operation")).toBe(makeSampleReferenceCode("same-operation"));
    expect(makeSampleReferenceCode("same-operation")).not.toBe(makeSampleReferenceCode("other-operation"));
  });

  it("accepts only complete production specs including 100% yarn composition", () => {
    expect(normalizeApprovedProduct(product)).toEqual(product);
    expect(() => normalizeApprovedProduct({ ...product, yarns: [{ name: "قطن", percentage: 99 }] })).toThrow(/100/);
    expect(() => normalizeApprovedProduct({ ...product, pairWeightGrams: 0 })).toThrow(/وزن الزوج/);
  });

  it("moves only intake → specs_ready → ordered and appends immutable before/after evidence", () => {
    const intake = intakeOrder();
    const specs = transitionSampleOrder(intake, {
      kind: "set_specs", operationKey: "spec-key", product, reason: "اعتماد مدير الإنتاج",
      actor: { id: 2, name: "الإنتاج" }, at: "2026-10-15T12:01:00.000Z",
    });
    expect(specs.status).toBe("specs_ready");
    expect(specs.payload.events).toHaveLength(2);
    expect(specs.payload.events[0]).toEqual(intake.payload.events[0]);
    expect(specs.payload.events[1]).toMatchObject({
      action: "specs_approved",
      before: { status: "intake" },
      after: { status: "specs_ready", product },
    });

    const ordered = transitionSampleOrder({ ...intake, ...specs, version: 2 }, {
      kind: "order", operationKey: "order-key", actor: { id: 3, name: "خدمة العملاء" }, at: "2026-10-15T12:02:00.000Z",
    });
    expect(ordered.status).toBe("ordered");
    expect(ordered.payload.product).toEqual(product);
    expect(ordered.payload.events).toHaveLength(3);
    expect(ordered.payload.events.slice(0, 2)).toEqual(specs.payload.events);
  });

  it("does not allow specifications to be re-entered after approval or ordering", () => {
    const intake = intakeOrder();
    const specs = transitionSampleOrder(intake, {
      kind: "set_specs", operationKey: "spec-key", product, actor: { id: 2 },
    });
    const approvedOrder = { ...intake, ...specs, version: 2 } as CustodySampleAggregate;
    expect(() => transitionSampleOrder(approvedOrder, {
      kind: "set_specs", operationKey: "spec-reenter", product, actor: { id: 2 },
    })).toThrow(/الحالة الحالية/);
  });

  it("requires the engine stages in order and binds one order to one batch", () => {
    const intake = intakeOrder();
    const specs = transitionSampleOrder(intake, { kind: "set_specs", operationKey: "spec", product, actor: { id: 2 } });
    const ordered = transitionSampleOrder({ ...intake, ...specs, version: 2 }, { kind: "order", operationKey: "order", actor: { id: 3 } });
    const order = { ...intake, ...ordered, version: 3 } as CustodySampleAggregate;

    expect(() => transitionSampleOrder(order, { kind: "mark_batch", operationKey: "ready-too-early", batchId: "batch-1", status: "ready_for_customer" })).toThrow(/الحالة الحالية/);
    const inProduction = transitionSampleOrder(order, { kind: "mark_batch", operationKey: "production", batchId: "batch-1", status: "in_production" });
    expect(inProduction).toMatchObject({ status: "in_production", batchId: "batch-1" });
    const active = { ...order, ...inProduction, version: 4 } as CustodySampleAggregate;
    expect(() => transitionSampleOrder(active, { kind: "mark_batch", operationKey: "other-batch", batchId: "batch-2", status: "ready_for_customer" })).toThrow(/أكثر من دفعة/);
  });

  it("compares all approved product fields, including anti-slip, weights and yarn mix", () => {
    expect(productsMatchApproved(product, { ...product, yarns: [...product.yarns].reverse() })).toBe(true);
    expect(productsMatchApproved(product, { ...product, antiSlip: false })).toBe(false);
    expect(productsMatchApproved(product, { ...product, yarnWeightGrams: 1251 })).toBe(false);
    expect(productsMatchApproved(product, { ...product, yarns: [{ name: "قطن", percentage: 70 }, { name: "نايلون", percentage: 30 }] })).toBe(false);
  });

  it("keeps the approved requested-pairs quantity available for the custody engine", () => {
    const intake = intakeOrder();
    expect(intake.payload.requestedPairs).toBe(5);
    expect(Number.isSafeInteger(intake.payload.requestedPairs)).toBe(true);
    expect(intake.payload.requestedPairs).toBeGreaterThan(0);
  });
});
