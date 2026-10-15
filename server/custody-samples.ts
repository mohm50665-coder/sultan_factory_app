import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { custodySampleOrders, type CustodySampleOrderRow } from "../drizzle/custody-samples-schema.js";
import type { CustodyProduct } from "../shared/custody-contract.js";
import { validateProductSnapshot } from "../shared/custody-policy.js";
import { getDb } from "./db.js";
import { protectedProcedure, router } from "./_core/trpc.js";

/** The V2 sample flow is intentionally independent from legacy sampleRequests. */
export const CUSTODY_SAMPLE_STATUSES = [
  "intake",
  "specs_ready",
  "ordered",
  "in_production",
  "ready_for_customer",
  "delivered",
] as const;

export type CustodySampleStatus = (typeof CUSTODY_SAMPLE_STATUSES)[number];
type SampleAction = "intake_created" | "specs_approved" | "ordered" | "batch_marked";

export type SampleActor = { id: number; name?: string };
export type CustodySampleEvent = {
  action: SampleAction;
  operationKey: string;
  at: string;
  actor: SampleActor;
  reason?: string;
  before: { status: CustodySampleStatus; product?: CustodyProduct };
  after: { status: CustodySampleStatus; product?: CustodyProduct; batchId?: string };
};

export type CustodySamplePayload = {
  clientName: string;
  requirements: string;
  requestedPairs: number;
  /** This is the approved, immutable product snapshot—not a catalogue product. */
  product?: CustodyProduct;
  events: CustodySampleEvent[];
};

export type CustodySampleAggregate = {
  id: number;
  referenceCode: string;
  requesterId: number;
  payload: CustodySamplePayload;
  status: CustodySampleStatus;
  batchId: string | null;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
};

const productInput = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  size: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(100),
  antiSlip: z.boolean(),
  yarns: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    percentage: z.number().finite().positive(),
  })).min(1),
  yarnWeightGrams: z.number().finite().nonnegative(),
  pairWeightGrams: z.number().finite().positive(),
}).strict();

const operationKeyInput = z.string().trim().min(1).max(128);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asStatus(value: unknown): CustodySampleStatus {
  if ((CUSTODY_SAMPLE_STATUSES as readonly string[]).includes(String(value))) return value as CustodySampleStatus;
  throw new Error("حالة طلب العينة V2 غير صالحة");
}

function asPayload(value: unknown): CustodySamplePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("بيانات طلب العينة V2 غير صالحة");
  }
  const payload = value as Partial<CustodySamplePayload>;
  if (!String(payload.clientName || "").trim() || !String(payload.requirements || "").trim()) {
    throw new Error("بيانات العميل أو الاحتياج في طلب العينة غير مكتملة");
  }
  if (!Number.isSafeInteger(payload.requestedPairs) || Number(payload.requestedPairs) <= 0) {
    throw new Error("كمية العينة يجب أن تكون عددًا صحيحًا موجبًا من الأزواج");
  }
  if (!Array.isArray(payload.events)) throw new Error("سجل أحداث طلب العينة غير صالح");
  return {
    clientName: String(payload.clientName).trim(),
    requirements: String(payload.requirements).trim(),
    requestedPairs: Number(payload.requestedPairs),
    product: payload.product ? clone(payload.product) : undefined,
    events: clone(payload.events),
  };
}

function canonicalProduct(product: CustodyProduct): CustodyProduct {
  return {
    code: product.code.trim(),
    name: product.name.trim(),
    size: product.size.trim(),
    color: product.color.trim(),
    antiSlip: product.antiSlip,
    yarnWeightGrams: Number(product.yarnWeightGrams),
    pairWeightGrams: Number(product.pairWeightGrams),
    // Yarn ordering is not a product difference; name/percentage values are.
    yarns: product.yarns
      .map((yarn) => ({ name: yarn.name.trim(), percentage: Number(yarn.percentage) }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.percentage - right.percentage),
  };
}

/** Checks all product fields, weights, yarn mix, and anti-slip as one approved snapshot. */
export function normalizeApprovedProduct(input: CustodyProduct): CustodyProduct {
  const product = canonicalProduct(clone(input));
  validateProductSnapshot(product);
  return product;
}

export function productsMatchApproved(approved: CustodyProduct, supplied: CustodyProduct): boolean {
  try {
    return JSON.stringify(normalizeApprovedProduct(approved)) === JSON.stringify(normalizeApprovedProduct(supplied));
  } catch {
    return false;
  }
}

function snapshot(status: CustodySampleStatus, product?: CustodyProduct, batchId?: string | null) {
  return {
    status,
    ...(product ? { product: clone(product) } : {}),
    ...(batchId ? { batchId } : {}),
  };
}

function appendEvent(
  payload: CustodySamplePayload,
  event: Omit<CustodySampleEvent, "before" | "after">,
  before: { status: CustodySampleStatus; product?: CustodyProduct; batchId?: string | null },
  after: { status: CustodySampleStatus; product?: CustodyProduct; batchId?: string | null },
): CustodySamplePayload {
  const next = clone(payload);
  next.events = [
    ...next.events,
    {
      ...event,
      actor: { id: event.actor.id, ...(event.actor.name ? { name: event.actor.name } : {}) },
      before: snapshot(before.status, before.product, before.batchId),
      after: snapshot(after.status, after.product, after.batchId),
    },
  ];
  return next;
}

function assertSafePositivePairs(requestedPairs: number) {
  if (!Number.isSafeInteger(requestedPairs) || requestedPairs <= 0) {
    throw new Error("كمية العينة يجب أن تكون عددًا صحيحًا موجبًا من الأزواج");
  }
}

export function makeSampleReferenceCode(operationKey: string): string {
  const digest = createHash("sha256").update(operationKey).digest("hex").slice(0, 32).toUpperCase();
  return `CS2-${digest}`;
}

export function createIntakePayload(input: {
  clientName: string;
  requirements: string;
  requestedPairs: number;
  operationKey: string;
  actor: SampleActor;
  at?: string;
}): CustodySamplePayload {
  const clientName = input.clientName.trim();
  const requirements = input.requirements.trim();
  assertSafePositivePairs(input.requestedPairs);
  if (!clientName || !requirements) throw new Error("اسم العميل والاحتياج مطلوبان");
  const at = input.at || new Date().toISOString();
  const base: CustodySamplePayload = {
    clientName,
    requirements,
    requestedPairs: input.requestedPairs,
    events: [],
  };
  return appendEvent(base, {
    action: "intake_created",
    operationKey: input.operationKey,
    at,
    actor: input.actor,
  }, { status: "intake" }, { status: "intake" });
}

function requireStatus(current: CustodySampleStatus, expected: CustodySampleStatus, actionLabel: string) {
  if (current !== expected) {
    throw new Error(`لا يمكن ${actionLabel} في الحالة الحالية (${current})`);
  }
}

/**
 * Single pure transition function used by the router and the custody engine.
 * It preserves all old events and writes explicit before/after product snapshots.
 */
export function transitionSampleOrder(
  order: CustodySampleAggregate,
  command:
    | { kind: "set_specs"; operationKey: string; product: CustodyProduct; reason?: string; actor: SampleActor; at?: string }
    | { kind: "order"; operationKey: string; actor: SampleActor; at?: string }
    | { kind: "mark_batch"; operationKey: string; batchId: string; status: "in_production" | "ready_for_customer" | "delivered"; actor?: SampleActor; at?: string },
): Pick<CustodySampleAggregate, "payload" | "status" | "batchId"> {
  const currentStatus = asStatus(order.status);
  const currentPayload = asPayload(order.payload);
  const currentProduct = currentPayload.product ? normalizeApprovedProduct(currentPayload.product) : undefined;
  const at = command.at || new Date().toISOString();

  if (command.kind === "set_specs") {
    requireStatus(currentStatus, "intake", "اعتماد مواصفات العينة");
    const product = normalizeApprovedProduct(command.product);
    return {
      status: "specs_ready",
      batchId: order.batchId,
      payload: appendEvent({ ...currentPayload, product }, {
        action: "specs_approved",
        operationKey: command.operationKey,
        at,
        actor: command.actor,
        ...(command.reason?.trim() ? { reason: command.reason.trim() } : {}),
      }, { status: currentStatus, product: currentProduct, batchId: order.batchId }, { status: "specs_ready", product, batchId: order.batchId }),
    };
  }

  if (command.kind === "order") {
    requireStatus(currentStatus, "specs_ready", "إصدار أمر تصنيع العينة");
    if (!currentProduct) throw new Error("لا يمكن إصدار أمر عينة بدون مواصفات منتج معتمدة");
    return {
      status: "ordered",
      batchId: order.batchId,
      payload: appendEvent(currentPayload, {
        action: "ordered",
        operationKey: command.operationKey,
        at,
        actor: command.actor,
      }, { status: currentStatus, product: currentProduct, batchId: order.batchId }, { status: "ordered", product: currentProduct, batchId: order.batchId }),
    };
  }

  const expected: Record<typeof command.status, CustodySampleStatus> = {
    in_production: "ordered",
    ready_for_customer: "in_production",
    delivered: "ready_for_customer",
  };
  requireStatus(currentStatus, expected[command.status], "تحديث مرحلة دفعة العينة");
  if (!currentProduct) throw new Error("طلب العينة لا يحتوي على مواصفات معتمدة");
  const batchId = command.batchId.trim();
  if (!batchId) throw new Error("معرف دفعة العينة مطلوب");
  if (order.batchId && order.batchId !== batchId) throw new Error("لا يمكن ربط طلب العينة بأكثر من دفعة تصنيع");
  const actor = command.actor || { id: 0, name: "محرك العهد" };
  return {
    status: command.status,
    batchId,
    payload: appendEvent(currentPayload, {
      action: "batch_marked",
      operationKey: command.operationKey,
      at,
      actor,
    }, { status: currentStatus, product: currentProduct, batchId: order.batchId }, { status: command.status, product: currentProduct, batchId }),
  };
}

function rowToAggregate(row: CustodySampleOrderRow): CustodySampleAggregate {
  return {
    id: Number(row.id),
    referenceCode: String(row.referenceCode),
    requesterId: Number(row.requesterId),
    payload: asPayload(row.payload),
    status: asStatus(row.status),
    batchId: row.batchId ?? null,
    version: Number(row.version),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function containsOperation(payload: CustodySamplePayload, operationKey: string): boolean {
  return payload.events.some((event) => event.operationKey === operationKey);
}

async function findOperation(tx: any, operationKey: string) {
  const rows = await tx.select().from(custodySampleOrders);
  for (const row of rows as CustodySampleOrderRow[]) {
    const order = rowToAggregate(row);
    if (containsOperation(order.payload, operationKey)) return order;
  }
  return null;
}

function replayOrConflict(replay: CustodySampleAggregate | null, operationKey: string, orderId?: number) {
  if (!replay) return null;
  if (orderId === undefined || replay.id === orderId) return replay;
  throw new TRPCError({ code: "CONFLICT", message: `مفتاح العملية مستخدم بالفعل (${operationKey})` });
}

async function loadOrder(tx: any, id: number): Promise<CustodySampleAggregate> {
  const rows = await tx.select().from(custodySampleOrders).where(eq(custodySampleOrders.id, id)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "طلب العينة V2 غير موجود" });
  return rowToAggregate(rows[0] as CustodySampleOrderRow);
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows || 0);
  return Number((result as { affectedRows?: number } | undefined)?.affectedRows || 0);
}

async function persistTransition(tx: any, order: CustodySampleAggregate, next: Pick<CustodySampleAggregate, "payload" | "status" | "batchId">) {
  const result = await tx.update(custodySampleOrders).set({
    payload: next.payload,
    status: next.status,
    batchId: next.batchId,
    version: order.version + 1,
  }).where(and(
    eq(custodySampleOrders.id, order.id),
    eq(custodySampleOrders.version, order.version),
    eq(custodySampleOrders.status, order.status),
  ));
  if (affectedRows(result) !== 1) {
    throw new TRPCError({ code: "CONFLICT", message: "تم تغيير طلب العينة بواسطة عملية أخرى؛ أعد المحاولة" });
  }
  return { ...order, ...next, version: order.version + 1 };
}

function normalizeSampleDepartment(value: unknown): "production" | "sales" | "customer_service" | null {
  const department = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ar").replace(/\s+/g, " ");
  const aliases: Record<string, "production" | "sales" | "customer_service"> = {
    production: "production", "الإنتاج": "production", "قسم الإنتاج": "production",
    sales: "sales", "المبيعات": "sales", "التسويق والمبيعات": "sales", "التسويق": "sales",
    customer_service: "customer_service", "customer service": "customer_service", "خدمة العملاء": "customer_service",
  };
  return aliases[department] || null;
}

function assertModuleAccess(user: any) {
  if (user?.role === "admin") return "admin" as const;
  if (Number(user?.isActive) === 0) throw new TRPCError({ code: "FORBIDDEN", message: "الحساب غير مفعّل" });
  const department = normalizeSampleDepartment(user?.department);
  if (!department) throw new TRPCError({ code: "FORBIDDEN", message: "وحدة العينات متاحة للإنتاج أو المبيعات أو خدمة العملاء فقط" });
  return department;
}

function assertDepartment(user: any, allowed: Array<"production" | "sales" | "customer_service">) {
  const department = assertModuleAccess(user);
  if (department !== "admin" && !allowed.includes(department)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية هذه المرحلة من دورة العينة" });
  }
}

function actorFromUser(user: any): SampleActor {
  return { id: Number(user.id), name: String(user.name || user.username || "مستخدم") };
}

function publicOrder(order: CustodySampleAggregate) {
  return {
    id: order.id,
    referenceCode: order.referenceCode,
    requesterId: order.requesterId,
    clientName: order.payload.clientName,
    requirements: order.payload.requirements,
    requestedPairs: order.payload.requestedPairs,
    product: order.payload.product ? clone(order.payload.product) : null,
    events: clone(order.payload.events),
    // Keep the aggregate projection available to the custody-batch-entry
    // prefill without requiring it to reconstruct fields from legacy rows.
    payload: clone(order.payload),
    status: order.status,
    batchId: order.batchId,
    version: order.version,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Used by the main custody engine before it creates a sample batch. It requires
 * the order to be ordered and prevents product mutation/re-entry.
 */
export async function assertSampleOrder(tx: any, id: number, product: CustodyProduct, totalPairs?: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("معرف طلب العينة غير صالح");
  const order = await loadOrder(tx, id);
  if (order.status !== "ordered") throw new Error("لا يمكن إنشاء دفعة عينة قبل إصدار أمر تصنيع العينة");
  if (!order.payload.product || !productsMatchApproved(order.payload.product, product)) {
    throw new Error("بيانات المنتج لا تطابق مواصفات العينة المعتمدة");
  }
  // The current engine invokes this helper with three arguments. When it has
  // the batch quantity, it must pass it here so a sample cannot be produced
  // with a quantity different from the customer's approved request.
  if (totalPairs !== undefined) {
    if (!Number.isSafeInteger(totalPairs) || totalPairs <= 0) {
      throw new Error("إجمالي أزواج دفعة العينة يجب أن يكون عددًا صحيحًا موجبًا");
    }
    if (totalPairs !== order.payload.requestedPairs) {
      throw new Error(`كمية دفعة العينة (${totalPairs} زوجًا) لا تطابق الكمية المعتمدة (${order.payload.requestedPairs} زوجًا)`);
    }
  }
  return {
    id: order.id,
    referenceCode: order.referenceCode,
    requestedPairs: order.payload.requestedPairs,
    product: clone(order.payload.product),
  };
}

/**
 * Called by the custody engine in the same transaction as the batch update.
 * Each successful stage change appends one immutable before/after audit event.
 */
export async function markSampleBatch(
  tx: any,
  id: number,
  batchId: string,
  status: "in_production" | "ready_for_customer" | "delivered",
  actor?: SampleActor,
) {
  const order = await loadOrder(tx, id);
  if (order.status === status && order.batchId === batchId) return publicOrder(order);
  const next = transitionSampleOrder(order, {
    kind: "mark_batch",
    operationKey: `custody-engine:${batchId}:${status}`,
    batchId,
    status,
    actor,
  });
  return publicOrder(await persistTransition(tx, order, next));
}

export const custodySamplesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    assertModuleAccess(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    const rows = await db.select().from(custodySampleOrders).orderBy(desc(custodySampleOrders.createdAt));
    return rows.map((row) => publicOrder(rowToAggregate(row)));
  }),

  create: protectedProcedure.input(z.object({
    operationKey: operationKeyInput,
    clientName: z.string().trim().min(1).max(255),
    requirements: z.string().trim().min(1).max(8000),
    requestedPairs: z.number().int().positive(),
  }).strict()).mutation(async ({ input, ctx }) => {
    assertDepartment(ctx.user, ["customer_service", "sales"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    const referenceCode = makeSampleReferenceCode(input.operationKey);
    const actor = actorFromUser(ctx.user);
    return db.transaction(async (tx: any) => {
      const replay = replayOrConflict(await findOperation(tx, input.operationKey), input.operationKey);
      if (replay) return publicOrder(replay);
      const byReference = await tx.select().from(custodySampleOrders).where(eq(custodySampleOrders.referenceCode, referenceCode)).limit(1);
      if (byReference[0]) {
        const existing = rowToAggregate(byReference[0]);
        if (existing.requesterId === Number(ctx.user.id) && containsOperation(existing.payload, input.operationKey)) return publicOrder(existing);
        throw new TRPCError({ code: "CONFLICT", message: "مفتاح إنشاء طلب العينة مستخدم بالفعل" });
      }
      const payload = createIntakePayload({ ...input, actor });
      const insert = await tx.insert(custodySampleOrders).values({
        referenceCode,
        requesterId: Number(ctx.user.id),
        payload,
        status: "intake",
        batchId: null,
        version: 1,
      });
      const id = Number(insert[0]?.insertId);
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء طلب العينة" });
      return publicOrder({ id, referenceCode, requesterId: Number(ctx.user.id), payload, status: "intake", batchId: null, version: 1 });
    });
  }),

  setSpecs: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    operationKey: operationKeyInput,
    product: productInput,
    reason: z.string().trim().max(2000).optional(),
  }).strict()).mutation(async ({ input, ctx }) => {
    assertDepartment(ctx.user, ["production"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    return db.transaction(async (tx: any) => {
      const replay = replayOrConflict(await findOperation(tx, input.operationKey), input.operationKey, input.id);
      if (replay) return publicOrder(replay);
      const order = await loadOrder(tx, input.id);
      const next = transitionSampleOrder(order, {
        kind: "set_specs",
        operationKey: input.operationKey,
        product: input.product,
        reason: input.reason,
        actor: actorFromUser(ctx.user),
      });
      return publicOrder(await persistTransition(tx, order, next));
    });
  }),

  order: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    operationKey: operationKeyInput,
  }).strict()).mutation(async ({ input, ctx }) => {
    assertDepartment(ctx.user, ["customer_service", "sales"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    return db.transaction(async (tx: any) => {
      const replay = replayOrConflict(await findOperation(tx, input.operationKey), input.operationKey, input.id);
      if (replay) return publicOrder(replay);
      const order = await loadOrder(tx, input.id);
      const next = transitionSampleOrder(order, {
        kind: "order",
        operationKey: input.operationKey,
        actor: actorFromUser(ctx.user),
      });
      return publicOrder(await persistTransition(tx, order, next));
    });
  }),
});
