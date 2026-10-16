import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc.js";
import { getDb } from "./db.js";
import { buildCustodyReport } from "../shared/custody-reporting";
import { createCustodyWorkbook } from "./custody-export";
import {
  actOnCustody,
  createCustodyBatch,
  getCustodySettings,
  importLegacyCustody,
  listLegacyCustodyCandidates,
  listCustodyAccounts,
  listCustodyBatches,
  saveCustodySettings,
} from "./custody-service.js";

const stageSchema = z.enum(["production", "rosso", "qalb", "antislip", "kawiya", "inspection", "packing", "storage", "followup", "customer_service"]);
const qualitySchema = z.enum(["first", "second", "suspected", "damaged"]);
const operationKeySchema = z.string().trim().min(8).max(128);
const integerPairs = z.number().int().min(0).max(2_147_483_647);
const positivePairs = z.number().int().positive().max(2_147_483_647);

const productSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  size: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(100),
  antiSlip: z.boolean(),
  yarns: z.array(z.object({ name: z.string().trim().min(1).max(100), percentage: z.number().positive().finite() })).min(1),
  yarnWeightGrams: z.number().nonnegative().finite(),
  pairWeightGrams: z.number().positive().finite(),
});

const batchInputSchema = z.object({
  operationKey: operationKeySchema,
  product: productSchema,
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  machineNumber: z.string().trim().min(1).max(50),
  shift: z.string().trim().min(1).max(100),
  manufacturingOrder: z.string().trim().max(255).optional(),
  purpose: z.enum(["sale", "sample"]),
  firstPairs: integerPairs,
  secondPairs: integerPairs,
  wasteThreadGrams: z.number().nonnegative().finite().optional(),
  wasteSocksGrams: z.number().nonnegative().finite().optional(),
  needlesUsed: integerPairs.optional(),
  wasteNeedles: integerPairs.optional(),
  responsibleUserId: z.number().int().positive(),
  sampleRequestId: z.number().int().positive().optional(),
});

const legacyImportSchema = z.object({
  operationKey: operationKeySchema,
  sourceId: z.number().int().positive(),
  product: productSchema,
  responsibleUserId: z.number().int().positive(),
  reason: z.string().trim().min(5).max(10_000),
});

const allocationSchema = z.object({
  toStage: stageSchema,
  toUserId: z.number().int().positive(),
  quality: qualitySchema,
  pairs: positivePairs,
});

const stageLimitSchema = z.object({ workHours: z.number().positive().finite(), confirmationHours: z.number().positive().finite() });

const actionInputSchema = z.object({
  operationKey: operationKeySchema,
  batchId: z.string().uuid(),
  custodyId: z.string().uuid().optional(),
  transferId: z.string().uuid().optional(),
  action: z.enum(["receive", "dispute", "reject", "resolve", "start", "pause", "resume", "progress", "complete", "send", "store", "approve_disposal", "execute_disposal", "deliver_sample", "correct", "rework"]),
  actualPairs: integerPairs.optional(),
  pairs: integerPairs.optional(),
  reason: z.string().trim().max(10_000).optional(),
  allocations: z.array(allocationSchema).max(8).optional(),
  barcode: z.string().trim().min(1).max(64).optional(),
  packagePairs: positivePairs.optional(),
  method: z.string().trim().max(255).optional(),
  receiver: z.string().trim().max(255).optional(),
  proof: z.string().trim().max(2_000).optional(),
  defectType: z.string().trim().max(255).optional(),
  defectCause: z.string().trim().max(2_000).optional(),
  attachments: z.array(z.unknown()).max(30).optional(),
  correction: productSchema.partial().optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  scheduleCronTaskUid: z.string().trim().min(1).max(128).nullable().optional(),
  // Zod 4's z.record has no .partial(); optional enum-keyed fields accurately model Partial<Record<Stage, Limit>>.
  stageLimits: z.object({
    production: stageLimitSchema.optional(), rosso: stageLimitSchema.optional(), qalb: stageLimitSchema.optional(),
    antislip: stageLimitSchema.optional(), kawiya: stageLimitSchema.optional(), inspection: stageLimitSchema.optional(),
    packing: stageLimitSchema.optional(), storage: stageLimitSchema.optional(), followup: stageLimitSchema.optional(),
    customer_service: stageLimitSchema.optional(),
  }),
  shifts: z.array(z.object({
    name: z.string().trim().min(1).max(100), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  })).max(20),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(730),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  return db;
}

/** Mount under `custodyV2` in the parent router; this module never alters legacy endpoints. */
export const custodyRouter = router({
  accounts: protectedProcedure.query(async () => listCustodyAccounts(await dbOrThrow())),
  list: protectedProcedure.input(z.object({ stage: stageSchema.optional(), batchId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => listCustodyBatches(await dbOrThrow(), ctx.user!, input ?? {})),
  createBatch: protectedProcedure.input(batchInputSchema)
    .mutation(async ({ ctx, input }) => createCustodyBatch(await dbOrThrow(), ctx.user!, input)),
  legacyCandidates: protectedProcedure.query(async ({ ctx }) => listLegacyCustodyCandidates(await dbOrThrow(), ctx.user!)),
  importLegacy: protectedProcedure.input(legacyImportSchema)
    .mutation(async ({ ctx, input }) => importLegacyCustody(await dbOrThrow(), ctx.user!, input)),
  act: protectedProcedure.input(actionInputSchema)
    .mutation(async ({ ctx, input }) => actOnCustody(await dbOrThrow(), ctx.user!, input)),
  settings: protectedProcedure.query(async () => getCustodySettings(await dbOrThrow())),
  saveSettings: protectedProcedure.input(settingsSchema)
    .mutation(async ({ ctx, input }) => saveCustodySettings(await dbOrThrow(), ctx.user!, input)),
  exportExcel: protectedProcedure.input(z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    department: z.string().max(100).optional(), accountId: z.number().int().positive().optional(),
    product: z.string().max(255).optional(), batch: z.string().max(255).optional(), quality: qualitySchema.optional(),
    status: z.enum(["received", "working", "paused", "completed", "sent", "closed", "stored", "destroyed", "disputed", "rejected", "pending", "confirmed"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [batches, accounts, settings] = await Promise.all([listCustodyBatches(db, ctx.user!, {}), listCustodyAccounts(db), getCustodySettings(db)]);
    const report = buildCustodyReport({ batches, accounts, settings, filters: input });
    const file = await createCustodyWorkbook(report);
    return { success: true, name: `تقرير-العهد-${input.startDate}-${input.endDate}.xlsx`, base64: file.toString("base64") };
  }),
});
