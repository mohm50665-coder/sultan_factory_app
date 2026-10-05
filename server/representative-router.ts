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
  finishedWarehouseStock,
  finishedWarehouseMovements,
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
const isRepresentativeEmployee = (user: any) => {
  const role = normalize(user?.role);
  const position = normalize(user?.position);
  if (["admin", "manager", "supervisor"].includes(role)) return false;
  if (position.includes("مدير") || position.includes("مشرف") || position.includes("manager") || position.includes("supervisor")) return false;
  return position.includes("مندوب") || position.includes("representative") || position.includes("sales rep")
    || (role === "user" && matchesDepartment(user?.department, SALES_NAMES));
};
const isRepresentative = (user: any) => isAdmin(user) || isRepresentativeEmployee(user);

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
  customerType: z.enum(["institution", "individual"]).default("institution"),
  name: z.string().min(2),
  assignedRepresentativeId: z.number().int().positive().nullable().optional(),
  assignedRepresentativeName: z.string().optional().default(""),
  sourceSellerName: z.string().optional().default(""),
  sourceAccountCode: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  buildingNumber: z.string().optional().default(""),
  commercialRegister: z.string().optional().default(""),
  taxNumber: z.string().optional().default(""),
  isTaxRegistered: z.boolean().default(false),
  municipalLicense: z.string().optional().default(""),
  nationalAddress: z.string().optional().default(""),
  city: z.string().optional().default(""),
  district: z.string().optional().default(""),
  street: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  ownerName: z.string().optional().default(""),
  ownerPhone: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  contactPhone: z.string().optional().default(""),
  contactEmail: z.string().email().optional().or(z.literal("")),
  attachments: z.array(attachmentSchema),
});

const itemSchema = z.object({
  productName: z.string().min(1),
  barcode: z.string().optional().default(""),
  size: z.string().min(1),
  color: z.string().min(1),
  quantity: z.number().int().positive(),
  quantityUnit: z.enum(["dozen", "pair"]),
  quantityDozen: z.number().int().nonnegative().optional().default(0),
  quantityPair: z.number().int().nonnegative().max(11).optional().default(0),
  productType: z.string().optional(),
  yarnRatios: z.record(z.string(), z.number()).optional(),
});

function itemQuantityDozen(item: any): number {
  const dozen = Number(item.quantityDozen || 0);
  const pairs = Number(item.quantityPair || 0);
  if (dozen > 0 || pairs > 0) return dozen + pairs / 12;
  return item.quantityUnit === "pair" ? Number(item.quantity || 0) / 12 : Number(item.quantity || 0);
}

const transactionSchema = z.object({
  transactionType: z.enum(["order", "visit", "return", "custom", "sample"]),
  customerId: z.number().int().positive(),
  customerStatus: z.enum(["new", "old"]).default("old"),
  orderDate: z.string().min(10),
  deliveryDate: z.string().optional().default(""),
  visitReport: z.string().optional().default(""),
  returnReason: z.string().optional().default(""),
  items: z.array(itemSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
});

function validateCustomerAttachments(input: z.infer<typeof customerSchema>) {
  if (input.customerType === "individual") return;
  const types = new Set(input.attachments.map((attachment) => attachment.type));
  const missing = CUSTOMER_REQUIRED_ATTACHMENTS.filter((type) => !types.has(type));
  if (input.isTaxRegistered && !types.has("tax_certificate")) missing.push("tax_certificate");
  if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `مرفقات العميل الإلزامية ناقصة: ${missing.join(", ")}` });
}

function validateStoredCustomer(customer: any) {
  if (customer.customerType === "individual") {
    if (!String(customer.name || "").trim() || !String(customer.contactPhone || customer.ownerPhone || "").trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات الفرد المطلوبة هي الاسم ورقم الجوال" });
    }
    return;
  }
  const requiredText = [customer.name, customer.commercialRegister, customer.nationalAddress, customer.city, customer.district, customer.street, customer.ownerName, customer.ownerPhone, customer.contactName, customer.contactPhone];
  if (requiredText.some((value) => !String(value || "").trim() || String(value).includes("غير متوفر"))) throw new TRPCError({ code: "BAD_REQUEST", message: "ملف العميل غير مكتمل؛ أكمل بيانات المنشأة والمالك والمسؤول قبل إنشاء الطلب" });
  if (customer.isTaxRegistered && !String(customer.taxNumber || "").trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "الرقم الضريبي إلزامي للعميل المسجل ضريبياً" });
  const types = new Set(parseArray(customer.attachments).map((attachment) => attachment?.type));
  const missing = CUSTOMER_REQUIRED_ATTACHMENTS.filter((type) => !types.has(type));
  if (customer.isTaxRegistered && !types.has("tax_certificate")) missing.push("tax_certificate");
  if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `استكمل مرفقات ملف العميل قبل إنشاء الطلب: ${missing.join(", ")}` });
}

function getMissingCustomerFields(customer: any): string[] {
  if (customer.customerType === "individual") {
    return [
      !String(customer.name || "").trim() ? "الاسم" : "",
      !String(customer.contactPhone || customer.ownerPhone || "").trim() ? "رقم الجوال" : "",
    ].filter(Boolean);
  }
  const missing = [
    !String(customer.name || "").trim() ? "اسم المؤسسة" : "",
    !String(customer.commercialRegister || "").trim() ? "السجل التجاري" : "",
    !String(customer.nationalAddress || "").trim() ? "العنوان الوطني" : "",
    !String(customer.city || "").trim() ? "المدينة" : "",
    !String(customer.district || "").trim() ? "الحي" : "",
    !String(customer.street || "").trim() ? "الشارع" : "",
    !String(customer.ownerName || "").trim() ? "اسم المالك" : "",
    !String(customer.ownerPhone || "").trim() ? "جوال المالك" : "",
    !String(customer.contactName || "").trim() ? "اسم المسؤول" : "",
    !String(customer.contactPhone || "").trim() ? "جوال المسؤول" : "",
  ].filter(Boolean) as string[];
  const types = new Set(parseArray(customer.attachments).map((attachment) => attachment?.type));
  if (!types.has("commercial_register")) missing.push("مرفق السجل التجاري");
  if (!types.has("national_address")) missing.push("مرفق العنوان الوطني");
  if (customer.isTaxRegistered && !String(customer.taxNumber || "").trim()) missing.push("الرقم الضريبي");
  if (customer.isTaxRegistered && !types.has("tax_certificate")) missing.push("مرفق الشهادة الضريبية");
  return missing;
}

function canAccessCustomer(user: any, customer: any) {
  if (isAdmin(user) || isSalesManager(user)) return true;
  if (!isRepresentativeEmployee(user)) return false;
  const assignedIdMatches = Number(customer?.assignedRepresentativeId) === Number(user.id);
  const assignedNameMatches = normalize(customer?.assignedRepresentativeName) !== ""
    && normalize(customer?.assignedRepresentativeName) === normalize(user?.name);
  return assignedIdMatches || assignedNameMatches;
}

async function validateWarehouseStockForOrder(db: any, input: z.infer<typeof transactionSchema>) {
  if (input.transactionType !== "order") return;
  const requestedByBarcode = new Map<string, number>();
  for (const item of input.items) {
    const barcode = String(item.barcode || "").trim().toUpperCase();
    if (barcode.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: `اختر نسخة المستودع للمنتج ${item.productName}` });
    const requestedDozen = itemQuantityDozen(item);
    requestedByBarcode.set(barcode, (requestedByBarcode.get(barcode) || 0) + requestedDozen);
  }
  for (const [barcode, requestedDozen] of requestedByBarcode) {
    const rows = await db.select().from(finishedWarehouseStock).where(and(eq(finishedWarehouseStock.barcode, barcode), eq(finishedWarehouseStock.isActive, 1))).limit(1);
    const stock = rows[0];
    if (!stock) throw new TRPCError({ code: "BAD_REQUEST", message: `نسخة المنتج بالباركود ${barcode} غير موجودة في المستودع` });
    if (Number(stock.quantityDozen || 0) < requestedDozen) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `الرصيد المتاح للصنف ${stock.productName} هو ${stock.quantityDozen} درزن، والمطلوب ${requestedDozen} درزن` });
    }
  }
}

function validateTransaction(input: z.infer<typeof transactionSchema>) {
  if (input.transactionType !== "visit" && input.items.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "أضف صنفاً واحداً على الأقل لهذه المعاملة" });
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
    if (input.items.some((item) => itemQuantityDozen(item) <= 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل كمية صحيحة بالدرزن أو الزوج" });
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
  if (["PENDING_WAREHOUSE_INVOICE", "PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL"].includes(status)) return "warehouse";
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
  if (isWarehouseManager(user)) return ["PENDING_WAREHOUSE_INVOICE", "PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL", "WAREHOUSE_EXECUTED", "RETURNED_TO_REPRESENTATIVE", "REPRESENTATIVE_CLOSED", "CLOSED"].includes(transaction.status);
  if (isProductionManager(user)) return ["custom", "sample"].includes(transaction.transactionType);
  return false;
}

const transitionSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["sales_approve", "sales_reject", "warehouse_invoice", "warehouse_execute", "warehouse_partial", "representative_respond", "representative_close_order", "representative_close", "production_approve", "production_reject", "sales_resubmit", "sales_accept_rejection", "production_ready", "representative_receive"]),
  notes: z.string().optional().default(""),
  attachments: z.array(attachmentSchema).optional().default([]),
  invoiceNumber: z.string().optional(),
  correctiveAction: z.object({ action: z.string().min(3), evidence: z.array(attachmentSchema).default([]) }).optional(),
});

export const representativeRouter = router({
  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional().default("") }).optional()).query(async ({ input, ctx }) => {
      if (!isAdmin(ctx.user) && !isSalesManager(ctx.user) && !isRepresentativeEmployee(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const search = input?.search?.trim() || "";
      const scope = isAdmin(ctx.user) || isSalesManager(ctx.user)
        ? eq(customers.isActive, 1)
        : and(
            eq(customers.isActive, 1),
            sql`(${customers.assignedRepresentativeId} = ${Number(ctx.user.id)} OR LOWER(TRIM(${customers.assignedRepresentativeName})) = LOWER(TRIM(${String(ctx.user.name || "")})))`,
          );
      const rows = await db.select().from(customers).where(search ? and(scope, like(customers.name, `%${search}%`)) : scope).orderBy(customers.name);
      const [attachmentRows, salesRows, collectionRows] = await Promise.all([
        rows.length ? db.select({ customerId: representativeAttachments.customerId, attachmentType: representativeAttachments.attachmentType }).from(representativeAttachments).where(eq(representativeAttachments.isActive, 1)) : Promise.resolve([]),
        rows.length ? db.select({ customerId: representativeTransactions.customerId, orderDate: representativeTransactions.orderDate, createdAt: representativeTransactions.createdAt }).from(representativeTransactions).where(isNull(representativeTransactions.deletedAt)) : Promise.resolve([]),
        rows.length ? db.select({ customerId: representativeCollections.customerId, collectionDate: representativeCollections.collectionDate, collectedAmount: representativeCollections.collectedAmount, createdAt: representativeCollections.createdAt }).from(representativeCollections) : Promise.resolve([]),
      ]);
      const attachmentTypes = new Map<number, string[]>();
      for (const attachment of attachmentRows) {
        if (!attachment.customerId) continue;
        const current = attachmentTypes.get(Number(attachment.customerId)) || [];
        current.push(String(attachment.attachmentType));
        attachmentTypes.set(Number(attachment.customerId), current);
      }
      const activity = new Map<number, { salesCount: number; collectionCount: number; collectionTotal: number; lastSalesDate: string; lastCollectionDate: string }>();
      for (const sale of salesRows as any[]) {
        const customerId = Number(sale.customerId);
        const current = activity.get(customerId) || { salesCount: 0, collectionCount: 0, collectionTotal: 0, lastSalesDate: "", lastCollectionDate: "" };
        const saleDate = String(sale.orderDate || sale.createdAt || "").slice(0, 10);
        activity.set(customerId, { ...current, salesCount: current.salesCount + 1, lastSalesDate: saleDate > current.lastSalesDate ? saleDate : current.lastSalesDate });
      }
      for (const collection of collectionRows as any[]) {
        const customerId = Number(collection.customerId);
        const current = activity.get(customerId) || { salesCount: 0, collectionCount: 0, collectionTotal: 0, lastSalesDate: "", lastCollectionDate: "" };
        const collectionDate = String(collection.collectionDate || collection.createdAt || "").slice(0, 10);
        activity.set(customerId, { ...current, collectionCount: current.collectionCount + 1, collectionTotal: current.collectionTotal + Number(collection.collectedAmount || 0), lastCollectionDate: collectionDate > current.lastCollectionDate ? collectionDate : current.lastCollectionDate });
      }
      return rows.map((customer) => {
        const missingFields = getMissingCustomerFields({ ...customer, attachments: attachmentTypes.get(Number(customer.id))?.map((type) => ({ type })) || customer.attachments });
        const currentActivity = activity.get(Number(customer.id)) || { salesCount: 0, collectionCount: 0, collectionTotal: 0, lastSalesDate: "", lastCollectionDate: "" };
        const lastActivityDate = [currentActivity.lastSalesDate, currentActivity.lastCollectionDate].filter(Boolean).sort().pop() || "";
        const inactiveDays = lastActivityDate ? Math.max(0, Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / 86400000)) : null;
        return {
          id: customer.id,
          name: customer.name,
          customerCode: customer.customerCode,
          customerType: customer.customerType,
          commercialRegister: customer.commercialRegister,
          taxNumber: customer.taxNumber,
          municipalLicense: customer.municipalLicense,
          nationalAddress: customer.nationalAddress,
          city: customer.city,
          district: customer.district,
          street: customer.street,
          email: customer.email,
          ownerName: customer.ownerName,
          ownerPhone: customer.ownerPhone,
          contactName: customer.contactName,
          contactPhone: customer.contactPhone,
          contactEmail: customer.contactEmail,
          postalCode: customer.postalCode,
          buildingNumber: customer.buildingNumber,
          assignedRepresentativeId: customer.assignedRepresentativeId,
          assignedRepresentativeName: customer.assignedRepresentativeName,
          sourceSellerName: customer.sourceSellerName,
          sourceAccountCode: customer.sourceAccountCode,
          isComplete: missingFields.length === 0,
          missingFields,
          salesCount: currentActivity.salesCount,
          collectionCount: currentActivity.collectionCount,
          collectionTotal: currentActivity.collectionTotal,
          lastSalesDate: currentActivity.lastSalesDate,
          lastCollectionDate: currentActivity.lastCollectionDate,
          lastActivityDate,
          inactiveDays,
          activityStatus: currentActivity.salesCount > 0 || currentActivity.collectionCount > 0 ? "active" : "inactive",
        };
      });
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      if (!isAdmin(ctx.user) && !isSalesManager(ctx.user) && !isRepresentativeEmployee(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(customers).where(and(eq(customers.id, input.id), eq(customers.isActive, 1))).limit(1);
      if (!rows[0] || !canAccessCustomer(ctx.user, rows[0])) return null;
      return rows[0];
    }),

    create: protectedProcedure.input(customerSchema).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء العميل من صلاحية المندوب أو الأدمن" });
      validateCustomerAttachments(input);
      validateStoredCustomer(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const duplicate = input.customerType === "institution" && input.commercialRegister
        ? await db.select({ id: customers.id }).from(customers).where(eq(customers.commercialRegister, input.commercialRegister)).limit(1)
        : [];
      if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "السجل التجاري مسجل لعميل سابق" });
      const customerCode = makeReference("CUS");
      const assignedRepresentativeId = isAdmin(ctx.user) ? (input.assignedRepresentativeId || null) : Number(ctx.user.id);
      const assignedRepresentativeName = assignedRepresentativeId === Number(ctx.user.id) ? String(ctx.user.name || ctx.user.username) : String(input.assignedRepresentativeName || "");
      const result = await db.insert(customers).values({ ...input, assignedRepresentativeId, assignedRepresentativeName, email: input.email || "", contactEmail: input.contactEmail || "", customerCode, isTaxRegistered: input.isTaxRegistered ? 1 : 0, createdBy: Number(ctx.user.id), updatedBy: Number(ctx.user.id) });
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
      if (!canAccessCustomer(ctx.user, current)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل عميل غير مخصص لحسابك" });
      const duplicateRows = input.customerType === "institution" && input.commercialRegister
        ? await db.select({ id: customers.id }).from(customers).where(eq(customers.commercialRegister, input.commercialRegister))
        : [];
      if (duplicateRows.some((row) => Number(row.id) !== Number(input.id))) throw new TRPCError({ code: "CONFLICT", message: "السجل التجاري مرتبط بعميل آخر" });
      const { id, attachments, ...values } = input;
      const assignedRepresentativeId = isAdmin(ctx.user) ? (values.assignedRepresentativeId ?? null) : current.assignedRepresentativeId;
      const assignedRepresentativeName = isAdmin(ctx.user) ? String(values.assignedRepresentativeName || current.assignedRepresentativeName || "") : current.assignedRepresentativeName;
      await db.update(customers).set({ ...values, assignedRepresentativeId, assignedRepresentativeName, email: values.email || "", contactEmail: values.contactEmail || "", isTaxRegistered: values.isTaxRegistered ? 1 : 0, version: Number(current.version || 1) + 1, updatedBy: Number(ctx.user.id) }).where(eq(customers.id, id));
      await db.update(representativeAttachments).set({ isActive: 0 }).where(eq(representativeAttachments.customerId, id));
      await db.insert(representativeAttachments).values(attachments.map((attachment) => ({ customerId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, version: Number(current.version || 1) + 1, uploadedBy: Number(ctx.user.id) })));
      await writeAudit(db, ctx.user, "update", "customers", id, current, input, `تحديث ملف العميل ${current.customerCode}`);
      return { success: true, version: Number(current.version || 1) + 1 };
    }),

    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (!isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "حذف العملاء متاح للأدمن فقط" });
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const currentRows = await db.select().from(customers).where(and(eq(customers.id, input.id), eq(customers.isActive, 1))).limit(1);
      const current = currentRows[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود أو محذوف مسبقاً" });
      await db.update(customers).set({ isActive: 0, updatedBy: Number(ctx.user.id) }).where(eq(customers.id, input.id));
      await writeAudit(db, ctx.user, "delete", "customers", input.id, current, { isActive: 0 }, `حذف آمن لملف العميل ${current.customerCode}`);
      return { success: true, customerCode: current.customerCode };
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
      const customerIds = Array.from(new Set(filtered.map((row) => Number(row.customerId)).filter(Boolean)));
      const customerRows = customerIds.length ? await db.select().from(customers).where(sql`id IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})`) : [];
      const customerById = new Map(customerRows.map((customer) => [Number(customer.id), customer]));
      const now = Date.now();
      return filtered.map((row) => ({
        ...row,
        customer: customerById.get(Number(row.customerId)) || null,
        items: parseArray(row.productData),
        isOverdue: !["CLOSED", "CLOSED_REJECTED", "REJECTED_SALES"].includes(row.status) && now - new Date(row.updatedAt).getTime() > 3 * 24 * 60 * 60 * 1000,
      }));
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
      await validateWarehouseStockForOrder(db, input);
      const customerRows = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.isActive, 1))).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      if (!canAccessCustomer(ctx.user, customer)) throw new TRPCError({ code: "FORBIDDEN", message: "العميل غير موجود في قائمة العملاء المخصصة لحسابك" });
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

    createAndSubmitOrder: protectedProcedure.input(transactionSchema).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user) || input.transactionType !== "order") throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء الطلب من صلاحية المندوب فقط" });
      validateTransaction(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      await validateWarehouseStockForOrder(db, input);
      const customerRows = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.isActive, 1))).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      if (!canAccessCustomer(ctx.user, customer)) throw new TRPCError({ code: "FORBIDDEN", message: "العميل غير موجود في قائمة العملاء المخصصة لحسابك" });
      const referenceCode = makeReference("ORD");
      const now = new Date();
      const { items, ...header } = input;
      return db.transaction(async (tx: any) => {
        const result = await tx.insert(representativeTransactions).values({ ...header, referenceCode, representativeId: Number(ctx.user.id), representativeName: String(ctx.user.name), customerName: customer.name, customerVersion: customer.version, status: "PENDING_WAREHOUSE_ISSUE", currentDepartment: "warehouse", submittedAt: now, productData: items, yarnRatios: items.map((item) => item.yarnRatios || {}), attachments: input.attachments, signedSnapshot: { customer, items, deliveryDate: input.deliveryDate } });
        const id = Number(result[0].insertId);
        await tx.insert(representativeTransactionItems).values(items.map((item) => ({ ...item, transactionId: id })));
        if (input.attachments.length) await tx.insert(representativeAttachments).values(input.attachments.map((attachment) => ({ transactionId: id, attachmentType: attachment.type, fileName: attachment.name, fileUrl: attachment.url, mimeType: attachment.mimeType, expiresAt: attachment.expiresAt, uploadedBy: Number(ctx.user.id) })));
        const transaction = { id, referenceCode, status: "PENDING_WAREHOUSE_ISSUE", currentDepartment: "warehouse", representativeId: Number(ctx.user.id) };
        await insertEvent(tx, transaction, ctx.user, "PENDING_WAREHOUSE_ISSUE", "create_and_submit_order", "حفظ الطلب وإرساله مباشرة إلى المستودعات");
        await writeAudit(tx, ctx.user, "create", "representativeTransactions", id, null, input, `إنشاء وإرسال الطلب ${referenceCode} إلى المستودعات`);
        await notifyNext(tx, ctx.user, transaction, "PENDING_WAREHOUSE_ISSUE");
        return { success: true, sent: true, id, referenceCode, status: "PENDING_WAREHOUSE_ISSUE", currentDepartment: "warehouse" };
      });
    }),

    updateDraft: protectedProcedure.input(transactionSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      validateTransaction(input);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      await validateWarehouseStockForOrder(db, input);
      const rows = await db.select().from(representativeTransactions).where(eq(representativeTransactions.id, input.id)).limit(1);
      const current = rows[0];
      if (!current || current.status !== "DRAFT") throw new Error("يمكن تعديل المسودة فقط");
      if (!isAdmin(ctx.user) && Number(current.representativeId) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      if (!canAccessCustomer(ctx.user, customer)) throw new TRPCError({ code: "FORBIDDEN", message: "العميل غير موجود في قائمة العملاء المخصصة لحسابك" });
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
      const signedSnapshot = { referenceCode: detail.referenceCode, customer: detail.customer, items: detail.items, deliveryDate: detail.deliveryDate, transactionType: detail.transactionType, customerVersion: detail.customerVersion };
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

    submitOrderDirect: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const detail = await getDetail(db, input.id);
      if (!detail || detail.transactionType !== "order" || detail.status !== "DRAFT") throw new TRPCError({ code: "BAD_REQUEST", message: "الطلب غير صالح للإرسال المباشر" });
      if (Number(detail.representativeId) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const now = new Date();
      const updated = await db.update(representativeTransactions).set({ status: "PENDING_WAREHOUSE_ISSUE", currentDepartment: "warehouse", submittedAt: now, signedSnapshot: { customer: detail.customer, items: detail.items, deliveryDate: detail.deliveryDate } }).where(and(eq(representativeTransactions.id, input.id), eq(representativeTransactions.status, "DRAFT")));
      const affectedRows = Number((updated as any)?.[0]?.affectedRows ?? (updated as any)?.affectedRows ?? 0);
      if (affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "لم يتم إرسال الطلب؛ تغيّرت حالته أو تم إرساله مسبقاً" });
      await insertEvent(db, detail, ctx.user, "PENDING_WAREHOUSE_ISSUE", "submit_order_to_warehouse", "اعتماد الطلب وإرساله مباشرة إلى المستودعات");
      await notifyNext(db, ctx.user, detail, "PENDING_WAREHOUSE_ISSUE");
      return { success: true, sent: true, status: "PENDING_WAREHOUSE_ISSUE", currentDepartment: "warehouse", referenceCode: detail.referenceCode };
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
        case "warehouse_execute":
          if (!isWarehouseManager(ctx.user) || detail.status !== "PENDING_WAREHOUSE_ISSUE") throw new TRPCError({ code: "FORBIDDEN", message: "الطلب ليس في قائمة طلبات المناديب" });
          // الخصم والاعتماد والتوثيق داخل معاملة واحدة: لا يصبح الطلب منفذاً
          // ولا يخصم أي رصيد إذا تعذر خصم أحد الأصناف أو كان الرصيد غير كافٍ.
          return db.transaction(async (tx: any) => {
            const requestedByBarcode = new Map<string, number>();
            for (const item of detail.items || []) {
              const barcode = String(item.barcode || "").trim().toUpperCase();
              if (barcode.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: `الصنف ${item.productName || "غير محدد"} لا يحتوي على باركود صالح` });
              const quantityDozen = itemQuantityDozen(item);
              if (!(quantityDozen > 0)) throw new TRPCError({ code: "BAD_REQUEST", message: `كمية الصنف ${item.productName || barcode} غير صالحة` });
              requestedByBarcode.set(barcode, (requestedByBarcode.get(barcode) || 0) + quantityDozen);
            }

            for (const [barcode, quantityDozen] of requestedByBarcode) {
              const stockRows = await tx.select().from(finishedWarehouseStock).where(and(eq(finishedWarehouseStock.barcode, barcode), eq(finishedWarehouseStock.isActive, 1))).limit(1);
              const stock = stockRows[0];
              if (!stock) throw new TRPCError({ code: "NOT_FOUND", message: `الصنف بالباركود ${barcode} غير موجود في مستودع الإنتاج التام` });
              const available = Number(stock.quantityDozen || 0);
              if (available < quantityDozen) throw new TRPCError({ code: "BAD_REQUEST", message: `الرصيد غير كافٍ للصنف ${stock.productName}: المتاح ${available} درزن والمطلوب ${quantityDozen} درزن` });
              const remainingDozen = available - quantityDozen;
              const updated = await tx.update(finishedWarehouseStock)
                .set({ quantityDozen: remainingDozen, lastMovementAt: new Date() })
                .where(and(eq(finishedWarehouseStock.id, stock.id), eq(finishedWarehouseStock.isActive, 1), gte(finishedWarehouseStock.quantityDozen, quantityDozen)));
              const affectedRows = Number((updated as any)?.[0]?.affectedRows ?? (updated as any)?.affectedRows ?? 0);
              if (affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: `تغير رصيد الصنف ${stock.productName} أثناء التنفيذ؛ أعد المحاولة` });
              await tx.insert(finishedWarehouseMovements).values({ stockId: Number(stock.id), movementType: "issue", quantityDozen, sourceType: "representative_order", sourceId: Number(detail.id), notes: `صرف طلب المندوب ${detail.referenceCode}`, userId: Number(ctx.user.id) });
              if (remainingDozen < Number(stock.minimumDozen || 0)) {
                await tx.insert(internalMessages).values({ subject: "تنبيه انخفاض مخزون الإنتاج التام", body: `بعد تنفيذ الطلب ${detail.referenceCode} أصبح رصيد ${stock.productName} هو ${remainingDozen} درزن، والحد الأدنى ${stock.minimumDozen} درزن`, senderId: Number(ctx.user.id), recipientDepartment: "warehouse", relatedType: "finishedWarehouseStock", relatedId: Number(stock.id), attachments: [] });
              }
            }

            const executedAt = new Date();
            const executedPatch = { status: "WAREHOUSE_EXECUTED", currentDepartment: "closed", closedAt: executedAt };
            await tx.update(representativeTransactions).set(executedPatch).where(and(eq(representativeTransactions.id, input.id), eq(representativeTransactions.status, "PENDING_WAREHOUSE_ISSUE")));
            await insertEvent(tx, detail, ctx.user, "WAREHOUSE_EXECUTED", input.action, "تم تنفيذ الطلب وخصم الكميات من مستودع الإنتاج التام");
            await writeAudit(tx, ctx.user, "warehouse_execute", "representativeTransactions", input.id, detail, executedPatch, `تنفيذ وخصم طلب المندوب ${detail.referenceCode}`);
            return { success: true, status: "WAREHOUSE_EXECUTED", stockIssued: true };
          });
        case "warehouse_partial":
          if (!isWarehouseManager(ctx.user) || !["PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL"].includes(detail.status) || !input.notes.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب ملاحظة تفصيلية عن عدم التوفر أو التنفيذ الجزئي" });
          nextStatus = "WAREHOUSE_PARTIAL"; patch.rejectionReason = input.notes;
          break;
        case "representative_respond":
          if (Number(detail.representativeId) !== Number(ctx.user.id) || detail.status !== "WAREHOUSE_PARTIAL" || !input.notes.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل رد المندوب قبل إعادة الطلب للمستودع" });
          nextStatus = "PENDING_WAREHOUSE_ISSUE"; patch.correctiveAction = { action: input.notes, evidence: input.attachments };
          break;
        case "representative_close_order":
          if (Number(detail.representativeId) !== Number(ctx.user.id) || !["WAREHOUSE_PARTIAL", "WAREHOUSE_EXECUTED"].includes(detail.status)) throw new TRPCError({ code: "FORBIDDEN" });
          nextStatus = "REPRESENTATIVE_CLOSED"; patch.closedAt = new Date();
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
      if (nextStatus === "WAREHOUSE_PARTIAL") {
        await db.insert(internalMessages).values({
          subject: `رد من المستودع على الطلب ${detail.referenceCode}`,
          body: `أعاد المستودع الطلب ${detail.referenceCode} بتنفيذ جزئي أو عدم توفر. الملاحظات: ${input.notes}`,
          senderId: Number(ctx.user.id),
          recipientUserId: Number(detail.representativeId),
          relatedType: "representative_transaction",
          relatedId: Number(detail.id),
          attachments: input.attachments,
        });
      }
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
    create: protectedProcedure.input(z.object({ customerId: z.number(), collectedAmount: z.number().positive(), collectionMethod: z.enum(["cash", "transfer"]), receiptNumber: z.string().optional().default(""), collectionDate: z.string().min(10), notes: z.string().optional().default(""), attachments: z.array(attachmentSchema).default([]) })).mutation(async ({ input, ctx }) => {
      if (!isRepresentative(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const customer = customerRows[0];
      if (!customer) throw new Error("العميل غير موجود");
      if (!canAccessCustomer(ctx.user, customer)) throw new TRPCError({ code: "FORBIDDEN", message: "العميل غير موجود في قائمة العملاء المخصصة لحسابك" });
      const referenceCode = makeReference("COL");
      // هذا سجل أداء تقريري حر، وليس قيداً محاسبياً؛ لا يرتبط بفاتورة ولا يحسب متبقياً.
      const result = await db.insert(representativeCollections).values({ ...input, transactionId: null, referenceCode, invoiceNumber: null, invoiceAmount: 0, remainingAmount: 0, customerName: customer.name, representativeId: Number(ctx.user.id), representativeName: String(ctx.user.name), attachments: input.attachments });
      const id = Number(result[0].insertId);
      await writeAudit(db, ctx.user, "create", "representativeCollections", id, null, input, `تسجيل تحصيل ${referenceCode}`);
      return { success: true, id, referenceCode };
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
      const reps = activeUsers.filter((candidate) => isRepresentativeEmployee(candidate) && (!input?.representativeId || Number(candidate.id) === input.representativeId));
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
