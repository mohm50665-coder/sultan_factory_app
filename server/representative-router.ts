import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNull, like, lte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";

import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  auditLog,
  customers,
  internalMessages,
  representativeAttachments,
  representativeCollections,
  representativeDeclarations,
  representativePerformanceWeights,
  representativeTransactionItems,
  representativeTransactions,
  representativeWorkflowEvents,
  users,
} from "../drizzle/schema";

const SALES_NAMES = ["sales", "marketing", "المبيعات", "التسويق", "التسويق والمبيعات", "إدارة التسويق والمبيعات"];
const WAREHOUSE_NAMES = ["warehouse", "warehouses", "storage", "المستودع", "المستودعات", "إدارة المستودعات"];
const PRODUCTION_NAMES = ["production", "الإنتاج", "قسم الإنتاج"];
const CUSTOMER_REQUIRED_ATTACHMENTS = ["commercial_register", "national_address"];
const YARN_KEYS = ["cotton", "bamboo", "nylon", "polyester", "rubber", "spandex"] as const;

const normalize = (value: unknown) => String(value || "").normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const matchesDepartment = (value: unknown, aliases: string[]) => aliases.some((alias) => normalize(value) === normalize(alias) || normalize(value).includes(normalize(alias)));
const isAdmin = (user: any) => user?.role === "admin";
const isSalesManager = (user: any) => isAdmin(user) || (["manager", "supervisor"].includes(user?.role) && matchesDepartment(user?.department, SALES_NAMES)) || normalize(user?.position).includes("مدير المبيعات") || normalize(user?.position).includes("مدير التسويق");
const isWarehouseManager = (user: any) => isAdmin(user) || (["manager", "supervisor"].includes(user?.role) && matchesDepartment(user?.department, WAREHOUSE_NAMES)) || normalize(user?.position).includes("مدير المستودع");
const isProductionManager = (user: any) => isAdmin(user) || (["manager", "supervisor"].includes(user?.role) && matchesDepartment(user?.department, PRODUCTION_NAMES)) || normalize(user?.position).includes("مدير الانتاج") || normalize(user?.position).includes("مدير الإنتاج");
const isRepresentative = (user: any) => isAdmin(user) || matchesDepartment(user?.department, SALES_NAMES) || normalize(user?.position).includes("مندوب");

const parseArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

const getRiyadhDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const makeReference = (prefix: string) => `${prefix}-${getRiyadhDate().replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const attachmentSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.string().optional(),
  expiresAt: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(2),
  commercialRegister: z.string().min(2),
  taxNumber: z.string().optional().default(""),
  isTaxRegistered: z.boolean().default(false),
  municipalLicense: z.string().optional().default(""),
  nationalAddress: z.string().min(3),
  city: z.string().min(2),
  district: z.string().min(2),
  street: z.string().min(2),
  email: z.string().email(),
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(7),
  contactName: z.string().min(2),
  contactPhone: z.string().min(7),
  contactEmail: z.string().email().optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  attachments: z.array(attachmentSchema),
});

const itemSchema = z.object({
  productName: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  quantity: z.number().int().positive(),
  quantityUnit: z.enum(["dozen", "pair"]),
  productType: z.string().optional(),
  yarnRatios: z.record(z.string(), z.number()).optional(),
});

const transactionSchema = z.object({
  transactionType: z.enum(["order", "visit", "return", "custom", "sample"]),
  customerId: z.number().int().positive(),
  orderDate: z.string().min(10),
  deliveryDate: z.string().optional().default(""),
  paymentMethod: z.enum(["cash", "transfer", "credit"]).optional(),
  paymentAmount: z.number().min(0).optional().default(0),
  receiptNumber: z.string().optional().default(""),
  receiptDate: z.string().optional().default(""),
  creditDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
  visitReport: z.string().optional().default(""),
  returnReason: z.string().optional().default(""),
  items: z.array(itemSchema).min(1),
  attachments: z.array(attachmentSchema).default([]),
});

function validateCustomerAttachments(input: z.infer<typeof customerSchema>) {
  const types = new Set(input.attachments.map((attachment) => attachment.type));
  const missing = CUSTOMER_REQUIRED_ATTACHMENTS.filter((type) => !types.has(type));
  if (input.isTaxRegistered && !types.has("tax_certificate")) missing.push("tax_certificate");
  if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `مرفقات العميل الإلزامية ناقصة: ${missing.join(", ")}` });
}

function validateStoredCustomer(customer: any) {
  const requiredText = [customer.name, customer.commercialRegister, customer.nationalAddress, customer.city, customer.district, customer.street, customer.email, customer.ownerName, customer.ownerPhone, customer.contactName, customer.contactPhone];
  if (requiredText.some((value) => !String(value || "").trim() || String(value).includes("غير متوفر"))) throw new TRPCError({ code: "BAD_REQUEST", message: "ملف العميل غير مكتمل؛ أكمل بيانات المنشأة والمالك والمسؤول قبل إنشاء الطلب" });
  if (customer.isTaxRegistered && !String(customer.taxNumber || "").trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "الرقم الضريبي إلزامي للعميل المسجل ضريبياً" });
  if (!Number.isFinite(Number(customer.latitude)) || !Number.isFinite(Number(customer.longitude))) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد موقع العميل على الخريطة قبل إنشاء الطلب" });
  const types = new Set(parseArray(customer.attachments).map((attachment) => attachment?.type));
  const missing = CUSTOMER_REQUIRED_ATTACHMENTS.filter((type) => !types.has(type));
  if (customer.isTaxRegistered && !types.has("tax_certificate")) missing.push("tax_certificate");
  if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `استكمل مرفقات ملف العميل قبل إنشاء الطلب: ${missing.join(", ")}` });
}

function validateTransaction(input: z.infer<typeof transactionSchema>) {
  if (input.transactionType === "visit" && input.visitReport.trim().length < 5) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "تقرير الزيارة إلزامي ويجب أن يوضح نتيجة الزيارة" });
  }
  if (input.transactionType === "return" && input.returnReason.trim().length < 5) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "سبب المرتجع إلزامي ويجب أن يكون واضحاً" });
  }
  if (["order", "custom", "sample"].includes(input.transactionType) && !input.deliveryDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "موعد التسليم إلزامي" });
  }
  if (input.transactionType === "order") {
    if (!input.paymentMethod) throw new TRPCError({ code: "BAD_REQUEST", message: "طريقة الدفع إلزامية" });
    if ((input.paymentAmount || 0) <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "مبلغ الطلب يجب أن يكون أكبر من صفر" });
    if (input.paymentMethod === "cash" && (!input.receiptNumber || !input.receiptDate)) throw new TRPCError({ code: "BAD_REQUEST", message: "رقم سند القبض وتاريخه إلزاميان للدفع النقدي" });
    if (input.paymentMethod === "transfer" && !input.attachments.some((attachment) => attachment.type === "transfer_receipt")) throw new TRPCError({ code: "BAD_REQUEST", message: "إيصال التحويل إلزامي" });
    if (input.paymentMethod === "credit" && ![30, 60, 90].includes(Number(input.creditDays))) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد مدة الآجل 30 أو 60 أو 90 يوماً" });
  }
  if (["custom", "sample"].includes(input.transactionType)) {
    for (const item of input.items) {
      const ratios = item.yarnRatios || {};
      const total = YARN_KEYS.reduce((sum, key) => sum + Number(ratios[key] || 0), 0);
      if (Math.abs(total - 100) > 0.01) throw new TRPCError({ code: "BAD_REQUEST", message: `مجموع نسب الخيوط للصنف ${item.productName} يجب أن يساوي 100%` });
    }
  }
  if (input.transactionType === "sample") {
    if (input.items.some((item) => item.quantityUnit !== "pair" || item.quantity < 1 || item.quantity > 5)) throw new TRPCError({ code: "BAD_REQUEST", message: "كمية العينة من 1 إلى 5 أزواج فقط" });
    if (!input.attachments.some((attachment) => attachment.type === "sample_payment_80")) throw new TRPCError({ code: "BAD_REQUEST", message: "إيصال تحويل 80 ريال إلزامي لطلب العينة" });
  }
}

function statusTargetDepartment(status: string) {
  if (["PENDING_SALES_APPROVAL", "PENDING_SALES_RESOLUTION"].includes(status)) return "sales_management";
  if (status === "PENDING_WAREHOUSE_INVOICE") return "warehouse";
  if (["PENDING_PRODUCTION_APPROVAL", "IN_PRODUCTION"].includes(status)) return "production";
  if (["RETURNED_TO_REPRESENTATIVE", "READY_FOR_REPRESENTATIVE"].includes(status)) return "sales_representative";
  return "closed";
}

async function insertEvent(db: any, transaction: any, actor: any, toStatus: string, action: string, notes = "", attachments: any[] = []) {
  const previousRows = await db.select().from(representativeWorkflowEvents).where(eq(representativeWorkflowEvents.transactionId, transaction.id)).orderBy(desc(representativeWorkflowEvents.createdAt)).limit(1);
  const previousAt = previousRows[0]?.createdAt || null;
  const durationMinutes = previousAt ? Math.max(0, Math.floor((Date.now() - new Date(previousAt).getTime()) / 60000)) : 0;
  await db.insert(representativeWorkflowEvents).values({
    transactionId: transaction.id,
    fromStatus: transaction.status,
    toStatus,
    action,
    actorId: Number(actor.id),
    actorName: String(actor.name || actor.username),
    actorDepartment: String(actor.department || ""),
    notes,
    attachments,
    previousEventAt: previousAt || undefined,
    durationMinutes,
  });
}

async function writeAudit(db: any, actor: any, action: string, tableName: string, recordId: number, oldValue: unknown, newValue: unknown, description: string) {
  await db.insert(auditLog).values({ userId: Number(actor.id), action, tableName, recordId, oldValue, newValue, description });
}

async function notifyNext(db: any, actor: any, transaction: any, status: string, notes = "") {
  const target = statusTargetDepartment(status);
  const common = {
    subject: `إجراء مطلوب للمعاملة ${transaction.referenceCode}`,
    body: `انتقلت المعاملة ${transaction.referenceCode} إلى ${status}${notes ? ` — ${notes}` : ""}`,
    senderId: Number(actor.id),
    relatedType: "representative_transaction",
    relatedId: Number(transaction.id),
    attachments: [],
  };
  if (target === "sales_representative") {
    await db.insert(internalMessages).values({ ...common, recipientUserId: Number(transaction.representativeId) });
    return;
  }
  if (target === "closed") return;
  const aliases = target === "warehouse" ? WAREHOUSE_NAMES : target === "production" ? PRODUCTION_NAMES : SALES_NAMES;
  const activeUsers = await db.select().from(users).where(eq(users.isActive, 1));
  const recipients = activeUsers.filter((candidate: any) => matchesDepartment(candidate.department, aliases));
  if (recipients.length) await db.insert(internalMessages).values(recipients.map((candidate: any) => ({ ...common, recipientUserId: candidate.id })));
}

async function getDetail(db: any, id: number) {
  const rows = await db.select().from(representativeTransactions).where(and(eq(representativeTransactions.id, id), isNull(representativeTransactions.deletedAt))).limit(1);
  const transaction = rows[0];
  if (!transaction) return null;
  const [customerRows, items, declarations, events, attachments] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, transaction.customerId)).limit(1),
    db.select().from(representativeTransactionItems).where(eq(representativeTransactionItems.transactionId, id)).orderBy(representativeTransactionItems.id),
    db.select().from(representativeDeclarations).where(eq(representativeDeclarations.transactionId, id)).orderBy(representativeDeclarations.signedAt),
    db.select().from(representativeWorkflowEvents).where(eq(representativeWorkflowEvents.transactionId, id)).orderBy(representativeWorkflowEvents.createdAt),
    db.select().from(representativeAttachments).where(and(eq(representativeAttachments.transactionId, id), eq(representativeAttachments.isActive, 1))).orderBy(representativeAttachments.createdAt),
  ]);
  return { ...transaction, customer: customerRows[0] || null, items, declarations, events, uploadedAttachments: attachments };
}

function canViewTransaction(user: any, transaction: any) {
  if (isAdmin(user) || isSalesManager(user)) return true;
  if (Number(transaction.representativeId) === Number(user.id)) return true;
  if (isWarehouseManager(user)) return ["PENDING_WAREHOUSE_INVOICE", "RETURNED_TO_REPRESENTATIVE", "CLOSED"].includes(transaction.status);
  if (isProductionManager(user)) return ["custom", "sample"].includes(transaction.transactionType);
  return false;
}

const transitionSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["sales_approve", "sales_reject", "warehouse_invoice", "representative_close", "production_approve", "production_reject", "sales_resubmit", "sales_accept_rejection", "production_ready", "representative_receive"]),
  notes: z.string().optional().default(""),
  attachments: z.array(attachmentSchema).optional().default([]),
  invoiceNumber: z.string().optional(),
  correctiveAction: z.object({ action: z.string().min(3), evidence: z.array(attachmentSchema).default([]) }).optional(),
});

export const representativeRouter = router({
  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional().default("") }).optional()).query(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user) && !isSalesManager(ctx.user) && !isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const search = input?.search?.trim() || "";
      const rows = search
        ? await db.select().from(customers).where(and(eq(customers.isActive, 1), like(customers.name, `%${search}%`))).orderBy(customers.name)
        : await db.select().from(customers).where(eq(customers.isActive, 1)).orderBy(customers.name);
      return rows;
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user) && !isSalesManager(ctx.user) && !isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(customers).where(and(eq(customers.id, input.id), eq(customers.isActive, 1))).limit(1);
      return rows[0] || null;
    }),

    create: protectedProcedure.input(customerSchema).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء العميل من صلاحية المندوب أو الأدمن" });
      validateCustomerAttachments(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const duplicate = await db.select({ id: customers.id }).from(customers).where(eq(customers.commercialRegister, input.commercialRegister)).limit(1);
      if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "السجل التجاري مسجل لعميل سابق" });
      const customerCode = makeReference("CUS");
      const result = await db.insert(customers).values({ ...input, customerCode, isTaxRegistered: input.isTaxRegistered ? 1 : 0, createdBy: Number(ctx.user.id), updatedBy: Number(ctx.user.id) });
      const id = Number(result[0].insertId);
      await db.insert(representativeAttachments).values(input.attachments.map((attachment) => ({ customerId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, uploadedBy: Number(ctx.user.id) })));
      await writeAudit(db, ctx.user, "create", "customers", id, null, input, `إنشاء ملف العميل ${customerCode}`);
      return { success: true, id, customerCode };
    }),

    update: protectedProcedure.input(customerSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user) && !isSalesManager(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      validateCustomerAttachments(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const currentRows = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
      const current = currentRows[0];
      if (!current) throw new Error("العميل غير موجود");
      const duplicateRows = await db.select({ id: customers.id }).from(customers).where(eq(customers.commercialRegister, input.commercialRegister));
      if (duplicateRows.some((row) => Number(row.id) !== Number(input.id))) throw new TRPCError({ code: "CONFLICT", message: "السجل التجاري مرتبط بعميل آخر" });
      const { id, attachments, ...values } = input;
      await db.update(customers).set({ ...values, isTaxRegistered: values.isTaxRegistered ? 1 : 0, version: Number(current.version || 1) + 1, updatedBy: Number(ctx.user.id) }).where(eq(customers.id, id));
      await db.update(representativeAttachments).set({ isActive: 0 }).where(eq(representativeAttachments.customerId, id));
      await db.insert(representativeAttachments).values(attachments.map((attachment) => ({ customerId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, version: Number(current.version || 1) + 1, uploadedBy: Number(ctx.user.id) })));
      await writeAudit(db, ctx.user, "update", "customers", id, current, input, `تحديث ملف العميل ${current.customerCode}`);
      return { success: true, version: Number(current.version || 1) + 1 };
    }),
  }),

  transactions: router({
    list: protectedProcedure.input(z.object({ startDate: z.string().optional(), endDate: z.string().optional(), transactionType: z.string().optional(), status: z.string().optional(), customerId: z.number().optional(), representativeId: z.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [isNull(representativeTransactions.deletedAt)];
      if (input?.startDate) conditions.push(gte(representativeTransactions.orderDate, input.startDate));
      if (input?.endDate) conditions.push(lte(representativeTransactions.orderDate, input.endDate));
      if (input?.transactionType) conditions.push(eq(representativeTransactions.transactionType, input.transactionType as any));
      if (input?.status) conditions.push(eq(representativeTransactions.status, input.status));
      if (input?.customerId) conditions.push(eq(representativeTransactions.customerId, input.customerId));
      if (input?.representativeId) conditions.push(eq(representativeTransactions.representativeId, input.representativeId));
      const rows = await db.select().from(representativeTransactions).where(and(...conditions)).orderBy(desc(representativeTransactions.createdAt));
      const filtered = rows.filter((row) => canViewTransaction(ctx.user, row));
      const now = Date.now();
      return filtered.map((row) => ({ ...row, isOverdue: !["CLOSED", "CLOSED_REJECTED", "REJECTED_SALES"].includes(row.status) && now - new Date(row.updatedAt).getTime() > 3 * 24 * 60 * 60 * 1000 }));
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const detail = await getDetail(db, input.id);
      if (!detail || !canViewTransaction(ctx.user, detail)) throw new TRPCError({ code: "NOT_FOUND", message: "المعاملة غير موجودة أو غير مصرح بها" });
      return detail;
    }),

    createDraft: protectedProcedure.input(transactionSchema).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء المعاملة من صلاحية المندوب" });
      validateTransaction(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const customerRows = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.isActive, 1))).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      validateStoredCustomer(customer);
      const referenceCode = makeReference(input.transactionType === "sample" ? "SMP" : input.transactionType === "custom" ? "CUSM" : input.transactionType === "visit" ? "VIS" : input.transactionType === "return" ? "RET" : "ORD");
      const { items, ...header } = input;
      const result = await db.insert(representativeTransactions).values({ ...header, referenceCode, representativeId: Number(ctx.user.id), representativeName: String(ctx.user.name), customerName: customer.name, customerVersion: customer.version, status: "DRAFT", currentDepartment: "sales_representative", productData: items, yarnRatios: items.map((item) => item.yarnRatios || {}), attachments: input.attachments });
      const id = Number(result[0].insertId);
      await db.insert(representativeTransactionItems).values(items.map((item) => ({ ...item, transactionId: id })));
      if (input.attachments.length) await db.insert(representativeAttachments).values(input.attachments.map((attachment) => ({ transactionId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, uploadedBy: Number(ctx.user.id) })));
      const transaction = { id, referenceCode, status: "DRAFT", representativeId: Number(ctx.user.id) };
      await insertEvent(db, transaction, ctx.user, "DRAFT", "create_draft", "إنشاء مسودة المعاملة");
      await writeAudit(db, ctx.user, "create", "representativeTransactions", id, null, input, `إنشاء مسودة ${referenceCode}`);
      return { success: true, id, referenceCode };
    }),

    updateDraft: protectedProcedure.input(transactionSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      validateTransaction(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const rows = await db.select().from(representativeTransactions).where(eq(representativeTransactions.id, input.id)).limit(1);
      const current = rows[0];
      if (!current || current.status !== "DRAFT") throw new Error("يمكن تعديل المسودة فقط");
      if (!isAdmin(ctx.user) && Number(current.representativeId) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      validateStoredCustomer(customer);
      const { id, items, ...header } = input;
      await db.update(representativeTransactions).set({ ...header, customerName: customer.name, customerVersion: customer.version, productData: items, yarnRatios: items.map((item) => item.yarnRatios || {}), attachments: input.attachments }).where(eq(representativeTransactions.id, id));
      await db.delete(representativeTransactionItems).where(eq(representativeTransactionItems.transactionId, id));
      await db.insert(representativeTransactionItems).values(items.map((item) => ({ ...item, transactionId: id })));
      await db.delete(representativeAttachments).where(eq(representativeAttachments.transactionId, id));
      if (input.attachments.length) await db.insert(representativeAttachments).values(input.attachments.map((attachment) => ({ transactionId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, uploadedBy: Number(ctx.user.id) })));
      await insertEvent(db, current, ctx.user, "DRAFT", "update_draft", "تحديث بيانات المسودة ومرفقاتها");
      await writeAudit(db, ctx.user, "update", "representativeTransactions", id, current, input, `تحديث مسودة ${current.referenceCode}`);
      return { success: true };
    }),

    sign: protectedProcedure.input(z.object({ id: z.number(), declarationType: z.enum(["customer_order", "representative_order", "representative_receipt", "representative_sample_receipt"]), declarationText: z.string().min(5), declarerName: z.string().min(2), declarerRole: z.string().min(2), signatureData: z.string().min(20) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const detail = await getDetail(db, input.id);
      if (!detail || !canViewTransaction(ctx.user, detail)) throw new TRPCError({ code: "FORBIDDEN" });
      if (!isAdmin(ctx.user) && Number(detail.representativeId) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "التوقيع يسجل من حساب المندوب صاحب المعاملة" });
      const signedSnapshot = { referenceCode: detail.referenceCode, customer: detail.customer, items: detail.items, paymentMethod: detail.paymentMethod, paymentAmount: detail.paymentAmount, deliveryDate: detail.deliveryDate, transactionType: detail.transactionType, customerVersion: detail.customerVersion };
      const result = await db.insert(representativeDeclarations).values({ transactionId: input.id, declarationType: input.declarationType, declarationText: input.declarationText, declarerName: input.declarerName, declarerRole: input.declarerRole, signerUserId: Number(ctx.user.id), signatureData: input.signatureData, signatureAttachmentUrl: input.signatureData, signedSnapshot });
      await db.insert(representativeAttachments).values({ transactionId: input.id, attachmentType: `signature_${input.declarationType}`, fileName: `signature-${input.declarationType}-${Date.now()}.svg`, fileUrl: input.signatureData, mimeType: "image/svg+xml", uploadedBy: Number(ctx.user.id) });
      await insertEvent(db, detail, ctx.user, detail.status, `sign_${input.declarationType}`, input.declarationText);
      return { success: true, id: Number(result[0].insertId) };
    }),

    submit: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const detail = await getDetail(db, input.id);
      if (!detail || detail.status !== "DRAFT") throw new Error("المسودة غير موجودة");
      if (!isAdmin(ctx.user) && Number(detail.representativeId) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const declarationTypes = new Set(detail.declarations.map((row: any) => row.declarationType));
      if (!declarationTypes.has("customer_order") || !declarationTypes.has("representative_order")) throw new TRPCError({ code: "BAD_REQUEST", message: "توقيع العميل والمندوب إلزاميان قبل الإرسال" });
      const now = new Date();
      await db.update(representativeTransactions).set({ status: "PENDING_SALES_APPROVAL", currentDepartment: "sales_management", submittedAt: now, signedSnapshot: { customer: detail.customer, items: detail.items, declarations: detail.declarations } }).where(eq(representativeTransactions.id, input.id));
      await insertEvent(db, detail, ctx.user, "PENDING_SALES_APPROVAL", "submit", "إرسال المعاملة إلى مدير التسويق والمبيعات");
      await notifyNext(db, ctx.user, detail, "PENDING_SALES_APPROVAL");
      return { success: true };
    }),

    transition: protectedProcedure.input(transitionSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const detail = await getDetail(db, input.id);
      if (!detail) throw new Error("المعاملة غير موجودة");
      let nextStatus = "";
      const patch: Record<string, unknown> = {};
      switch (input.action) {
        case "sales_approve":
          if (!isSalesManager(ctx.user) || detail.status !== "PENDING_SALES_APPROVAL") throw new TRPCError({ code: "FORBIDDEN", message: "هذه الخطوة لمدير التسويق والمبيعات" });
          nextStatus = ["custom", "sample"].includes(detail.transactionType) ? "PENDING_PRODUCTION_APPROVAL" : detail.transactionType === "order" ? "PENDING_WAREHOUSE_INVOICE" : "CLOSED";
          if (["visit", "return"].includes(detail.transactionType)) patch.closedAt = new Date();
          break;
        case "sales_reject":
          if (!isSalesManager(ctx.user) || detail.status !== "PENDING_SALES_APPROVAL" || !input.notes.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "سبب الرفض إلزامي" });
          nextStatus = "REJECTED_SALES"; patch.rejectionReason = input.notes;
          break;
        case "warehouse_invoice":
          if (!isWarehouseManager(ctx.user) || detail.status !== "PENDING_WAREHOUSE_INVOICE" || !input.invoiceNumber || !input.attachments.length) throw new TRPCError({ code: "BAD_REQUEST", message: "رقم الفاتورة ومرفق الفاتورة إلزاميان" });
          nextStatus = "RETURNED_TO_REPRESENTATIVE"; patch.invoiceNumber = input.invoiceNumber; patch.invoiceAttachments = input.attachments;
          break;
        case "representative_close":
          if (Number(detail.representativeId) !== Number(ctx.user.id) || detail.status !== "RETURNED_TO_REPRESENTATIVE") throw new TRPCError({ code: "FORBIDDEN" });
          if (!detail.declarations.some((row: any) => row.declarationType === "representative_receipt")) throw new TRPCError({ code: "BAD_REQUEST", message: "أقر باستلام الفاتورة ووقّع قبل إغلاق الطلب" });
          nextStatus = "CLOSED"; patch.closedAt = new Date();
          break;
        case "production_approve":
          if (!isProductionManager(ctx.user) || detail.status !== "PENDING_PRODUCTION_APPROVAL") throw new TRPCError({ code: "FORBIDDEN" });
          nextStatus = "IN_PRODUCTION";
          break;
        case "production_reject":
          if (!isProductionManager(ctx.user) || detail.status !== "PENDING_PRODUCTION_APPROVAL" || !input.notes.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "سبب رفض الإنتاج إلزامي" });
          nextStatus = "PENDING_SALES_RESOLUTION"; patch.rejectionReason = input.notes;
          break;
        case "sales_resubmit":
          if (!isSalesManager(ctx.user) || detail.status !== "PENDING_SALES_RESOLUTION" || !input.correctiveAction) throw new TRPCError({ code: "BAD_REQUEST", message: "الإجراء التصحيحي والإثبات إلزاميان" });
          nextStatus = "PENDING_PRODUCTION_APPROVAL"; patch.correctiveAction = input.correctiveAction; patch.rejectionReason = null;
          break;
        case "sales_accept_rejection":
          if (!isSalesManager(ctx.user) || detail.status !== "PENDING_SALES_RESOLUTION") throw new TRPCError({ code: "FORBIDDEN" });
          nextStatus = "CLOSED_REJECTED"; patch.closedAt = new Date();
          break;
        case "production_ready":
          if (!isProductionManager(ctx.user) || detail.status !== "IN_PRODUCTION") throw new TRPCError({ code: "FORBIDDEN" });
          nextStatus = "READY_FOR_REPRESENTATIVE";
          break;
        case "representative_receive":
          if (Number(detail.representativeId) !== Number(ctx.user.id) || detail.status !== "READY_FOR_REPRESENTATIVE") throw new TRPCError({ code: "FORBIDDEN" });
          if (!detail.declarations.some((row: any) => row.declarationType === "representative_sample_receipt")) throw new TRPCError({ code: "BAD_REQUEST", message: "إقرار استلام العينة والتوقيع إلزاميان" });
          nextStatus = "CLOSED"; patch.closedAt = new Date();
          break;
      }
      if (!nextStatus) throw new Error("إجراء غير صالح");
      await db.update(representativeTransactions).set({ ...patch, status: nextStatus, currentDepartment: statusTargetDepartment(nextStatus) }).where(eq(representativeTransactions.id, input.id));
      await insertEvent(db, detail, ctx.user, nextStatus, input.action, input.notes, input.attachments);
      if (input.attachments.length) await db.insert(representativeAttachments).values(input.attachments.map((attachment) => ({ transactionId: input.id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, uploadedBy: Number(ctx.user.id) })));
      await writeAudit(db, ctx.user, "transition", "representativeTransactions", input.id, detail, { nextStatus, ...patch }, `${input.action}: ${detail.referenceCode}`);
      await notifyNext(db, ctx.user, detail, nextStatus, input.notes);
      return { success: true, status: nextStatus };
    }),

    softDelete: protectedProcedure.input(z.object({ id: z.number(), reason: z.string().min(3) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const rows = await db.select().from(representativeTransactions).where(eq(representativeTransactions.id, input.id)).limit(1);
      if (!rows[0]) throw new Error("المعاملة غير موجودة");
      const current = rows[0];
      const isOwnDraft = current.status === "DRAFT" && Number(current.representativeId) === Number(ctx.user.id);
      if (!isAdmin(ctx.user) && !isOwnDraft) throw new TRPCError({ code: "FORBIDDEN", message: "يمكن للمندوب حذف مسودته فقط، والحذف بعد الإرسال من صلاحية الأدمن" });
      await db.update(representativeTransactions).set({ deletedAt: new Date() }).where(eq(representativeTransactions.id, input.id));
      await insertEvent(db, current, ctx.user, current.status, "soft_delete", input.reason);
      await writeAudit(db, ctx.user, "soft_delete", "representativeTransactions", input.id, current, { deletedAt: new Date().toISOString(), reason: input.reason }, input.reason);
      return { success: true };
    }),
  }),

  collections: router({
    list: protectedProcedure.input(z.object({ startDate: z.string().optional(), endDate: z.string().optional(), representativeId: z.number().optional(), customerId: z.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.startDate) conditions.push(gte(representativeCollections.collectionDate, input.startDate));
      if (input?.endDate) conditions.push(lte(representativeCollections.collectionDate, input.endDate));
      if (input?.representativeId) conditions.push(eq(representativeCollections.representativeId, input.representativeId));
      if (input?.customerId) conditions.push(eq(representativeCollections.customerId, input.customerId));
      if (!isAdmin(ctx.user) && !isSalesManager(ctx.user)) conditions.push(eq(representativeCollections.representativeId, Number(ctx.user.id)));
      return db.select().from(representativeCollections).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(representativeCollections.createdAt));
    }),
    create: protectedProcedure.input(z.object({ customerId: z.number(), transactionId: z.number().int().positive(), collectedAmount: z.number().positive(), collectionMethod: z.enum(["cash", "transfer"]), receiptNumber: z.string().optional().default(""), collectionDate: z.string().min(10), notes: z.string().optional().default(""), attachments: z.array(attachmentSchema).default([]) })).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.collectionMethod === "transfer" && !input.attachments.some((item) => item.type === "transfer_receipt")) throw new TRPCError({ code: "BAD_REQUEST", message: "إيصال التحويل إلزامي" });
      if (input.collectionMethod === "cash" && !input.receiptNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "رقم سند القبض إلزامي" });
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      const transactionRows = await db.select().from(representativeTransactions).where(and(eq(representativeTransactions.id, input.transactionId), isNull(representativeTransactions.deletedAt))).limit(1);
      const transaction = transactionRows[0];
      if (!transaction || Number(transaction.customerId) !== Number(input.customerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "الفاتورة لا تتبع العميل المحدد" });
      if (!transaction.invoiceNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تسجيل تحصيل قبل إصدار الفاتورة من المستودع" });
      const previousCollections = await db.select().from(representativeCollections).where(eq(representativeCollections.transactionId, input.transactionId));
      const invoiceAmount = Number(transaction.paymentAmount || 0);
      const collectedBefore = previousCollections.reduce((sum, row) => sum + Number(row.collectedAmount || 0), 0);
      const available = Math.max(0, invoiceAmount - collectedBefore);
      if (input.collectedAmount > available) throw new TRPCError({ code: "BAD_REQUEST", message: `المبلغ المحصل يتجاوز المتبقي على الفاتورة (${available.toFixed(2)} ريال)` });
      const referenceCode = makeReference("COL");
      const remainingAmount = Math.max(0, available - input.collectedAmount);
      const result = await db.insert(representativeCollections).values({ ...input, referenceCode, invoiceNumber: transaction.invoiceNumber, invoiceAmount, remainingAmount, customerName: customer.name, representativeId: Number(ctx.user.id), representativeName: String(ctx.user.name), attachments: input.attachments });
      const id = Number(result[0].insertId);
      await writeAudit(db, ctx.user, "create", "representativeCollections", id, null, input, `تسجيل تحصيل ${referenceCode}`);
      return { success: true, id, referenceCode, remainingAmount };
    }),
  }),

  performance: router({
    summary: protectedProcedure.input(z.object({ startDate: z.string().optional(), endDate: z.string().optional(), representativeId: z.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { representatives: [], weights: [] };
      const weights = await db.select().from(representativePerformanceWeights).where(eq(representativePerformanceWeights.isActive, 1));
      const effectiveWeights = weights.length ? weights : [
        { criterionKey: "sales_amount", criterionName: "قيمة الطلبات", weight: 35, targetValue: 100000 },
        { criterionKey: "collection_amount", criterionName: "التحصيل", weight: 30, targetValue: 80000 },
        { criterionKey: "closed_orders", criterionName: "إغلاق الطلبات", weight: 20, targetValue: 20 },
        { criterionKey: "speed", criterionName: "سرعة الإنجاز", weight: 15, targetValue: 1440 },
      ];
      const txConditions: any[] = [isNull(representativeTransactions.deletedAt)];
      if (input?.startDate) txConditions.push(gte(representativeTransactions.orderDate, input.startDate));
      if (input?.endDate) txConditions.push(lte(representativeTransactions.orderDate, input.endDate));
      const allTransactions = await db.select().from(representativeTransactions).where(and(...txConditions));
      const collectionConditions: any[] = [];
      if (input?.startDate) collectionConditions.push(gte(representativeCollections.collectionDate, input.startDate));
      if (input?.endDate) collectionConditions.push(lte(representativeCollections.collectionDate, input.endDate));
      const allCollections = await db.select().from(representativeCollections).where(collectionConditions.length ? and(...collectionConditions) : undefined);
      const activeUsers = await db.select().from(users).where(eq(users.isActive, 1));
      const reps = activeUsers.filter((candidate) => matchesDepartment(candidate.department, SALES_NAMES) && (!input?.representativeId || Number(candidate.id) === input.representativeId));
      const visibleReps = isAdmin(ctx.user) || isSalesManager(ctx.user) ? reps : reps.filter((candidate) => Number(candidate.id) === Number(ctx.user.id));
      const representatives = visibleReps.map((rep) => {
        const tx = allTransactions.filter((row) => Number(row.representativeId) === Number(rep.id));
        const col = allCollections.filter((row) => Number(row.representativeId) === Number(rep.id));
        const salesAmount = tx.filter((row) => row.transactionType === "order").reduce((sum, row) => sum + Number(row.paymentAmount || 0), 0);
        const collectionAmount = col.reduce((sum, row) => sum + Number(row.collectedAmount || 0), 0);
        const closedOrders = tx.filter((row) => row.status === "CLOSED").length;
        const avgDuration = tx.length ? tx.reduce((sum, row) => sum + Math.max(0, (new Date(row.closedAt || row.updatedAt).getTime() - new Date(row.createdAt).getTime()) / 60000), 0) / tx.length : 0;
        const actual: Record<string, number> = { sales_amount: salesAmount, collection_amount: collectionAmount, closed_orders: closedOrders, speed: avgDuration };
        const criteria = effectiveWeights.map((criterion: any) => {
          const target = Number(criterion.targetValue || 0);
          const value = actual[criterion.criterionKey] || 0;
          const achievement = criterion.criterionKey === "speed" ? (value > 0 && target > 0 ? Math.min(100, (target / value) * 100) : 0) : target > 0 ? Math.min(100, (value / target) * 100) : 0;
          return { key: criterion.criterionKey, name: criterion.criterionName, weight: Number(criterion.weight), target, actual: value, achievement };
        });
        const score = criteria.reduce((sum: number, criterion: any) => sum + criterion.achievement * (criterion.weight / 100), 0);
        return { representative: { id: rep.id, name: rep.name, username: rep.username, phone: rep.phone, email: rep.email }, totals: { transactions: tx.length, orders: tx.filter((row) => row.transactionType === "order").length, visits: tx.filter((row) => row.transactionType === "visit").length, custom: tx.filter((row) => row.transactionType === "custom").length, samples: tx.filter((row) => row.transactionType === "sample").length, collections: col.length, salesAmount, collectionAmount, closedOrders, avgDurationMinutes: Math.round(avgDuration) }, criteria, score: Number(score.toFixed(2)) };
      });
      return { representatives, weights: effectiveWeights };
    }),
    updateWeights: protectedProcedure.input(z.array(z.object({ criterionKey: z.string(), criterionName: z.string(), weight: z.number().min(0).max(100), targetValue: z.number().min(0) }))).mutation(async ({ input, ctx }) => {
      if (!isSalesManager(ctx.user) && !isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const total = input.reduce((sum, item) => sum + item.weight, 0);
      if (total !== 100) throw new TRPCError({ code: "BAD_REQUEST", message: "مجموع أوزان التقييم يجب أن يساوي 100%" });
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      for (const item of input) {
        await db.execute(sql`INSERT INTO representativePerformanceWeights (criterionKey, criterionName, weight, targetValue, isActive, updatedBy) VALUES (${item.criterionKey}, ${item.criterionName}, ${item.weight}, ${item.targetValue}, 1, ${Number(ctx.user.id)}) ON DUPLICATE KEY UPDATE criterionName = VALUES(criterionName), weight = VALUES(weight), targetValue = VALUES(targetValue), isActive = 1, updatedBy = VALUES(updatedBy)`);
      }
      return { success: true };
    }),
  }),

  approvals: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(representativeTransactions).where(isNull(representativeTransactions.deletedAt)).orderBy(desc(representativeTransactions.updatedAt));
    if (isAdmin(ctx.user)) return rows;
    if (isSalesManager(ctx.user)) return rows.filter((row) => ["PENDING_SALES_APPROVAL", "PENDING_SALES_RESOLUTION"].includes(row.status));
    if (isWarehouseManager(ctx.user)) return rows.filter((row) => row.status === "PENDING_WAREHOUSE_INVOICE");
    if (isProductionManager(ctx.user)) return rows.filter((row) => ["PENDING_PRODUCTION_APPROVAL", "IN_PRODUCTION"].includes(row.status));
    return rows.filter((row) => Number(row.representativeId) === Number(ctx.user.id) && ["RETURNED_TO_REPRESENTATIVE", "READY_FOR_REPRESENTATIVE"].includes(row.status));
  }),

  scanOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isSalesManager(ctx.user) && !isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const rows = await db.select().from(representativeTransactions).where(and(isNull(representativeTransactions.deletedAt), lte(representativeTransactions.updatedAt, cutoff)));
    const overdue = rows.filter((row) => !["CLOSED", "CLOSED_REJECTED", "REJECTED_SALES"].includes(row.status));
    for (const row of overdue) {
      const existing = await db.select({ id: internalMessages.id }).from(internalMessages).where(and(eq(internalMessages.relatedType, "representative_overdue"), eq(internalMessages.relatedId, row.id))).limit(1);
      if (!existing[0]) await db.insert(internalMessages).values({ subject: `تنبيه تأخير ${row.referenceCode}`, body: `المعاملة ${row.referenceCode} متأخرة أكثر من ثلاثة أيام وحالتها ${row.status}`, senderId: Number(ctx.user.id), recipientUserId: Number(row.representativeId), relatedType: "representative_overdue", relatedId: row.id, attachments: [] });
    }
    return { success: true, overdueCount: overdue.length };
  }),
});
