import { businessMilliseconds } from "../shared/custody-reporting";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, like } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { manufacturingStages, production, users } from "../drizzle/schema.js";
import * as sampleIntegration from "./custody-samples";
import * as inventoryIntegration from "./pair-inventory";
import {
  custodyBatches,
  custodyEvents,
  custodyInventory,
  custodyOperations,
  custodySettings as custodySettingsTable,
  custodyWorkerLocks,
} from "../drizzle/custody-schema.js";
import type {
  CustodyAccount,
  CustodyActionInput,
  CustodyAllocation,
  CustodyBatch,
  CustodyBatchInput,
  CustodyDisposal,
  CustodyEvent,
  CustodyLot,
  CustodyProduct,
  CustodySettings,
  CustodyStage,
  CustodyTransfer,
} from "../shared/custody-contract.js";
import {
  CUSTODY_STAGES,
  accountBelongsToStage,
  allowedDestinationStages,
  assertRoute,
  batchProductIdentity,
  computeTimingMetrics,
  exactQuantityError,
  isNonNegativeInteger,
  isPositiveInteger,
  normalizeDepartment,
  validateProductSnapshot,
} from "../shared/custody-policy.js";
import { normalizeProductionWindow } from "../shared/production-window.js";

export type CustodyActor = {
  id: number;
  name?: string | null;
  username?: string | null;
  department?: string | null;
  role: "user" | "admin" | "manager" | "supervisor" | string;
};

type Db = any;
type PendingEvent = CustodyEvent & {
  transferId?: string;
  sessionId?: string;
  progressId?: string;
  disposalId?: string;
};

type MutationState = {
  batch: CustodyBatch;
  pendingEvents: PendingEvent[];
};

type OperationResult = { success: true; batchId: string; trackingNumber?: string };

const DEFAULT_SETTINGS: CustodySettings = {
  enabled: false,
  scheduleCronTaskUid: null,
  stageLimits: {},
  shifts: [],
  holidays: [],
};

function fail(code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "PRECONDITION_FAILED", message: string): never {
  throw new TRPCError({ code, message });
}

function actorName(actor: CustodyActor): string {
  return String(actor.name || actor.username || `مستخدم #${actor.id}`).trim();
}

function isoNow(): string {
  return new Date().toISOString();
}

function asDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("وقت خادم غير صالح");
  return date;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function isAdmin(actor: CustodyActor): boolean {
  return actor.role === "admin";
}

function isSupervisor(actor: CustodyActor): boolean {
  return actor.role === "admin" || actor.role === "supervisor";
}

function isManagerOrAdmin(actor: CustodyActor): boolean {
  return actor.role === "admin" || actor.role === "manager" || actor.role === "supervisor";
}

function assertProductionCreator(actor: CustodyActor): void {
  if (isAdmin(actor)) return;
  if ((actor.role === "manager" || actor.role === "supervisor") && accountBelongsToStage(actor.department, "production")) return;
  fail("FORBIDDEN", "إنشاء دفعة الإنتاج محصور على أدمن أو مدير/مشرف قسم الإنتاج");
}

function assertStage(value: unknown): asserts value is CustodyStage {
  if (!CUSTODY_STAGES.includes(value as CustodyStage)) fail("BAD_REQUEST", "مرحلة العهدة غير صحيحة");
}

function assertActiveInteger(value: unknown, field: string, allowZero = false): asserts value is number {
  if (!(allowZero ? isNonNegativeInteger(value) : isPositiveInteger(value))) {
    fail("BAD_REQUEST", `${field} يجب أن يكون عدد أزواج صحيحًا${allowZero ? " غير سالب" : " موجبًا"}`);
  }
}

function assertOperationKey(operationKey: unknown): asserts operationKey is string {
  if (typeof operationKey !== "string" || operationKey.trim().length < 8 || operationKey.length > 128) {
    fail("BAD_REQUEST", "مفتاح العملية مطلوب ويجب أن يكون بطول صحيح");
  }
}

function decodeBatch(payload: unknown): CustodyBatch {
  let decoded: unknown = payload;
  if (typeof decoded === "string") {
    try { decoded = JSON.parse(decoded); } catch { fail("CONFLICT", "بيانات دفعة العهدة تالفة"); }
  }
  if (!decoded || typeof decoded !== "object") fail("CONFLICT", "بيانات دفعة العهدة تالفة");
  const batch = decoded as CustodyBatch;
  if (!batch.id || !Array.isArray(batch.custodies) || !Array.isArray(batch.transfers) || !Array.isArray(batch.events)) {
    fail("CONFLICT", "بنية دفعة العهدة غير صالحة");
  }
  batch.sessions ??= [];
  batch.progress ??= [];
  batch.disposals ??= [];
  return batch;
}

async function loadBatch(db: Db, batchId: string): Promise<CustodyBatch> {
  const rows = await db.select().from(custodyBatches).where(eq(custodyBatches.id, batchId)).limit(1);
  if (!rows[0]) fail("NOT_FOUND", "دفعة العهدة غير موجودة");
  const batch = decodeBatch(rows[0].payload);
  // Separate optimistic version wins over a stale JSON projection after an interrupted historical deploy.
  batch.version = Number(rows[0].version);
  return batch;
}

async function findOperation(db: Db, actorId: number, operationKey: string): Promise<any | undefined> {
  const rows = await db.select().from(custodyOperations)
    .where(and(eq(custodyOperations.actorId, actorId), eq(custodyOperations.operationKey, operationKey))).limit(1);
  return rows[0];
}

async function replayOrReject(db: Db, actor: CustodyActor, operationKey: string, hash: string): Promise<OperationResult | undefined> {
  const existing = await findOperation(db, actor.id, operationKey);
  if (!existing) return undefined;
  if (existing.requestHash !== hash) fail("CONFLICT", "مفتاح العملية استُخدم سابقًا بطلب مختلف");
  return { ...(existing.result as OperationResult), replayed: true, message: "تم تنفيذ هذا الإجراء مسبقًا؛ لم يتم إنشاء حركة مكررة." } as OperationResult;
}

async function saveOperation(tx: Db, actor: CustodyActor, operationKey: string, hash: string, batchId: string, result: OperationResult): Promise<void> {
  await tx.insert(custodyOperations).values({
    id: randomUUID(), operationKey, actorId: actor.id, requestHash: hash, batchId, result: result as any,
  });
}

async function executeIdempotent<T extends OperationResult>(
  db: Db,
  actor: CustodyActor,
  operationKey: string,
  request: unknown,
  execute: (tx: Db) => Promise<T>,
): Promise<T> {
  assertOperationKey(operationKey);
  const hash = requestHash(request);
  const earlyReplay = await replayOrReject(db, actor, operationKey, hash);
  if (earlyReplay) return earlyReplay as T;
  try {
    return await db.transaction(async (tx: Db) => {
      const replay = await replayOrReject(tx, actor, operationKey, hash);
      if (replay) return replay as T;
      const result = await execute(tx);
      await saveOperation(tx, actor, operationKey, hash, result.batchId, result);
      return result;
    });
  } catch (error: any) {
    // A concurrent same-key request can win after the initial read. The unique operation row
    // turns it into a deterministic replay rather than a second movement.
    const replay = await replayOrReject(db, actor, operationKey, hash);
    if (replay) return replay as T;
    throw error;
  }
}

function event(state: MutationState, actor: CustodyActor, values: Omit<PendingEvent, "id" | "batchId" | "actorId" | "actorName" | "at">): PendingEvent {
  const item: PendingEvent = {
    id: randomUUID(),
    batchId: state.batch.id,
    actorId: actor.id,
    actorName: actorName(actor),
    at: isoNow(),
    ...values,
  };
  state.batch.events.push(item);
  state.pendingEvents.push(item);
  return item;
}

async function insertNormalizedEvents(tx: Db, events: PendingEvent[]): Promise<void> {
  if (!events.length) return;
  await tx.insert(custodyEvents).values(events.map((item, index) => ({
    id: item.id,
    batchId: item.batchId,
    custodyId: item.custodyId ?? null,
    transferId: item.transferId ?? null,
    sessionId: item.sessionId ?? null,
    progressId: item.progressId ?? null,
    disposalId: item.disposalId ?? null,
    sequence: item.batchId ? 0 : index, // replaced immediately below; keeps type inference narrow
    actorId: item.actorId,
    actorName: item.actorName,
    stage: item.stage ?? null,
    action: item.action,
    pairs: item.pairs ?? null,
    reason: item.reason ?? null,
    before: item.before as any,
    after: item.after as any,
    payload: { at: item.at } as any,
    createdAt: asDate(item.at),
  })));
}

/** mysql's ResultSetHeader shape differs across mysql2 versions. */
function affectedRows(result: unknown): number {
  const record = Array.isArray(result) ? result[0] : result;
  return Number((record as any)?.affectedRows ?? (record as any)?.rowsAffected ?? 0);
}

async function persistAggregate(tx: Db, state: MutationState, expectedVersion: number): Promise<void> {
  const nextVersion = expectedVersion + 1;
  state.batch.version = nextVersion;
  const baseSequence = state.batch.events.length - state.pendingEvents.length;
  // Sequence must be populated after append and before inserting normalized journal rows.
  const normalized = state.pendingEvents.map((item, index) => ({ ...item, __sequence: baseSequence + index + 1 }));
  const result = await tx.update(custodyBatches)
    .set({ version: nextVersion, payload: state.batch as any, updatedAt: new Date() })
    .where(and(eq(custodyBatches.id, state.batch.id), eq(custodyBatches.version, expectedVersion)));
  if (affectedRows(result) !== 1) fail("CONFLICT", "تغيرت العهدة في عملية متزامنة؛ أعد تحميلها ثم حاول مجددًا");
  if (normalized.length) {
    await tx.insert(custodyEvents).values(normalized.map((item) => ({
      id: item.id,
      batchId: item.batchId,
      custodyId: item.custodyId ?? null,
      transferId: item.transferId ?? null,
      sessionId: item.sessionId ?? null,
      progressId: item.progressId ?? null,
      disposalId: item.disposalId ?? null,
      sequence: item.__sequence,
      actorId: item.actorId,
      actorName: item.actorName,
      stage: item.stage ?? null,
      action: item.action,
      pairs: item.pairs ?? null,
      reason: item.reason ?? null,
      before: item.before as any,
      after: item.after as any,
      payload: { at: item.at } as any,
      createdAt: asDate(item.at),
    })));
  }
}

function lotById(batch: CustodyBatch, custodyId: string | undefined): CustodyLot {
  if (!custodyId) fail("BAD_REQUEST", "معرف العهدة مطلوب");
  const lot = batch.custodies.find((item) => item.id === custodyId);
  if (!lot) fail("NOT_FOUND", "العهدة غير موجودة في الدفعة");
  return lot;
}

function transferById(batch: CustodyBatch, transferId: string | undefined): CustodyTransfer {
  if (!transferId) fail("BAD_REQUEST", "معرف حركة النقل مطلوب");
  const transfer = batch.transfers.find((item) => item.id === transferId);
  if (!transfer) fail("NOT_FOUND", "حركة النقل غير موجودة في الدفعة");
  return transfer;
}

function assertLotOwner(actor: CustodyActor, lot: CustodyLot): void {
  if (Number(lot.ownerId) !== Number(actor.id)) fail("FORBIDDEN", "هذه العهدة ليست مسندة إلى حسابك");
  if (!isAdmin(actor) && !accountBelongsToStage(actor.department, lot.stage)) {
    fail("FORBIDDEN", "حسابك لا ينتمي إلى قسم العهدة");
  }
}

function assertReceivedOrCompletedStorage(lot: CustodyLot): void {
  if (!["received", "completed"].includes(lot.status)) fail("PRECONDITION_FAILED", "يجب تأكيد استلام عهدة المخازن أولًا");
}

function assertRequiredReason(reason: unknown, message = "السبب إلزامي"): asserts reason is string {
  if (typeof reason !== "string" || !reason.trim()) fail("BAD_REQUEST", message);
}

function activeSession(batch: CustodyBatch, custodyId: string, kind: "work" | "pause") {
  return batch.sessions.find((session) => session.custodyId === custodyId && session.kind === kind && !session.endedAt);
}

async function accountById(tx: Db, id: number): Promise<any> {
  const rows = await tx.select().from(users).where(and(eq(users.id, id), eq(users.isActive, 1))).limit(1);
  if (!rows[0]) fail("BAD_REQUEST", "الحساب المحدد غير مفعّل");
  return rows[0];
}

async function assertDestination(tx: Db, sender: CustodyActor, allocation: CustodyAllocation): Promise<any> {
  assertStage(allocation.toStage);
  assertActiveInteger(allocation.toUserId, "معرف المستلم");
  assertActiveInteger(allocation.pairs, "كمية التخصيص");
  if (allocation.toUserId === sender.id) fail("BAD_REQUEST", "لا يجوز للموظف تسليم العهدة إلى نفسه");
  const receiver = await accountById(tx, allocation.toUserId);
  if (!accountBelongsToStage(receiver.department, allocation.toStage)) {
    fail("BAD_REQUEST", "المستلم المحدد لا ينتمي إلى القسم الوجهة الصحيح");
  }
  return receiver;
}

function assertCompletedFull(lot: CustodyLot): void {
  if (lot.status !== "completed" || lot.progressPairs !== lot.pairs || !lot.completedAt) {
    fail("PRECONDITION_FAILED", "لا يمكن التسليم قبل إكمال العمل على كامل العهدة");
  }
}

function assertAllocations(batch: CustodyBatch, lot: CustodyLot, allocations: CustodyAllocation[] | undefined, reason?: string): CustodyAllocation[] {
  if (!Array.isArray(allocations) || !allocations.length) fail("BAD_REQUEST", "أدخل وجهة وكمية التسليم كاملة");
  const requested = allocations.map((allocation) => ({ ...allocation }));
  for (const allocation of requested) {
    assertStage(allocation.toStage);
    assertActiveInteger(allocation.pairs, "كمية التخصيص");
    if (!["first", "second", "suspected", "damaged"].includes(allocation.quality)) fail("BAD_REQUEST", "تصنيف الجودة غير صحيح");
  }
  const total = requested.reduce((sum, allocation) => sum + allocation.pairs, 0);
  const exact = exactQuantityError(lot.pairs, total);
  if (!exact.ok) fail("BAD_REQUEST", exact.message);

  const standard = () => {
    if (requested.length !== 1 || requested[0].quality !== lot.quality) fail("BAD_REQUEST", "يجب تسليم كامل العهدة بتصنيفها الحالي إلى وجهة واحدة صحيحة");
    assertRoute(batch, lot.stage, requested[0].toStage, requested[0].quality);
  };

  if (batch.purpose === "sample") {
    standard();
    if (lot.stage === "antislip" && requested[0].quality === "suspected") assertRequiredReason(reason, "حالة العينة المشتبه بها تتطلب سببًا موثقًا");
    return requested;
  }

  if (lot.stage === "antislip") {
    for (const allocation of requested) {
      if (allocation.toStage === "kawiya") {
        if (allocation.quality !== lot.quality || !["first", "second"].includes(allocation.quality)) fail("BAD_REQUEST", "السليم من مانع الانزلاق يحافظ على تصنيفه ويرسل إلى الكاوية");
      } else if (allocation.toStage === "inspection") {
        if (allocation.quality !== "suspected") fail("BAD_REQUEST", "المشتبه بتلفه يجب تصنيفه مشتبهًا ويرسل للفحص");
      } else {
        fail("BAD_REQUEST", "وجهة مانع الانزلاق غير صحيحة");
      }
    }
    return requested;
  }

  if (lot.stage === "inspection") {
    for (const allocation of requested) {
      if (lot.quality === "suspected" && allocation.toStage === "packing" && allocation.quality !== "second") fail("BAD_REQUEST", "المشتبه الوارد من مانع الانزلاق لا يعتمد إلا نخبًا ثانيًا صالحًا أو تالفًا؛ إعادة المعالجة قرار إشرافي منفصل");
      if (allocation.toStage === "packing" && !["first", "second"].includes(allocation.quality)) fail("BAD_REQUEST", "الفحص يرسل النخب الأول أو الثاني فقط إلى التغليف");
      if (allocation.toStage === "followup" && allocation.quality !== "damaged") fail("BAD_REQUEST", "التالف المعتمد يرسل فقط إلى مدير المتابعة");
      if (!["packing", "followup"].includes(allocation.toStage)) fail("BAD_REQUEST", "وجهة الفحص غير صحيحة");
    }
    if (requested.some((allocation) => allocation.quality === "damaged")) assertRequiredReason(reason, "التالف المعتمد يتطلب سببًا موثقًا");
    return requested;
  }

  standard();
  return requested;
}

function refreshSourceLiability(batch: CustodyBatch, sourceCustodyId: string): void {
  const source = batch.custodies.find((lot) => lot.id === sourceCustodyId);
  if (!source) return;
  const transfers = batch.transfers.filter((transfer) => transfer.sourceCustodyId === sourceCustodyId);
  if (transfers.some((transfer) => transfer.status === "disputed" || transfer.status === "rejected")) source.status = "disputed";
  else if (transfers.length && transfers.every((transfer) => transfer.status === "confirmed")) source.status = "closed";
  else source.status = "sent";
}

function normalizeProductionDate(value: string): string {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("BAD_REQUEST", "تاريخ الإنتاج يجب أن يكون YYYY-MM-DD");
  const check = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) fail("BAD_REQUEST", "تاريخ الإنتاج غير صالح");
  return date;
}

function legacyYarnColumns(product: CustodyProduct): Record<string, number> {
  const keys: Record<string, keyof Record<string, number>> = {
    rubber: "yarnRubber", "مطاط": "yarnRubber",
    spandex: "yarnSpandex", "اسباندكس": "yarnSpandex", "إسباندكس": "yarnSpandex",
    nylon: "yarnNylon", "نايلون": "yarnNylon",
    cotton: "yarnCotton", "قطن": "yarnCotton",
    bamboo: "yarnBamboo", "بامبو": "yarnBamboo",
    span: "yarnSpan", "إسبان": "yarnSpan", "اسبان": "yarnSpan",
  };
  const result: Record<string, number> = { yarnRubber: 0, yarnSpandex: 0, yarnNylon: 0, yarnCotton: 0, yarnBamboo: 0, yarnSpan: 0 };
  // V2 yarnWeightGrams describes yarn issued to this immutable batch; legacy columns retain
  // the per-pair share for old reports. Do not round fractional grams away.
  const totalPairs = (product as CustodyProduct & { __totalPairs?: number }).__totalPairs;
  for (const yarn of product.yarns) {
    const column = keys[String(yarn.name).trim().toLocaleLowerCase("ar")];
    if (column) result[column] += (product.yarnWeightGrams / (totalPairs || 1)) * (Number(yarn.percentage) / 100);
  }
  return result;
}

async function writeLegacyProduction(tx: Db, input: CustodyBatchInput, actor: CustodyActor, trackingNumber: string): Promise<number> {
  const firstPairs = input.firstPairs;
  const secondPairs = input.secondPairs;
  const totalPairs = firstPairs + secondPairs;
  const yarns = legacyYarnColumns({ ...input.product, __totalPairs: totalPairs } as CustodyProduct & { __totalPairs: number });
  const normalizedWindow = normalizeProductionWindow(input);
  const shiftText = String(input.shift).trim().toLocaleLowerCase();
  const shiftNumber = Number(shiftText.match(/\d+/)?.[0]
    ?? (/(morning|صباح|الأولى|اولى)/.test(shiftText) ? 1 : /(evening|مساء|الثانية|ثاني)/.test(shiftText) ? 2 : /(night|ليل|الثالثة|ثالث)/.test(shiftText) ? 3 : 1));
  const inserted = await tx.insert(production).values({
    date: normalizedWindow?.productionDate ?? normalizeProductionDate(input.productionDate),
    machineNumber: input.machineNumber.trim(),
    productName: input.product.name.trim(),
    productSize: input.product.size.trim(),
    productColor: input.product.color.trim(),
    // Legacy production requires a non-null barcode although V2 correctly does not use a barcode
    // before storage. This is a stable legacy reporting reference, never physical stock barcode.
    barcode: `CUSTODY-${trackingNumber}`.slice(0, 64),
    qualityGrade: input.purpose === "sample" ? "sample" : "first",
    sampleRequestId: input.sampleRequestId ?? null,
    sampleReference: input.purpose === "sample" ? trackingNumber.slice(0, 30) : null,
    shiftNumber,
    shiftStart: normalizedWindow?.workStartTime ?? "",
    shiftEnd: normalizedWindow?.workEndTime ?? "",
    // Existing legacy reports interpret productionDozen/pairs as total production; second grade
    // remains a subset, not an additional amount, so first+second is never double-counted.
    productionDozen: Math.floor(totalPairs / 12),
    productionPairs: totalPairs % 12,
    secondGradeDozen: Math.floor(secondPairs / 12),
    secondGradePairs: secondPairs % 12,
    wasteThreadGrams: Number((input as CustodyBatchInput & { wasteThreadGrams?: number }).wasteThreadGrams ?? 0),
    wasteSocksGrams: Number((input as CustodyBatchInput & { wasteSocksGrams?: number }).wasteSocksGrams ?? 0),
    wasteNeedles: Number(input.wasteNeedles ?? 0),
    needlesUsed: Number(input.needlesUsed ?? 0),
    productionHours: normalizedWindow?.productionHours ?? 0,
    productionMinutes: normalizedWindow?.productionMinutes ?? 0,
    ...yarns,
    movementStatus: "none",
    userId: actor.id,
  });
  return Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
}

async function loadSampleIntegration(): Promise<any> {
  return sampleIntegration;
}

async function loadInventoryIntegration(): Promise<any> {
  return inventoryIntegration;
}

async function markSample(tx: Db, batch: CustodyBatch, status: string, actor?: CustodyActor): Promise<void> {
  if (batch.purpose !== "sample" || !batch.sampleRequestId) return;
  const samples = await loadSampleIntegration();
  await samples.markSampleBatch(tx, batch.sampleRequestId, batch.id, status, actor ? { id: actor.id, name: actorName(actor) } : undefined);
}

export async function createCustodyBatch(db: Db, actor: CustodyActor, input: CustodyBatchInput): Promise<{ success: true; batchId: string; trackingNumber: string }> {
  return executeIdempotent(db, actor, input.operationKey, input, async (tx) => {
    assertProductionCreator(actor);
    await accountById(tx, actor.id);
    validateProductSnapshot(input.product);
    assertOperationKey(input.operationKey);
    assertActiveInteger(input.firstPairs, "كمية النخب الأول", true);
    assertActiveInteger(input.secondPairs, "كمية النخب الثاني", true);
    const optionalWaste = input as CustodyBatchInput & { wasteThreadGrams?: number; wasteSocksGrams?: number };
    if ((optionalWaste.wasteThreadGrams !== undefined && (!Number.isFinite(optionalWaste.wasteThreadGrams) || optionalWaste.wasteThreadGrams < 0)) || (optionalWaste.wasteSocksGrams !== undefined && (!Number.isFinite(optionalWaste.wasteSocksGrams) || optionalWaste.wasteSocksGrams < 0))) {
      fail("BAD_REQUEST", "أوزان الهدر يجب أن تكون أرقام جرامات غير سالبة");
    }
    const totalPairs = input.firstPairs + input.secondPairs;
    if (!isPositiveInteger(totalPairs)) fail("BAD_REQUEST", "إجمالي الدفعة يجب أن يكون زوجًا صحيحًا موجبًا");
    if (!String(input.machineNumber || "").trim() || !String(input.shift || "").trim()) fail("BAD_REQUEST", "رقم الماكينة والوردية إلزاميان");
    const productionWindow = normalizeProductionWindow(input);
    normalizeProductionDate(input.productionDate);
    if (!["sale", "sample"].includes(input.purpose)) fail("BAD_REQUEST", "غرض الدفعة غير صحيح");
    const responsible = await accountById(tx, input.responsibleUserId);
    if (!accountBelongsToStage(responsible.department, "production")) fail("BAD_REQUEST", "المسؤول عن الإنتاج يجب أن ينتمي إلى قسم الإنتاج");

    if (input.purpose === "sample") {
      if (!isPositiveInteger(input.sampleRequestId)) fail("BAD_REQUEST", "رقم طلب العينة المعتمد إلزامي");
      const samples = await loadSampleIntegration();
      await samples.assertSampleOrder(tx, input.sampleRequestId, input.product, totalPairs);
    } else if (input.sampleRequestId !== undefined) {
      fail("BAD_REQUEST", "رقم طلب العينة يستخدم لدفعات العينات فقط");
    }

    const id = randomUUID();
    const trackingNumber = `CUSTODY-${id}`;
    const now = isoNow();
    const custodies: CustodyLot[] = [];
    const initialLots: Array<{ quality: "first" | "second"; pairs: number }> = [
      { quality: "first", pairs: input.firstPairs },
      { quality: "second", pairs: input.secondPairs },
    ].filter((item) => item.pairs > 0) as Array<{ quality: "first" | "second"; pairs: number }>;
    for (const item of initialLots) {
      custodies.push({
        id: randomUUID(), batchId: id, ownerId: responsible.id, ownerName: actorName(responsible), stage: "production",
        quality: item.quality, pairs: item.pairs, status: "received", receivedAt: now, progressPairs: 0,
      });
    }
    const batch: CustodyBatch = {
      id, trackingNumber, version: 1, product: clone(input.product), purpose: input.purpose,
      productionDate: productionWindow?.productionDate ?? input.productionDate,
      productionEndDate: productionWindow?.productionEndDate,
      workStartTime: productionWindow?.workStartTime,
      workEndTime: productionWindow?.workEndTime,
      productionDurationMinutes: productionWindow?.totalMinutes,
      machineNumber: input.machineNumber.trim(), shift: input.shift.trim(),
      manufacturingOrder: input.manufacturingOrder?.trim() || undefined,
      firstPairs: input.firstPairs, secondPairs: input.secondPairs, totalPairs,
      createdBy: actor.id, createdByName: actorName(actor), responsibleUserId: responsible.id, createdAt: now,
      sampleRequestId: input.sampleRequestId,
      sampleStatus: input.purpose === "sample" ? "in_production" : undefined,
      wasteThreadGrams: input.wasteThreadGrams,
      wasteSocksGrams: input.wasteSocksGrams,
      needlesUsed: input.needlesUsed,
      wasteNeedles: input.wasteNeedles,
      custodies, transfers: [], sessions: [], progress: [], disposals: [], events: [], corrections: [],
    };
    const state: MutationState = { batch, pendingEvents: [] };
    event(state, actor, { action: "batch_created", stage: "production", pairs: totalPairs, after: { product: batch.product, purpose: batch.purpose, productIdentity: batchProductIdentity(batch.product) } });
    for (const lot of custodies) {
      event(state, actor, { action: "initial_received", custodyId: lot.id, stage: lot.stage, pairs: lot.pairs, after: lot });
    }

    const productionId = await writeLegacyProduction(tx, input, actor, trackingNumber);
    batch.productionId = productionId;
    await tx.insert(custodyBatches).values({
      id, trackingNumber, productionId, version: 1, payload: batch as any, createdAt: asDate(now), updatedAt: asDate(now),
    });
    const normalized = state.pendingEvents.map((item, index) => ({ ...item, __sequence: index + 1 }));
    await tx.insert(custodyEvents).values(normalized.map((item) => ({
      id: item.id, batchId: item.batchId, custodyId: item.custodyId ?? null, transferId: item.transferId ?? null,
      sessionId: item.sessionId ?? null, progressId: item.progressId ?? null, disposalId: item.disposalId ?? null,
      sequence: item.__sequence, actorId: item.actorId, actorName: item.actorName, stage: item.stage ?? null,
      action: item.action, pairs: item.pairs ?? null, reason: item.reason ?? null, before: item.before as any, after: item.after as any,
      payload: { at: item.at } as any, createdAt: asDate(item.at),
    })));
    if (batch.purpose === "sample") await markSample(tx, batch, "in_production");
    return { success: true, batchId: id, trackingNumber };
  });
}

export type LegacyCustodyCandidate = { sourceId: number; productionId: number | null; stage: CustodyStage; workerName: string; quality: "first" | "second"; quantityPairs: number; productName: string; productSize: string; productColor: string; receivedAt: string | null };

function legacyStage(value: unknown): CustodyStage | null {
  const aliases: Record<CustodyStage, readonly string[]> = {
    production: ["production", "الإنتاج", "قسم الإنتاج"], rosso: ["rosso", "الروسو"], qalb: ["qalb", "القلب"], antislip: ["antislip", "مانع الانزلاق"], kawiya: ["kawiya", "الكاوية"], inspection: ["inspection", "الفحص"], packing: ["packing", "التغليف", "التعبئة والتغليف"], storage: ["storage", "warehouse", "المخازن", "المستودع", "المستودعات", "التخزين"], followup: ["followup", "مدير المتابعة", "المتابعة"], customer_service: ["customer_service", "customer service", "خدمة العملاء"],
  };
  return (Object.keys(aliases) as CustodyStage[]).find((stage) => aliases[stage].some((alias) => normalizeDepartment(alias) === normalizeDepartment(value))) ?? null;
}

function legacyPairs(row: any): number {
  const dozen = Number(row.quantityDozen ?? 0);
  const extra = Number(row.quantityPair ?? 0);
  if (!Number.isSafeInteger(dozen) || dozen < 0 || !Number.isSafeInteger(extra) || extra < 0) fail("BAD_REQUEST", "رصيد الإرث يحتوي كمية غير صحيحة ولا يمكن استيراده");
  const pairs = dozen * 12 + extra;
  if (!Number.isSafeInteger(pairs) || pairs <= 0) fail("BAD_REQUEST", "رصيد الإرث لا يحتوي أزواجًا مفتوحة صالحة للاستيراد");
  return pairs;
}

async function legacyRowHasDownstream(tx: Db, sourceId: number): Promise<boolean> {
  const child = await tx.select({ id: manufacturingStages.id }).from(manufacturingStages).where(and(isNull(manufacturingStages.deletedAt), like(manufacturingStages.productType, `AUTO_STAGE:${sourceId}:%`))).limit(1);
  return Boolean(child[0]);
}

async function assertLegacyCandidate(tx: Db, sourceId: number): Promise<{ row: any; stage: CustodyStage; pairs: number }> {
  const rows = await tx.select().from(manufacturingStages).where(eq(manufacturingStages.id, sourceId)).limit(1).for("update");
  const row = rows[0];
  if (!row) fail("NOT_FOUND", "سجل المرحلة التاريخي غير موجود");
  if (row.qualityGrade === "sample" || row.sampleRequestId) fail("PRECONDITION_FAILED", "العينات التاريخية تبقى في سجلها السابق؛ لا تستورد كعهدة بيع أو كعينة جديدة بلا أمر معتمد");
  if (row.deletedAt || row.stageCompletedAt || row.movementStatus !== "received") fail("PRECONDITION_FAILED", "لا يمكن استيراد سجل تاريخي ليس عهدة مستلمة مفتوحة");
  if (await legacyRowHasDownstream(tx, sourceId)) fail("PRECONDITION_FAILED", "لا يمكن استيراد سجل له حركة مرحلة لاحقة مرتبطة");
  const stage = legacyStage(row.stageName);
  if (!stage || ["storage", "followup", "customer_service"].includes(stage)) fail("PRECONDITION_FAILED", "مرحلة الرصيد التاريخي غير مؤهلة للاستيراد الافتتاحي");
  return { row, stage, pairs: legacyPairs(row) };
}

/** Read-only admin review. Missing V2 product data is intentionally never guessed from legacy fields. */
export async function listLegacyCustodyCandidates(db: Db, actor: CustodyActor): Promise<LegacyCustodyCandidate[]> {
  if (!isAdmin(actor)) fail("FORBIDDEN", "مراجعة أرصدة العهد التاريخية محصورة على الأدمن");
  const rows = await db.select().from(manufacturingStages).where(and(eq(manufacturingStages.movementStatus, "received"), isNull(manufacturingStages.deletedAt)));
  const migrated = await db.select({ legacySourceKey: custodyBatches.legacySourceKey }).from(custodyBatches);
  const imported = new Set((migrated as Array<{ legacySourceKey: string | null }>).map((item) => item.legacySourceKey).filter(Boolean));
  const related = await db.select({ productType: manufacturingStages.productType }).from(manufacturingStages).where(isNull(manufacturingStages.deletedAt));
  const hasDownstream=new Set<number>();for(const item of related){const match=String(item.productType||"").match(/^AUTO_STAGE:(\d+):/);if(match)hasDownstream.add(Number(match[1]));}
  const candidates: LegacyCustodyCandidate[] = [];
  for (const row of rows as any[]) {
    if (row.qualityGrade === "sample" || row.sampleRequestId) continue;
    if (row.stageCompletedAt || imported.has(`manufacturingStages:${row.id}`) || hasDownstream.has(Number(row.id))) continue;
    const stage = legacyStage(row.stageName);
    if (!stage || ["storage", "followup", "customer_service"].includes(stage)) continue;
    try { candidates.push({ sourceId: Number(row.id), productionId: row.productionId == null ? null : Number(row.productionId), stage, workerName: String(row.workerName || ""), quality: row.qualityGrade === "second" ? "second" : "first", quantityPairs: legacyPairs(row), productName: String(row.productName || ""), productSize: String(row.productSize || ""), productColor: String(row.productColor || ""), receivedAt: row.receivedAt ? new Date(row.receivedAt).toISOString() : null }); } catch { /* invalid totals remain legacy-only */ }
  }
  return candidates;
}

export type ImportLegacyCustodyInput = { operationKey: string; sourceId: number; product: CustodyProduct; responsibleUserId: number; reason: string };

/** Creates an explicitly labelled V2 opening balance, never updates old rows or legacy warehouse stock. */
export async function importLegacyCustody(db: Db, actor: CustodyActor, input: ImportLegacyCustodyInput): Promise<{ success: true; batchId: string; trackingNumber: string }> {
  return executeIdempotent(db, actor, input.operationKey, input, async (tx) => {
    if (!isAdmin(actor)) fail("FORBIDDEN", "استيراد أرصدة العهد التاريخية محصور على الأدمن");
    if (!isPositiveInteger(input.sourceId)) fail("BAD_REQUEST", "معرف سجل الإرث غير صالح");
    assertRequiredReason(input.reason, "سبب استيراد الرصيد الافتتاحي إلزامي");
    if (input.reason.trim().length < 5) fail("BAD_REQUEST", "سبب استيراد الرصيد الافتتاحي يجب أن يكون خمسة أحرف على الأقل");
    validateProductSnapshot(input.product);
    const { row, stage, pairs } = await assertLegacyCandidate(tx, input.sourceId);
    for(const [field,actual] of [["productName",input.product.name],["productSize",input.product.size],["productColor",input.product.color]] as const){const original=String(row[field]||"").trim();if(original&&original!==actual.trim())fail("BAD_REQUEST","لا يجوز تغيير اسم الصنف أو مقاسه أو لونه أثناء ترحيل الرصيد؛ يلزم تصحيح موثق مستقل");}
    const responsible = await accountById(tx, input.responsibleUserId);
    if (!accountBelongsToStage(responsible.department, stage)) fail("BAD_REQUEST", "المسؤول المحدد لا ينتمي إلى قسم مرحلة الرصيد التاريخي");
    const legacySourceKey = `manufacturingStages:${input.sourceId}`;
    const previous = await tx.select().from(custodyBatches).where(eq(custodyBatches.legacySourceKey, legacySourceKey)).limit(1);
    if (previous[0]) fail("CONFLICT", "تم استيراد هذا الرصيد التاريخي إلى العهد V2 مسبقًا");
    const id = randomUUID();
    const trackingNumber = `CUSTODY-OPEN-${id}`;
    const lot: CustodyLot = { id: randomUUID(), batchId: id, ownerId: responsible.id, ownerName: actorName(responsible), stage, quality: row.qualityGrade === "second" ? "second" : "first", pairs, status: "received", receivedAt: row.receivedAt ? new Date(row.receivedAt).toISOString() : isoNow(), progressPairs: 0, legacyTiming: true };
    const batch: CustodyBatch & { openingBalance: true; legacySource: { id: number; productionId: number | null; quantityPairs: number } } = {
      id, trackingNumber, productionId: row.productionId == null ? undefined : Number(row.productionId), version: 1, product: clone(input.product), purpose: row.qualityGrade === "sample" ? "sample" : "sale", productionDate: String(row.date || ""), machineNumber: String(row.machineNumber || ""), shift: String(row.shiftNumber || "legacy"), firstPairs: lot.quality === "first" ? pairs : 0, secondPairs: lot.quality === "second" ? pairs : 0, totalPairs: pairs, createdBy: actor.id, createdByName: actorName(actor), responsibleUserId: responsible.id, createdAt: isoNow(), custodies: [lot], transfers: [], sessions: [], progress: [], disposals: [], events: [], corrections: [], openingBalance: true, legacySource: { id: input.sourceId, productionId: row.productionId == null ? null : Number(row.productionId), quantityPairs: pairs },
    };
    const state: MutationState = { batch, pendingEvents: [] };
    event(state, actor, { action: "legacy_opening_balance_imported", custodyId: lot.id, stage, pairs, reason: input.reason.trim(), after: { legacySource: batch.legacySource, legacyTiming: true, product: batch.product } });
    await tx.insert(custodyBatches).values({ id, trackingNumber, productionId: batch.productionId ?? null, legacySourceKey, version: 1, payload: batch as any });
    await tx.insert(custodyEvents).values(state.pendingEvents.map((item, index) => ({ id: item.id, batchId: item.batchId, custodyId: item.custodyId ?? null, transferId: null, sessionId: null, progressId: null, disposalId: null, sequence: index + 1, actorId: item.actorId, actorName: item.actorName, stage: item.stage ?? null, action: item.action, pairs: item.pairs ?? null, reason: item.reason ?? null, before: item.before as any, after: item.after as any, payload: { at: item.at } as any, createdAt: asDate(item.at) })));
    return { success: true, batchId: id, trackingNumber };
  });
}

async function acquireWorkerLock(tx: Db, actor: CustodyActor, batchId: string, custodyId: string): Promise<void> {
  try {
    await tx.insert(custodyWorkerLocks).values({ userId: actor.id, batchId, custodyId, acquiredAt: new Date(), updatedAt: new Date() });
  } catch (error: any) {
    const cause=error?.cause || error;
    if(cause?.code !== "ER_DUP_ENTRY" && Number(cause?.errno) !== 1062) throw error;
    const locks = await tx.select().from(custodyWorkerLocks).where(eq(custodyWorkerLocks.userId, actor.id)).limit(1);
    const lock = locks[0];
    if (lock?.custodyId === custodyId) fail("CONFLICT", "جلسة العمل هذه مفتوحة بالفعل");
    fail("CONFLICT", "لا يمكن بدء أو استئناف أكثر من جلسة عمل يدوية للعامل نفسه عبر العهد");
  }
}

async function releaseWorkerLock(tx: Db, actor: CustodyActor, custodyId: string): Promise<void> {
  await tx.delete(custodyWorkerLocks).where(and(eq(custodyWorkerLocks.userId, actor.id), eq(custodyWorkerLocks.custodyId, custodyId)));
}

/** Exported for transaction-level integration tests; production start/resume uses this exact gate. */
export async function reserveCustodyWorkerSession(tx: Db, actor: CustodyActor, batchId: string, custodyId: string): Promise<void> {
  await acquireWorkerLock(tx, actor, batchId, custodyId);
}

/** Exported companion to release the global worker gate on pause or completion. */
export async function releaseCustodyWorkerSession(tx: Db, actor: CustodyActor, custodyId: string): Promise<void> {
  await releaseWorkerLock(tx, actor, custodyId);
}

async function receiveTransfer(tx: Db, state: MutationState, actor: CustodyActor, input: CustodyActionInput): Promise<void> {
  const transfer = transferById(state.batch, input.transferId);
  if (transfer.status !== "pending") fail("PRECONDITION_FAILED", "حركة النقل ليست بانتظار الاستلام");
  if (transfer.toUserId !== actor.id) fail("FORBIDDEN", "هذه الحركة ليست موجهة إلى حسابك");
  if (transfer.fromUserId === actor.id) fail("FORBIDDEN", "لا يجوز تسليم واستلام الحركة من الحساب نفسه");
  if (!isNonNegativeInteger(input.actualPairs)) fail("BAD_REQUEST", "يجب إدخال العد الفعلي بالأزواج عند الاستلام");
  if (input.actualPairs !== transfer.pairs) {
    const quantity = exactQuantityError(transfer.pairs, input.actualPairs);
    fail("BAD_REQUEST", quantity.ok ? "" : `${quantity.message}. سجّل اختلاف كمية بدل تأكيد الاستلام.`);
  }
  if (transfer.destinationCustodyId) fail("CONFLICT", "تم إنشاء العهدة المستلمة لهذه الحركة سابقًا");
  const receiver = await accountById(tx, actor.id);
  if (!accountBelongsToStage(receiver.department, transfer.toStage)) fail("FORBIDDEN", "حساب المستلم ليس ضمن قسم الحركة");
  const now = isoNow();
  const child: CustodyLot = {
    id: randomUUID(), batchId: state.batch.id, parentCustodyId: transfer.sourceCustodyId,
    ownerId: actor.id, ownerName: actorName(actor), stage: transfer.toStage, quality: transfer.quality,
    pairs: transfer.pairs, status: "received", receivedAt: now, progressPairs: 0,
    sourceStage: transfer.fromStage, sourceUserId: transfer.fromUserId, sourceName: transfer.fromName,
  };
  transfer.destinationCustodyId = child.id;
  transfer.receivedAt = now;
  transfer.status = "confirmed";
  state.batch.custodies.push(child);
  refreshSourceLiability(state.batch, transfer.sourceCustodyId);
  event(state, actor, { action: "transfer_received", custodyId: child.id, transferId: transfer.id, stage: child.stage, pairs: child.pairs, before: { status: "pending" }, after: { transferStatus: transfer.status, custody: child } });
  if (child.stage === "followup" && child.quality === "damaged") {
    const disposal: CustodyDisposal = { id: randomUUID(), custodyId: child.id, pairs: child.pairs, status: "received", reason: transfer.reason || "تالف معتمد" };
    state.batch.disposals.push(disposal);
    event(state, actor, { action: "disposal_received", custodyId: child.id, disposalId: disposal.id, stage: child.stage, pairs: child.pairs, after: disposal });
  }
  if (child.stage === "customer_service" && state.batch.purpose === "sample") {
    state.batch.sampleStatus = "ready_for_customer";
    await markSample(tx, state.batch, "ready_for_customer", actor);
  }
}

function disputeTransfer(state: MutationState, actor: CustodyActor, input: CustodyActionInput, action: "dispute" | "reject"): void {
  const transfer = transferById(state.batch, input.transferId);
  if (transfer.status !== "pending") fail("PRECONDITION_FAILED", "لا يمكن تسجيل اختلاف لهذه الحركة في حالتها الحالية");
  if (transfer.toUserId !== actor.id) fail("FORBIDDEN", "هذه الحركة ليست موجهة إلى حسابك");
  if (transfer.fromUserId === actor.id) fail("FORBIDDEN", "لا يجوز تسليم واستلام الحركة من الحساب نفسه");
  assertRequiredReason(input.reason);
  if (action === "dispute" && !isNonNegativeInteger(input.actualPairs)) fail("BAD_REQUEST", "العد الفعلي بالأزواج إلزامي عند تسجيل الاختلاف");
  const before = clone(transfer);
  transfer.status = action === "dispute" ? "disputed" : "rejected";
  transfer.reason = input.reason.trim();
  transfer.actualPairs = input.actualPairs;
  transfer.attachments = input.attachments;
  refreshSourceLiability(state.batch, transfer.sourceCustodyId);
  event(state, actor, { action: action === "dispute" ? "transfer_disputed" : "transfer_rejected", transferId: transfer.id, custodyId: transfer.sourceCustodyId, stage: transfer.fromStage, pairs: transfer.pairs, reason: transfer.reason, before, after: transfer });
}

function resolveTransfer(state: MutationState, actor: CustodyActor, input: CustodyActionInput): void {
  if (!isSupervisor(actor)) fail("FORBIDDEN", "حل اختلاف النقل محصور على المشرف أو الأدمن");
  const transfer = transferById(state.batch, input.transferId);
  if (!["disputed", "rejected"].includes(transfer.status)) fail("PRECONDITION_FAILED", "لا توجد حركة مجمدة قابلة للحل");
  assertRequiredReason(input.reason, "سبب حل الاختلاف إلزامي");
  const before = clone(transfer);
  // No quantity, recipient, or custody is altered during resolution: same transfer resumes pending.
  transfer.status = "pending";
  transfer.reason = `${transfer.reason || ""}\nحل المشرف: ${input.reason.trim()}`.trim();
  refreshSourceLiability(state.batch, transfer.sourceCustodyId);
  event(state, actor, { action: "transfer_resolved_to_pending", transferId: transfer.id, custodyId: transfer.sourceCustodyId, stage: transfer.fromStage, pairs: transfer.pairs, reason: input.reason.trim(), before, after: transfer });
}

async function beginWork(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, resume: boolean): Promise<void> {
  assertLotOwner(actor, lot);
  if (resume) {
    if (lot.status !== "paused") fail("PRECONDITION_FAILED", "لا يمكن استئناف عهدة ليست متوقفة");
    const pause = activeSession(state.batch, lot.id, "pause");
    if (!pause) fail("CONFLICT", "جلسة التوقف غير مكتملة");
    pause.endedAt = isoNow();
  } else if (lot.status !== "received") {
    fail("PRECONDITION_FAILED", "لا يمكن بدء العمل إلا بعد الاستلام وقبل الإكمال");
  }
  await acquireWorkerLock(tx, actor, state.batch.id, lot.id);
  const now = isoNow();
  const session = { id: randomUUID(), custodyId: lot.id, userId: actor.id, startedAt: now, kind: "work" as const };
  state.batch.sessions.push(session);
  lot.status = "working";
  lot.startedAt ??= now;
  event(state, actor, { action: resume ? "work_resumed" : "work_started", custodyId: lot.id, sessionId: session.id, stage: lot.stage, pairs: lot.pairs, after: session });
}

async function pauseWork(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, reason: string | undefined): Promise<void> {
  assertLotOwner(actor, lot);
  if (lot.status !== "working") fail("PRECONDITION_FAILED", "لا يمكن إيقاف عهدة ليست قيد العمل");
  assertRequiredReason(reason, "سبب الإيقاف المؤقت إلزامي");
  const work = activeSession(state.batch, lot.id, "work");
  if (!work) fail("CONFLICT", "جلسة العمل المفتوحة غير موجودة");
  const now = isoNow();
  work.endedAt = now;
  const pause = { id: randomUUID(), custodyId: lot.id, userId: actor.id, startedAt: now, kind: "pause" as const, reason: reason.trim() };
  state.batch.sessions.push(pause);
  lot.status = "paused";
  await releaseWorkerLock(tx, actor, lot.id);
  event(state, actor, { action: "work_paused", custodyId: lot.id, sessionId: pause.id, stage: lot.stage, pairs: lot.progressPairs, reason: pause.reason, after: pause });
}

function recordProgress(state: MutationState, actor: CustodyActor, lot: CustodyLot, pairs: number | undefined): void {
  assertLotOwner(actor, lot);
  if (lot.status !== "working") fail("PRECONDITION_FAILED", "سجل التقدم متاح فقط أثناء جلسة عمل مفتوحة");
  assertActiveInteger(pairs, "التقدم التراكمي", true);
  if (pairs <= lot.progressPairs) fail("BAD_REQUEST", "يجب أن يزيد التقدم التراكمي عن القراءة السابقة");
  if (pairs > lot.pairs) fail("BAD_REQUEST", "لا يمكن أن يتجاوز التقدم التراكمي كمية العهدة");
  const reading = { id: randomUUID(), custodyId: lot.id, userId: actor.id, pairs, recordedAt: isoNow() };
  const before = lot.progressPairs;
  lot.progressPairs = pairs;
  state.batch.progress.push(reading);
  event(state, actor, { action: "progress_recorded", custodyId: lot.id, progressId: reading.id, stage: lot.stage, pairs, before: { progressPairs: before }, after: reading });
}

async function completeWork(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot): Promise<void> {
  assertLotOwner(actor, lot);
  if (lot.status !== "working") fail("PRECONDITION_FAILED", "لا يمكن إكمال عهدة ليست قيد العمل");
  if (lot.progressPairs !== lot.pairs) fail("PRECONDITION_FAILED", "لا يمكن إكمال العمل قبل تسجيل تقدم تراكمي يساوي كامل كمية العهدة");
  const work = activeSession(state.batch, lot.id, "work");
  if (!work) fail("CONFLICT", "جلسة العمل المفتوحة غير موجودة");
  const now = isoNow();
  work.endedAt = now;
  lot.status = "completed";
  lot.completedAt = now;
  await releaseWorkerLock(tx, actor, lot.id);
  event(state, actor, { action: "work_completed", custodyId: lot.id, sessionId: work.id, stage: lot.stage, pairs: lot.pairs, after: { status: lot.status, completedAt: now } });
}

async function sendLot(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput, isRework = false): Promise<void> {
  if (!isRework) {
    assertLotOwner(actor, lot);
    assertCompletedFull(lot);
  }
  const allocations = assertAllocations(state.batch, lot, input.allocations, input.reason);
  if (allocations.some(item => item.quality !== lot.quality)) assertRequiredReason(input.reason, "سبب تغيير تصنيف الجودة إلزامي");
  if (allocations.some(item => ["suspected", "damaged"].includes(item.quality))) assertRequiredReason(input.defectType, "نوع العيب أو الاشتباه إلزامي؛ لا يحدد ذلك المسؤولية تلقائيًا");
  if (input.pairs !== undefined) { const check = exactQuantityError(lot.pairs, input.pairs); if (!check.ok) fail("BAD_REQUEST", check.message); }
  const now = isoNow();
  for (const allocation of allocations) {
    const receiver = await assertDestination(tx, actor, allocation);
    const transfer: CustodyTransfer = {
      id: randomUUID(), batchId: state.batch.id, sourceCustodyId: lot.id,
      fromUserId: lot.ownerId, fromName: lot.ownerName, toUserId: receiver.id, toName: actorName(receiver),
      fromStage: lot.stage, toStage: allocation.toStage, quality: allocation.quality, pairs: allocation.pairs,
      sentAt: now, status: "pending", reason: input.reason?.trim() || undefined,
      defectType: input.defectType?.trim(), defectCause: input.defectCause?.trim(), attachments: input.attachments,
    };
    state.batch.transfers.push(transfer);
    event(state, actor, { action: isRework ? "rework_transfer_sent" : "transfer_sent", custodyId: lot.id, transferId: transfer.id, stage: lot.stage, pairs: transfer.pairs, reason: transfer.reason, after: transfer });
  }
  // Liability remains with the sender until *every* fan-out transfer is confirmed.
  lot.status = "sent";
  lot.sentAt = now;
}

function findDisposal(batch: CustodyBatch, custodyId: string): CustodyDisposal {
  const disposal = batch.disposals.find((item) => item.custodyId === custodyId);
  if (!disposal) fail("NOT_FOUND", "محضر الإتلاف غير موجود للعهدة");
  return disposal;
}

async function storeLot(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput): Promise<void> {
  assertLotOwner(actor, lot);
  if (!accountBelongsToStage(actor.department, "storage") || lot.stage !== "storage") fail("FORBIDDEN", "إدخال المخزون متاح لمسؤول عهدة المخازن فقط");
  if (state.batch.purpose !== "sale") fail("FORBIDDEN", "العينات لا تدخل مخزون البيع");
  if (!["first", "second"].includes(lot.quality)) fail("BAD_REQUEST", "لا يخزن إلا النخب الأول أو الثاني");
  assertReceivedOrCompletedStorage(lot);
  if (!input.barcode?.trim()) fail("BAD_REQUEST", "باركود المخزون إلزامي عند الإدخال النهائي فقط");
  assertActiveInteger(input.packagePairs, "عدد الأزواج في العبوة");
  if (input.packagePairs > lot.pairs) fail("BAD_REQUEST", "عدد أزواج العبوة لا يمكن أن يزيد على كمية العهدة");
  const barcode = input.barcode.trim().toUpperCase();
  const duplicate = await tx.select().from(custodyInventory).where(eq(custodyInventory.custodyId, lot.id)).limit(1);
  if (duplicate[0]) fail("CONFLICT", "تم إدخال هذه العهدة إلى المخزون مسبقًا");
  const sameBarcode = await tx.select().from(custodyInventory).where(eq(custodyInventory.barcode, barcode));
  for (const row of sameBarcode) {
    if (row.productCode !== state.batch.product.code || row.productSize !== state.batch.product.size || row.productColor !== state.batch.product.color || row.quality !== lot.quality) {
      fail("CONFLICT", "الباركود مرتبط بصنف أو مقاس أو لون أو نخب مختلف، ولا يجوز ربطه عبر جودة مختلفة");
    }
  }
  // Parent-owned adapter records the compatible legacy stock movement in this same transaction.
  const inventory = await loadInventoryIntegration();
  await inventory.recordCustodyStockReceipt(tx, {
    custodyId: lot.id, batchId: state.batch.id, barcode,
    productName: state.batch.product.name, productSize: state.batch.product.size, productColor: state.batch.product.color,
    productCode: state.batch.product.code, qualityGrade: lot.quality, pairs: lot.pairs, packagePairs: input.packagePairs, userId: actor.id,
  });
  await tx.insert(custodyInventory).values({
    id: randomUUID(), batchId: state.batch.id, custodyId: lot.id, barcode,
    productCode: state.batch.product.code, productSize: state.batch.product.size, productColor: state.batch.product.color,
    quality: lot.quality, packagePairs: input.packagePairs, pairs: lot.pairs, storedBy: actor.id,
  });
  const before = lot.status;
  lot.status = "stored";
  event(state, actor, { action: "stock_stored", custodyId: lot.id, stage: lot.stage, pairs: lot.pairs, before: { status: before }, after: { status: lot.status, barcode, packagePairs: input.packagePairs } });
}

function assertFollowupManagerOrAdmin(actor: CustodyActor): void {
  if (!isAdmin(actor) && !(isManagerOrAdmin(actor) && accountBelongsToStage(actor.department, "followup"))) fail("FORBIDDEN", "اعتماد الإتلاف محصور على مدير المتابعة أو الأدمن");
}

function approveDisposal(state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput): void {
  assertFollowupManagerOrAdmin(actor);
  if (lot.stage !== "followup" || lot.quality !== "damaged") fail("BAD_REQUEST", "هذه العهدة ليست تالفًا محولًا للمتابعة");
  if (!["received", "completed"].includes(lot.status)) fail("PRECONDITION_FAILED", "العهدة ليست مستلمة مفتوحة لدى المتابعة");
  const disposal = findDisposal(state.batch, lot.id);
  if (disposal.status !== "received") fail("PRECONDITION_FAILED", "محضر الإتلاف ليس بانتظار الاعتماد");
  assertRequiredReason(input.reason, "سبب الاعتماد أو قرار المراجعة إلزامي");
  const before = clone(disposal);
  disposal.status = "approved";
  disposal.reason = `${disposal.reason}\nقرار الاعتماد: ${input.reason.trim()}`;
  disposal.approvedBy = actor.id;
  disposal.approvedAt = isoNow();
  disposal.attachments = input.attachments ?? disposal.attachments ?? [];
  event(state, actor, { action: "disposal_approved", custodyId: lot.id, disposalId: disposal.id, stage: lot.stage, pairs: disposal.pairs, reason: input.reason.trim(), before, after: disposal });
}

function executeDisposal(state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput): void {
  assertLotOwner(actor, lot);
  if (lot.stage !== "followup" || lot.quality !== "damaged") fail("BAD_REQUEST", "هذه العهدة ليست تالفًا محولًا للمتابعة");
  if (!["received", "completed"].includes(lot.status)) fail("PRECONDITION_FAILED", "العهدة ليست مستلمة مفتوحة لدى المتابعة");
  const disposal = findDisposal(state.batch, lot.id);
  if (disposal.status !== "approved") fail("PRECONDITION_FAILED", "لا ينفذ الإتلاف قبل اعتماد المحضر");
  assertRequiredReason(input.reason, "سبب تنفيذ الإتلاف إلزامي");
  assertRequiredReason(input.method, "طريقة الإتلاف إلزامية");
  if (!Array.isArray(input.attachments) || input.attachments.length === 0) fail("BAD_REQUEST", "إثبات أو مرفق تنفيذ الإتلاف إلزامي");
  const before = clone(disposal);
  disposal.status = "executed";
  disposal.reason = `${disposal.reason}\nتنفيذ الإتلاف: ${input.reason.trim()}`;
  disposal.method = input.method.trim();
  disposal.attachments = input.attachments;
  disposal.executedBy = actor.id;
  disposal.executedAt = isoNow();
  lot.status = "destroyed";
  event(state, actor, { action: "disposal_executed", custodyId: lot.id, disposalId: disposal.id, stage: lot.stage, pairs: disposal.pairs, reason: input.reason.trim(), before, after: disposal });
}

async function deliverSample(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput): Promise<void> {
  assertLotOwner(actor, lot);
  if (state.batch.purpose !== "sample" || lot.stage !== "customer_service") fail("BAD_REQUEST", "تسليم العميل متاح فقط لعينة استلمتها خدمة العملاء");
  if (!["received", "completed"].includes(lot.status)) fail("PRECONDITION_FAILED", "يجب استلام العينة في خدمة العملاء قبل توثيق تسليمها");
  assertRequiredReason(input.receiver, "اسم مستلم العينة إلزامي");
  assertRequiredReason(input.method, "طريقة تسليم العينة إلزامية");
  assertRequiredReason(input.proof, "إثبات تسليم العينة إلزامي");
  const at = isoNow();
  state.batch.sampleDelivery = { receiver: input.receiver.trim(), method: input.method.trim(), proof: input.proof.trim(), at };
  state.batch.sampleStatus = "delivered";
  lot.status = "closed";
  event(state, actor, { action: "sample_delivered", custodyId: lot.id, stage: lot.stage, pairs: lot.pairs, after: state.batch.sampleDelivery });
  await markSample(tx, state.batch, "delivered", actor);
}

function correctBatch(state: MutationState, actor: CustodyActor, input: CustodyActionInput): void {
  if (!isSupervisor(actor)) fail("FORBIDDEN", "تصحيح بيانات الدفعة محصور على المشرف أو الأدمن");
  assertRequiredReason(input.reason, "سبب التصحيح إلزامي");
  if (!input.correction || !Object.keys(input.correction).length) fail("BAD_REQUEST", "بيانات التصحيح مطلوبة");
  const candidate = { ...clone(state.batch.product), ...clone(input.correction), yarns: input.correction.yarns ?? state.batch.product.yarns } as CustodyProduct;
  validateProductSnapshot(candidate);
  const correction = { id: randomUUID(), at: isoNow(), actorId: actor.id, reason: input.reason.trim(), before: clone(state.batch.product), after: candidate };
  // The original product snapshot remains immutable. Consumers can elect the approved correction
  // from this append-only list; past custody/event records are never rewritten.
  state.batch.corrections ??= [];
  state.batch.corrections.push(correction);
  event(state, actor, { action: "batch_correction_recorded", stage: "production", reason: correction.reason, before: correction.before, after: correction.after });
}

async function reworkLot(tx: Db, state: MutationState, actor: CustodyActor, lot: CustodyLot, input: CustodyActionInput): Promise<void> {
  if (!isSupervisor(actor)) fail("FORBIDDEN", "إعادة المعالجة تتطلب قرار مشرف أو أدمن موثق");
  if (state.batch.disposals.some(item => item.custodyId === lot.id && item.status !== "received")) fail("PRECONDITION_FAILED", "لا تحول عهدة لاعادة المعالجة بعد اعتماد إتلافها أو تنفيذه");
  assertRequiredReason(input.reason, "سبب قرار إعادة المعالجة إلزامي");
  if (lot.stage !== "followup" || lot.quality !== "damaged") fail("BAD_REQUEST", "إعادة المعالجة الاستثنائية متاحة للتالف لدى المتابعة فقط");
  if (!["received", "completed"].includes(lot.status)) fail("PRECONDITION_FAILED", "عهدة إعادة المعالجة ليست جاهزة");
  if (!Array.isArray(input.allocations) || input.allocations.length !== 1) fail("BAD_REQUEST", "قرار إعادة المعالجة يجب أن يحدد مستلمًا واحدًا لكامل العهدة");
  const allocation = input.allocations[0];
  if (!["production", "inspection"].includes(allocation.toStage) || allocation.quality !== lot.quality || allocation.pairs !== lot.pairs) {
    fail("BAD_REQUEST", "إعادة المعالجة تقتصر على كامل العهدة إلى الإنتاج أو الفحص وبنفس التصنيف");
  }
  const receiver = await assertDestination(tx, actor, allocation);
  const now = isoNow();
  const transfer: CustodyTransfer = {
    id: randomUUID(), batchId: state.batch.id, sourceCustodyId: lot.id, fromUserId: lot.ownerId, fromName: lot.ownerName,
    toUserId: receiver.id, toName: actorName(receiver), fromStage: lot.stage, toStage: allocation.toStage,
    quality: allocation.quality, pairs: allocation.pairs, sentAt: now, status: "pending", reason: `قرار إعادة معالجة: ${input.reason.trim()}`,
  };
  state.batch.transfers.push(transfer);
  lot.status = "sent";
  lot.sentAt = now;
  event(state, actor, { action: "rework_override_sent", custodyId: lot.id, transferId: transfer.id, stage: lot.stage, pairs: transfer.pairs, reason: transfer.reason, after: transfer });
}

export async function actOnCustody(db: Db, actor: CustodyActor, input: CustodyActionInput): Promise<{ success: true; batchId: string }> {
  return executeIdempotent(db, actor, input.operationKey, input, async (tx) => {
    if (!input.batchId || typeof input.batchId !== "string") fail("BAD_REQUEST", "معرف الدفعة مطلوب");
    await accountById(tx, actor.id);
    const batch = await loadBatch(tx, input.batchId);
    const expectedVersion = batch.version;
    const state: MutationState = { batch, pendingEvents: [] };
    const lot = input.custodyId ? lotById(batch, input.custodyId) : undefined;
    switch (input.action) {
      case "receive": await receiveTransfer(tx, state, actor, input); break;
      case "dispute": disputeTransfer(state, actor, input, "dispute"); break;
      case "reject": disputeTransfer(state, actor, input, "reject"); break;
      case "resolve": resolveTransfer(state, actor, input); break;
      case "start": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await beginWork(tx, state, actor, lot, false); break;
      case "pause": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await pauseWork(tx, state, actor, lot, input.reason); break;
      case "resume": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await beginWork(tx, state, actor, lot, true); break;
      case "progress": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); recordProgress(state, actor, lot, input.pairs); break;
      case "complete": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await completeWork(tx, state, actor, lot); break;
      case "send": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await sendLot(tx, state, actor, lot, input); break;
      case "store": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await storeLot(tx, state, actor, lot, input); break;
      case "approve_disposal": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); approveDisposal(state, actor, lot, input); break;
      case "execute_disposal": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); executeDisposal(state, actor, lot, input); break;
      case "deliver_sample": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await deliverSample(tx, state, actor, lot, input); break;
      case "correct": correctBatch(state, actor, input); break;
      case "rework": if (!lot) fail("BAD_REQUEST", "معرف العهدة مطلوب"); await reworkLot(tx, state, actor, lot, input); break;
      default: fail("BAD_REQUEST", "إجراء العهدة غير معروف");
    }
    await persistAggregate(tx, state, expectedVersion);
    return { success: true, batchId: batch.id };
  });
}

export async function listCustodyAccounts(db: Db): Promise<CustodyAccount[]> {
  const rows = await db.select().from(users).where(eq(users.isActive, 1));
  return rows
    .filter((row: any) => CUSTODY_STAGES.some((stage) => accountBelongsToStage(row.department, stage)))
    .map((row: any) => ({ id: Number(row.id), name: actorName(row), department: String(row.department || ""), role: String(row.role || "user") }));
}

function batchVisibleTo(batch: CustodyBatch, actor: CustodyActor): boolean {
  if (isAdmin(actor)) return true;
  if (batch.custodies.some((lot) => lot.ownerId === actor.id)) return true;
  if (batch.transfers.some((transfer) => transfer.fromUserId === actor.id || transfer.toUserId === actor.id)) return true;
  if ((actor.role === "manager" || actor.role === "supervisor") && batch.custodies.some((lot) => accountBelongsToStage(actor.department, lot.stage))) return true;
  return false;
}

export async function listCustodyBatches(db: Db, actor: CustodyActor, filter: { stage?: CustodyStage; batchId?: string }): Promise<CustodyBatch[]> {
  if (filter.stage) assertStage(filter.stage);
  const rows = filter.batchId
    ? await db.select().from(custodyBatches).where(eq(custodyBatches.id, filter.batchId)).limit(1)
    : await db.select().from(custodyBatches);
  return (rows as Array<{ payload: unknown }>).map((row) => decodeBatch(row.payload)).filter((batch: CustodyBatch) => batchVisibleTo(batch, actor))
    .filter((batch: CustodyBatch) => !filter.stage || batch.custodies.some((lot: CustodyLot) => lot.stage === filter.stage));
}

function parseSettings(payload: unknown, scheduleCronTaskUid?: string | null): CustodySettings {
  let raw: any = payload;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = {}; }
  }
  return {
    enabled: raw?.enabled === true,
    scheduleCronTaskUid: scheduleCronTaskUid ?? raw?.scheduleCronTaskUid ?? null,
    stageLimits: raw?.stageLimits && typeof raw.stageLimits === "object" ? raw.stageLimits : {},
    shifts: Array.isArray(raw?.shifts) ? raw.shifts : [],
    holidays: Array.isArray(raw?.holidays) ? raw.holidays : [],
  };
}

function validateSettings(settings: CustodySettings): void {
  if (typeof settings.enabled !== "boolean" || !settings.stageLimits || !Array.isArray(settings.shifts) || !Array.isArray(settings.holidays)) {
    fail("BAD_REQUEST", "إعدادات العهدة غير صالحة");
  }
  for (const [stage, limit] of Object.entries(settings.stageLimits)) {
    assertStage(stage);
    if (!limit || !Number.isFinite(limit.workHours) || limit.workHours <= 0 || !Number.isFinite(limit.confirmationHours) || limit.confirmationHours <= 0) {
      fail("BAD_REQUEST", "حدود التأخير يجب أن تكون ساعات موجبة لكل مرحلة");
    }
  }
  for (const shift of settings.shifts) {
    if (!shift || !String(shift.name || "").trim() || !/^\d{2}:\d{2}$/.test(shift.start) || !/^\d{2}:\d{2}$/.test(shift.end) || !Array.isArray(shift.days) || shift.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      fail("BAD_REQUEST", "تعريف الوردية غير صالح");
    }
  }
  if (settings.holidays.some((day) => typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day))) fail("BAD_REQUEST", "تواريخ العطلات غير صالحة");
}

export async function getCustodySettings(db: Db): Promise<CustodySettings> {
  const rows = await db.select().from(custodySettingsTable).where(eq(custodySettingsTable.id, 1)).limit(1);
  return rows[0] ? parseSettings(rows[0].payload, rows[0].scheduleCronTaskUid) : clone(DEFAULT_SETTINGS);
}

export async function saveCustodySettings(db: Db, actor: CustodyActor, settings: CustodySettings): Promise<{ success: true }> {
  if (!isAdmin(actor)) fail("FORBIDDEN", "إعدادات العهدة محصورة على الأدمن");
  validateSettings(settings);
  const payload = { enabled: settings.enabled, stageLimits: settings.stageLimits, shifts: settings.shifts, holidays: settings.holidays };
  await db.insert(custodySettingsTable).values({ id: 1, payload: payload as any, scheduleCronTaskUid: settings.scheduleCronTaskUid ?? null })
    .onDuplicateKeyUpdate({ set: { payload: payload as any, scheduleCronTaskUid: settings.scheduleCronTaskUid ?? null, updatedAt: new Date() } });
  return { success: true };
}

type DelayAlert = { batchId: string; custodyId: string; transferId?: string; responsibleUserId: number; stage: CustodyStage; kind: "work" | "confirmation"; hours: number };

/**
 * Stateless scheduled scan. It has no timer and can safely be invoked by the parent-mounted task.
 * Each threshold alert is claimed by a unique actor-0 operation marker before the legacy alert row
 * is inserted, making scans idempotent even if task invocations overlap.
 */
export async function scanCustodyDelays(db: Db, taskUid?: string): Promise<DelayAlert[]> {
  const settings = await getCustodySettings(db);
  if (!settings.enabled || (taskUid && settings.scheduleCronTaskUid && taskUid !== settings.scheduleCronTaskUid)) return [];
  const now = Date.now();
  const rows = await db.select().from(custodyBatches);
  const candidates: DelayAlert[] = [];
  for (const row of rows) {
    const batch = decodeBatch(row.payload);
    for (const lot of batch.custodies) {
      const limit = settings.stageLimits[lot.stage];
      if (!limit) continue; // no invented limits
      if (["received", "working", "paused"].includes(lot.status)) {
        const observed = businessMilliseconds(lot.receivedAt, new Date(now).toISOString(), settings);
        const hours = observed.businessMs === null ? NaN : observed.businessMs / 3_600_000;
        if (Number.isFinite(hours) && hours > limit.workHours) candidates.push({ batchId: batch.id, custodyId: lot.id, responsibleUserId: lot.ownerId, stage: lot.stage, kind: "work", hours });
      }
    }
    for (const transfer of batch.transfers) {
      if (transfer.status !== "pending") continue;
      const limit = settings.stageLimits[transfer.toStage];
      const hours = limit ? (now - Date.parse(transfer.sentAt)) / 3_600_000 : NaN;
      if (limit && Number.isFinite(hours) && hours > limit.confirmationHours) candidates.push({ batchId: batch.id, custodyId: transfer.sourceCustodyId, transferId: transfer.id, responsibleUserId: transfer.toUserId, stage: transfer.toStage, kind: "confirmation", hours });
    }
  }
  const emitted: DelayAlert[] = [];
  for (const item of candidates) {
    // One alert per custody/kind remains idempotent across overlapping scans and later retries.
    const operationKey = `delay:${item.kind}:${item.transferId ?? item.custodyId}`;
    try {
      await db.transaction(async (tx: Db) => {
        const existing = await findOperation(tx, 0, operationKey);
        if (existing) return;
        const batch = await loadBatch(tx, item.batchId);
        const lot = lotById(batch, item.custodyId);
        if(item.kind === "work" && !["received","working","paused"].includes(lot.status)) return;
        if(item.kind === "confirmation" && batch.transfers.find(t=>t.id===item.transferId)?.status !== "pending") return;
        // Dynamic import avoids coupling this isolated module to the legacy alerts schema at boot.
        const legacy = await import("../drizzle/schema.js");
        await tx.insert(legacy.alerts).values({
          type: "quality_issue", severity: "warning", title: item.kind === "work" ? "تأخر عمل عهدة" : "تأخر تأكيد استلام",
          message: `العهدة ${batch.trackingNumber} تجاوزت حد ${item.kind === "work" ? "العمل" : "تأكيد الاستلام"} في مرحلة ${item.stage} — المسؤول #${item.responsibleUserId}`,
          data: { custodyV2: true, key: operationKey, batchId: item.batchId, custodyId: item.custodyId, kind: item.kind, transferId: item.transferId, responsibleUserId: item.responsibleUserId, stage: item.stage, hours: item.hours } as any,
          userId: item.responsibleUserId,
        });
        await saveOperation(tx, { id: 0, role: "system", name: "system" }, operationKey, requestHash(item), item.batchId, { success: true, batchId: item.batchId });
        emitted.push(item);
      });
    } catch (error: any) {
      // Duplicate unique key belongs to another overlapping scan; do not duplicate the alert.
      if (!(error?.code === "ER_DUP_ENTRY" || String(error?.message || "").includes("Duplicate"))) throw error;
    }
  }
  return emitted;
}

export { computeTimingMetrics };
