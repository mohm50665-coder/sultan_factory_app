import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db.js";
import {
  users as usersTable,
  production as productionTable,
  manufacturingStages as manufacturingStagesTable,
  sales as salesTable,
  collection as collectionTable,
  rawMaterials as rawMaterialsTable,
  materialConsumption as materialConsumptionTable,
  incomingMaterials as incomingMaterialsTable,
  administrativeProcedures as administrativeProceduresTable,
  expenses as expensesTable,
  maintainedEquipment as maintainedEquipmentTable,
  stoppedEquipment as stoppedEquipmentTable,
  maintenanceRecommendations as maintenanceRecommendationsTable,
  tasks as tasksTable,
  bankBalance as bankBalanceTable,
  productionCosts as productionCostsTable,
  alerts as alertsTable,
  backups as backupsTable,
  activityLog as activityLogTable,
  reports as reportsTable,
  productCostCalculation,
  monthlyGoals as monthlyGoalsTable,
  goalProgress as goalProgressTable,
  kpis as kpisTable,
  departments as departmentsTable,
  machines as machinesTable,
  productionStages as productionStagesTable,
  employeeStageAssignment as employeeStageAssignmentTable,
  productTypes as productTypesTable,
  boardRepresentativeData as boardRepresentativeDataTable,
  auditLog as auditLogTable,
  systemSettings as systemSettingsTable,
  meetings as meetingsTable,
  meetingOutputs as meetingOutputsTable,
  manufacturingWorkers as manufacturingWorkersTable,
  financialReports as financialReportsTable,
  localProductionCosts as localProductionCostsTable,
  savedProductCosts as savedProductCostsTable,
  governmentTenders as governmentTendersTable,
  wasteThresholds as wasteThresholdsTable,
  wasteAlerts as wasteAlertsTable,
  appSettings as appSettingsTable,
} from "../drizzle/schema.js";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sdk } from "./_core/sdk";

const COOKIE_NAME = "session_id";

// Helper to get authenticated user from cookie
async function getUserFromCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const db = await getDb();
  if (!db) return null;
  // cookieValue is the user id
  const userId = parseInt(cookieValue);
  if (isNaN(userId)) return null;
  const result = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export const appRouter = router({
  system: systemRouter,

  // ===== AUTH ROUTER =====
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      const cookies = ctx.req.headers.cookie || "";
      const cookieMatch = cookies.match(/session_id=([^;]+)/);
      const sessionIdFromCookie = cookieMatch ? cookieMatch[1] : undefined;
      // Support x-session-id header for mobile (Android blocks manual Cookie headers)
      const sessionIdFromHeader = ctx.req.headers['x-session-id'] as string | undefined;
      const sessionId = sessionIdFromCookie || sessionIdFromHeader;
      const user = await getUserFromCookie(sessionId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        position: user.position,
        department: user.department,
        role: user.role,
        isActive: user.isActive,
        allowedSections: user.allowedSections,
        toolPermissions: user.toolPermissions,
      };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          username: z.string().min(1),
          phone: z.string().optional(),
          position: z.string().optional(),
          department: z.string().optional(),
          password: z.string().min(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");

        // Check if username exists
        const existing = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, input.username))
          .limit(1);

        if (existing.length > 0) {
          throw new Error("اسم المستخدم مستخدم بالفعل");
        }

        const openId = randomUUID();

        try {
          await db.insert(usersTable).values({
            openId,
            name: input.name,
            username: input.username,
            email: input.username + "@sultan.local",
            phone: input.phone || null,
            position: input.position || null,
            department: input.department || null,
            password: input.password,
            loginMethod: "password",
            role: "user",
            isActive: 0,
            allowedSections: null,
            toolPermissions: null,
          });
        } catch (error) {
          console.error("[Auth] Registration insert failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر حفظ بيانات الموظف. يرجى التأكد من إعداد قاعدة البيانات والمحاولة مرة أخرى.",
          });
        }

        return {
          success: true,
          message: "تم التسجيل بنجاح. حسابك بانتظار التفعيل من المدير.",
        };
      }),

    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");

        const result = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, input.username))
          .limit(1);

        const user = result[0];

        if (!user || user.password !== input.password) {
          throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        if (!user.isActive) {
          throw new Error("حسابك غير مفعّل. يرجى التواصل مع المدير لتفعيل حسابك.");
        }

        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, user.id.toString(), cookieOptions);

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone,
            position: user.position,
            department: user.department,
            role: user.role,
            isActive: user.isActive,
            allowedSections: user.allowedSections,
            toolPermissions: user.toolPermissions,
          },
        };
      }),

    resetPassword: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          phone: z.string().min(1),
          newPassword: z.string().min(6),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");

        const result = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, input.username))
          .limit(1);

        const user = result[0];
        if (!user || user.phone !== input.phone) {
          throw new Error("اسم المستخدم أو رقم الهاتف غير صحيح");
        }

        await db
          .update(usersTable)
          .set({ password: input.newPassword })
          .where(eq(usersTable.id, user.id));

        return { success: true };
      }),
  }),

  // ===== ADMIN / USER MANAGEMENT ROUTER =====
  admin: router({
    getAllUsers: publicProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const result = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
      return result.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        position: u.position,
        department: u.department,
        role: u.role,
        isActive: u.isActive,
        allowedSections: u.allowedSections,
        toolPermissions: u.toolPermissions,
        createdAt: u.createdAt?.toISOString(),
      }));
    }),

    toggleUserActive: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.select().from(usersTable).where(eq(usersTable.id, input.userId)).limit(1);
        if (result.length === 0) throw new Error("المستخدم غير موجود");
        const user = result[0];
        await db.update(usersTable).set({ isActive: user.isActive ? 0 : 1 }).where(eq(usersTable.id, input.userId));
        return { success: true, isActive: !user.isActive };
      }),

    changeUserRole: publicProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "manager", "supervisor"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ role: input.role }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    updatePosition: publicProcedure
      .input(z.object({ userId: z.number(), position: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ position: input.position }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    updateToolPermissions: publicProcedure
      .input(z.object({ userId: z.number(), toolPermissions: z.record(z.string(), z.boolean()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ toolPermissions: input.toolPermissions }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    getPendingUsers: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(usersTable).where(eq(usersTable.isActive, 0));
    }),

    deleteUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(usersTable).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    resetUserPassword: publicProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ password: input.newPassword }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    updateAllowedSections: publicProcedure
      .input(z.object({ userId: z.number(), allowedSections: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ allowedSections: input.allowedSections }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),

    updateUserDepartment: publicProcedure
      .input(z.object({ userId: z.number(), department: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ department: input.department }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),
  }),

  // ===== TASKS ROUTER =====
  tasks: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        assignmentSource: z.enum(["board_representative", "general_manager"]),
        assignedEmployee: z.string(),
        assignedUsername: z.string().optional(),
        taskDescription: z.string(),
        createdDate: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(tasksTable).values({
          ...input,
          assignedUsername: input.assignedUsername || null,
          createdDate: input.createdDate || null,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
        });
        return { success: true, id: result[0].insertId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(tasksTable).set(input.data as any).where(eq(tasksTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(tasksTable).where(eq(tasksTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== ADMINISTRATIVE PROCEDURES ROUTER =====
  administrative: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(administrativeProceduresTable).orderBy(desc(administrativeProceduresTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        employeeName: z.string(),
        employeeNumber: z.string().optional(),
        department: z.string().optional(),
        requestType: z.string(),
        requestDetails: z.string(),
        attachments: z.array(z.string()).optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        // Generate reference number
        const all = await db.select().from(administrativeProceduresTable);
        const refNum = `REQ-${String(all.length + 1).padStart(4, "0")}`;
        const result = await db.insert(administrativeProceduresTable).values({
          referenceNumber: refNum,
          submissionDate: new Date(),
          employeeName: input.employeeName,
          employeeNumber: input.employeeNumber || null,
          department: input.department || null,
          requestType: input.requestType,
          requestDetails: input.requestDetails,
          attachments: input.attachments || [],
          userId: input.userId,
        });
        return { success: true, id: result[0].insertId, referenceNumber: refNum };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(administrativeProceduresTable).set(input.data as any).where(eq(administrativeProceduresTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(administrativeProceduresTable).where(eq(administrativeProceduresTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== PRODUCTION ROUTER =====
  production: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(productionTable).orderBy(desc(productionTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        date: z.string(),
        machineNumber: z.string(),
        productName: z.string().optional(),
        shiftNumber: z.number().optional(),
        shiftStart: z.string().optional(),
        shiftEnd: z.string().optional(),
        productionDozen: z.number().optional(),
        productionPairs: z.number().optional(),
        wasteThreadGrams: z.number().optional(),
        wasteSocksGrams: z.number().optional(),
        secondGradeDozen: z.number().optional(),
        secondGradePairs: z.number().optional(),
        wasteNeedles: z.number().optional(),
        productionHours: z.number().optional(),
        productionMinutes: z.number().optional(),
        yarnRubber: z.number().optional(),
        yarnSpandex: z.number().optional(),
        yarnNylon: z.number().optional(),
        yarnCotton: z.number().optional(),
        yarnBamboo: z.number().optional(),
        yarnSpan: z.number().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(productionTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    // إنشاء عدة سجلات دفعة واحدة (لحفظ يوم كامل)
    createBatch: publicProcedure
      .input(z.object({
        entries: z.array(z.object({
          date: z.string(),
          machineNumber: z.string(),
          productName: z.string().optional(),
          shiftNumber: z.number().optional(),
          shiftStart: z.string().optional(),
          shiftEnd: z.string().optional(),
          productionDozen: z.number().optional(),
          productionPairs: z.number().optional(),
          wasteThreadGrams: z.number().optional(),
          wasteSocksGrams: z.number().optional(),
          secondGradeDozen: z.number().optional(),
          secondGradePairs: z.number().optional(),
          wasteNeedles: z.number().optional(),
          productionHours: z.number().optional(),
          productionMinutes: z.number().optional(),
          yarnRubber: z.number().optional(),
          yarnSpandex: z.number().optional(),
          yarnNylon: z.number().optional(),
          yarnCotton: z.number().optional(),
          yarnBamboo: z.number().optional(),
          yarnSpan: z.number().optional(),
          userId: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        if (input.entries.length === 0) return { success: true, count: 0 };
        await db.insert(productionTable).values(input.entries);
        return { success: true, count: input.entries.length };
      }),

    // حذف كل سجلات يوم معين
    deleteByDate: publicProcedure
      .input(z.object({ date: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(productionTable).where(eq(productionTable.date, input.date));
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(productionTable).set(input.data as any).where(eq(productionTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(productionTable).where(eq(productionTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== MANUFACTURING STAGES ROUTER =====
  manufacturing: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(manufacturingStagesTable).orderBy(desc(manufacturingStagesTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        stageName: z.string(),
        workerName: z.string(),
        quantityDozen: z.number().optional(),
        quantityPair: z.number().optional(),
        productType: z.string().optional(),
        productName: z.string().optional(),
        date: z.string().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(manufacturingStagesTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(manufacturingStagesTable).set(input.data as any).where(eq(manufacturingStagesTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(manufacturingStagesTable).where(eq(manufacturingStagesTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== SALES ROUTER =====
  sales: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(salesTable).orderBy(desc(salesTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        sellerName: z.string(),
        customerName: z.string(),
        customerCategory: z.string().optional(),
        quantityDozen: z.number().optional(),
        quantityPair: z.number().optional(),
        amount: z.string().optional(),
        invoiceNumber: z.string().optional(),
        invoiceDate: z.string().optional(),
        paymentMethod: z.enum(["cash", "credit", "deferred"]),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(salesTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(salesTable).set(input.data as any).where(eq(salesTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(salesTable).where(eq(salesTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== COLLECTION ROUTER =====
  collection: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(collectionTable).orderBy(desc(collectionTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        collectorName: z.string(),
        customerName: z.string(),
        amount: z.number(),
        receiptNumber: z.string().optional(),
        receiptDate: z.string().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(collectionTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(collectionTable).set(input.data as any).where(eq(collectionTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(collectionTable).where(eq(collectionTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== EXPENSES ROUTER =====
  expenses: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(expensesTable).orderBy(desc(expensesTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        amount: z.number(),
        expenseDetails: z.string(),
        paymentMethod: z.enum(["bankTransfer", "cash", "cardHaydar", "cardDirector"]),
        requiresApproval: z.number().optional(),
        approvedBy: z.string().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(expensesTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(expensesTable).set(input.data as any).where(eq(expensesTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(expensesTable).where(eq(expensesTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== MAINTENANCE ROUTER =====
  maintenance: router({
    getMaintained: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(maintainedEquipmentTable).orderBy(desc(maintainedEquipmentTable.createdAt));
    }),

    getStopped: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(stoppedEquipmentTable).orderBy(desc(stoppedEquipmentTable.createdAt));
    }),

    getRecommendations: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(maintenanceRecommendationsTable).orderBy(desc(maintenanceRecommendationsTable.createdAt));
    }),

    createMaintained: publicProcedure
      .input(z.object({
        equipmentName: z.string(),
        maintenanceDate: z.string(),
        maintenanceDetails: z.string(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(maintainedEquipmentTable).values({
          ...input,
          maintenanceDate: new Date(input.maintenanceDate),
        });
        return { success: true, id: result[0].insertId };
      }),

    createStopped: publicProcedure
      .input(z.object({
        equipmentName: z.string(),
        stopDate: z.string(),
        stopReason: z.string(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(stoppedEquipmentTable).values({
          equipmentName: input.equipmentName,
          stopDate: new Date(input.stopDate),
          stopReason: input.stopReason,
          userId: input.userId,
        });
        return { success: true, id: result[0].insertId };
      }),

    createRecommendation: publicProcedure
      .input(z.object({
        recommendation: z.string(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(maintenanceRecommendationsTable).values({
          recommendation: input.recommendation,
          priority: input.priority || "medium",
          userId: input.userId,
        });
        return { success: true, id: result[0].insertId };
      }),

    deleteMaintained: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(maintainedEquipmentTable).where(eq(maintainedEquipmentTable.id, input.id));
        return { success: true };
      }),

    deleteStopped: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(stoppedEquipmentTable).where(eq(stoppedEquipmentTable.id, input.id));
        return { success: true };
      }),

    deleteRecommendation: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(maintenanceRecommendationsTable).where(eq(maintenanceRecommendationsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== WAREHOUSE ROUTER =====
  warehouse: router({
    getRawMaterials: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(rawMaterialsTable).orderBy(desc(rawMaterialsTable.createdAt));
    }),

    getConsumption: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(materialConsumptionTable).orderBy(desc(materialConsumptionTable.createdAt));
    }),

    getIncoming: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(incomingMaterialsTable).orderBy(desc(incomingMaterialsTable.createdAt));
    }),

    createRawMaterial: publicProcedure
      .input(z.object({
        materialName: z.string(),
        quantity: z.number(),
        unit: z.string(),
        dataEnteredBy: z.string(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(rawMaterialsTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    createConsumption: publicProcedure
      .input(z.object({
        materialType: z.string(),
        quantity: z.number(),
        unit: z.enum(["kilo", "gram", "piece", "carton"]),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(materialConsumptionTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    createIncoming: publicProcedure
      .input(z.object({
        materialType: z.string(),
        quantity: z.number(),
        unit: z.enum(["kilo", "gram", "piece", "carton"]),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(incomingMaterialsTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    deleteRawMaterial: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(rawMaterialsTable).where(eq(rawMaterialsTable.id, input.id));
        return { success: true };
      }),

    deleteConsumption: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(materialConsumptionTable).where(eq(materialConsumptionTable.id, input.id));
        return { success: true };
      }),

    deleteIncoming: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(incomingMaterialsTable).where(eq(incomingMaterialsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== MAINTENANCE ENTRIES ROUTER (generic JSON) =====
  maintenanceEntries: router({
    getBySection: publicProcedure
      .input(z.object({ section: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const result = await db.execute(
          sql`SELECT * FROM maintenance_entries WHERE section = ${input.section} ORDER BY created_at DESC`
        );
        return result[0] || [];
      }),

    create: publicProcedure
      .input(z.object({
        section: z.string(),
        entryPerson: z.string().optional(),
        date: z.string().optional(),
        data: z.any(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.execute(
          sql`INSERT INTO maintenance_entries (section, entry_person, date, data, user_id) VALUES (${input.section}, ${input.entryPerson || ''}, ${input.date || ''}, ${JSON.stringify(input.data)}, ${input.userId || null})`
        );
        return { success: true, id: (result[0] as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.any(),
        date: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.execute(
          sql`UPDATE maintenance_entries SET data = ${JSON.stringify(input.data)}, date = ${input.date || ''} WHERE id = ${input.id}`
        );
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.execute(sql`DELETE FROM maintenance_entries WHERE id = ${input.id}`);
        return { success: true };
      }),
  }),

  // ===== WAREHOUSE ENTRIES ROUTER (generic JSON) =====
  warehouseEntries: router({
    getBySection: publicProcedure
      .input(z.object({ section: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const result = await db.execute(
          sql`SELECT * FROM warehouse_entries WHERE section = ${input.section} ORDER BY created_at DESC`
        );
        return result[0] || [];
      }),

    create: publicProcedure
      .input(z.object({
        section: z.string(),
        date: z.string().optional(),
        data: z.any(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.execute(
          sql`INSERT INTO warehouse_entries (section, date, data, user_id) VALUES (${input.section}, ${input.date || ''}, ${JSON.stringify(input.data)}, ${input.userId || null})`
        );
        return { success: true, id: (result[0] as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.any(),
        date: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.execute(
          sql`UPDATE warehouse_entries SET data = ${JSON.stringify(input.data)}, date = ${input.date || ''} WHERE id = ${input.id}`
        );
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.execute(sql`DELETE FROM warehouse_entries WHERE id = ${input.id}`);
        return { success: true };
      }),
  }),

  // ===== PRODUCTION COSTS ROUTER =====
  costs: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(productionCostsTable).orderBy(desc(productionCostsTable.createdAt));
    }),

    getByDateRange: publicProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(productionCostsTable)
          .where(and(gte(productionCostsTable.date, input.startDate), lte(productionCostsTable.date, input.endDate)))
          .orderBy(desc(productionCostsTable.date));
      }),

    create: publicProcedure
      .input(z.object({
        date: z.string(),
        threadCost: z.number().optional(),
        rubberCost: z.number().optional(),
        spandexCost: z.number().optional(),
        nylonCost: z.number().optional(),
        cottonCost: z.number().optional(),
        bambooCost: z.number().optional(),
        spanCost: z.number().optional(),
        laborCost: z.number().optional(),
        utilitiesCost: z.number().optional(),
        maintenanceCost: z.number().optional(),
        otherCost: z.number().optional(),
        totalCost: z.number().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.insert(productionCostsTable).values(input as any);
        return { success: true, id: (result[0] as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(productionCostsTable).set(input.data as any).where(eq(productionCostsTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.delete(productionCostsTable).where(eq(productionCostsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== ALERTS ROUTER =====
  alerts: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt));
    }),

    getByUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(alertsTable).where(eq(alertsTable.userId, input.userId)).orderBy(desc(alertsTable.createdAt));
      }),

    getUnread: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(alertsTable)
          .where(and(eq(alertsTable.userId, input.userId), eq(alertsTable.read, 0)))
          .orderBy(desc(alertsTable.createdAt));
      }),

    create: publicProcedure
      .input(z.object({
        type: z.enum(["cost_exceeded", "low_productivity", "pending_procedure", "quality_issue", "safety_alert"]),
        title: z.string(),
        message: z.string(),
        severity: z.enum(["info", "warning", "critical"]),
        userId: z.number(),
        data: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.insert(alertsTable).values(input as any);
        return { success: true, id: (result[0] as any).insertId };
      }),

    markAsRead: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(alertsTable).set({ read: 1 }).where(eq(alertsTable.id, input.id));
        return { success: true };
      }),

    markAllAsRead: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(alertsTable).set({ read: 1 }).where(eq(alertsTable.userId, input.userId));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.delete(alertsTable).where(eq(alertsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== BACKUPS ROUTER =====
  backups: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(backupsTable).orderBy(desc(backupsTable.createdAt));
    }),

    create: publicProcedure
      .input(z.object({
        backupName: z.string(),
        backupType: z.enum(["manual", "automatic", "scheduled"]),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        // Create backup by collecting all data
        const allProduction = await db.select().from(productionTable);
        const allSales = await db.select().from(salesTable);
        const allExpenses = await db.select().from(expensesTable);
        const allTasks = await db.select().from(tasksTable);
        const allCosts = await db.select().from(productionCostsTable);
        const dataSize = JSON.stringify({ allProduction, allSales, allExpenses, allTasks, allCosts }).length;

        const result = await db.insert(backupsTable).values({
          backupName: input.backupName,
          backupType: input.backupType,
          dataSize,
          status: "completed",
          backupPath: `/backups/${Date.now()}_${input.backupName}.json`,
          userId: input.userId,
        });
        return { success: true, id: (result[0] as any).insertId, dataSize };
      }),

    updateStatus: publicProcedure
      .input(z.object({ id: z.number(), status: z.string(), errorMessage: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const updateData: any = { status: input.status };
        if (input.errorMessage) updateData.errorMessage = input.errorMessage;
        await db.update(backupsTable).set(updateData).where(eq(backupsTable.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.delete(backupsTable).where(eq(backupsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== ACTIVITY LOG ROUTER =====
  activityLog: router({
    getAll: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const limit = input?.limit || 100;
        return db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(limit);
      }),

    getByUser: publicProcedure
      .input(z.object({ userId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(activityLogTable)
          .where(eq(activityLogTable.userId, input.userId))
          .orderBy(desc(activityLogTable.createdAt))
          .limit(input.limit || 50);
      }),

    create: publicProcedure
      .input(z.object({
        action: z.string(),
        entityType: z.string(),
        entityId: z.number().optional(),
        details: z.any().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.insert(activityLogTable).values(input as any);
        return { success: true, id: (result[0] as any).insertId };
      }),
  }),

  // ===== REPORTS ROUTER =====
  reports: router({
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
    }),

    getByType: publicProcedure
      .input(z.object({ reportType: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(reportsTable)
          .where(eq(reportsTable.reportType, input.reportType as any))
          .orderBy(desc(reportsTable.createdAt));
      }),

    create: publicProcedure
      .input(z.object({
        reportName: z.string(),
        reportType: z.enum(["production", "cost", "sales", "performance", "quality", "maintenance"]),
        startDate: z.string(),
        endDate: z.string(),
        data: z.any().optional(),
        generatedBy: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        const result = await db.insert(reportsTable).values(input as any);
        return { success: true, id: (result[0] as any).insertId };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.delete(reportsTable).where(eq(reportsTable.id, input.id));
        return { success: true };
      }),

    // Generate comprehensive report with all data
    generateComprehensive: publicProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        generatedBy: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");

        // Collect all data for the period
        const productionData = await db.select().from(productionTable);
        const salesData = await db.select().from(salesTable);
        const expensesData = await db.select().from(expensesTable);
        const costsData = await db.select().from(productionCostsTable);
        const tasksData = await db.select().from(tasksTable);
        const collectionData = await db.select().from(collectionTable);

        const reportData = {
          production: {
            totalEntries: productionData.length,
            totalDozen: productionData.reduce((sum, p) => sum + (p.productionDozen || 0), 0),
            totalPairs: productionData.reduce((sum, p) => sum + (p.productionPairs || 0), 0),
            totalWasteThread: productionData.reduce((sum, p) => sum + (p.wasteThreadGrams || 0), 0),
            totalWasteSocks: productionData.reduce((sum, p) => sum + (p.wasteSocksGrams || 0), 0),
          },
          sales: {
            totalEntries: salesData.length,
            totalAmount: salesData.reduce((sum, s) => sum + parseInt(s.amount || "0"), 0),
            totalDozen: salesData.reduce((sum, s) => sum + (s.quantityDozen || 0), 0),
          },
          expenses: {
            totalEntries: expensesData.length,
            totalAmount: expensesData.reduce((sum, e) => sum + (e.amount || 0), 0),
          },
          costs: {
            totalEntries: costsData.length,
            totalCost: costsData.reduce((sum, c) => sum + (c.totalCost || 0), 0),
          },
          tasks: {
            total: tasksData.length,
            completed: tasksData.filter(t => t.result === "completed").length,
            pending: tasksData.filter(t => t.result === "pending").length,
          },
          collection: {
            totalEntries: collectionData.length,
            totalAmount: collectionData.reduce((sum, c) => sum + (c.amount || 0), 0),
          },
        };

        const result = await db.insert(reportsTable).values({
          reportName: `\u062a\u0642\u0631\u064a\u0631 \u0634\u0627\u0645\u0644 - ${input.startDate} \u0625\u0644\u0649 ${input.endDate}`,
          reportType: "performance",
          startDate: input.startDate,
          endDate: input.endDate,
          data: reportData,
          generatedBy: input.generatedBy,
        });

        return { success: true, id: (result[0] as any).insertId, data: reportData };
      }),
  }),

  // ===== ADMIN DATA MANAGEMENT (Full CRUD for all tables) =====
  adminData: router({
    // Get all data summary for admin dashboard
    getSummary: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;

      const [prodCount] = await db.execute(sql`SELECT COUNT(*) as count FROM production`);
      const [salesCount] = await db.execute(sql`SELECT COUNT(*) as count FROM sales`);
      const [expCount] = await db.execute(sql`SELECT COUNT(*) as count FROM expenses`);
      const [taskCount] = await db.execute(sql`SELECT COUNT(*) as count FROM tasks`);
      const [userCount] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const [costCount] = await db.execute(sql`SELECT COUNT(*) as count FROM productionCosts`);
      const [alertCount] = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE \`read\` = 0`);
      const [collCount] = await db.execute(sql`SELECT COUNT(*) as count FROM collection`);
      const [mfgCount] = await db.execute(sql`SELECT COUNT(*) as count FROM manufacturingStages`);

      return {
        production: (prodCount as any)?.[0]?.count || 0,
        sales: (salesCount as any)?.[0]?.count || 0,
        expenses: (expCount as any)?.[0]?.count || 0,
        tasks: (taskCount as any)?.[0]?.count || 0,
        users: (userCount as any)?.[0]?.count || 0,
        costs: (costCount as any)?.[0]?.count || 0,
        unreadAlerts: (alertCount as any)?.[0]?.count || 0,
        collection: (collCount as any)?.[0]?.count || 0,
        manufacturing: (mfgCount as any)?.[0]?.count || 0,
      };
    }),

    // Admin can edit any production entry
    updateProduction: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(productionTable).set(input.data as any).where(eq(productionTable.id, input.id));
        return { success: true };
      }),

    // Admin can edit any task
    updateTask: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(tasksTable).set(input.data as any).where(eq(tasksTable.id, input.id));
        return { success: true };
      }),

    // Admin can edit any sale
    updateSale: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(salesTable).set(input.data as any).where(eq(salesTable.id, input.id));
        return { success: true };
      }),

    // Admin can edit any expense
    updateExpense: publicProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.update(expensesTable).set(input.data as any).where(eq(expensesTable.id, input.id));
        return { success: true };
      }),

    // Admin can delete any entry from any table
    deleteEntry: publicProcedure
      .input(z.object({ table: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629");
        await db.execute(sql`DELETE FROM ${sql.identifier(input.table)} WHERE id = ${input.id}`);
        return { success: true };
      }),
  }),

  // ===== PRODUCT COST CALCULATION ROUTER =====
  productCostCalculation: router({
    create: protectedProcedure
      .input(z.object({
        date: z.string(),
        productName: z.string(),
        productColor: z.string(),
        cottonWeight: z.number().default(0),
        cottonColor: z.string().optional(),
        cottonCode: z.string().optional(),
        bambooWeight: z.number().default(0),
        bambooColor: z.string().optional(),
        bambooCode: z.string().optional(),
        nylonWeight: z.number().default(0),
        nylonColor: z.string().optional(),
        nylonCode: z.string().optional(),
        spanWeight: z.number().default(0),
        spanColor: z.string().optional(),
        spanCode: z.string().optional(),
        spandexWeight: z.number().default(0),
        spandexColor: z.string().optional(),
        spandexCode: z.string().optional(),
        rubberWeight: z.number().default(0),
        rubberColor: z.string().optional(),
        rubberCode: z.string().optional(),
        totalThreadWeight: z.number().default(0),
        notes: z.string().optional(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(productCostCalculation).values(input as any);
        return { success: true, id: (result[0] as any).insertId };
      }),

    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(productCostCalculation).orderBy(desc(productCostCalculation.createdAt));
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(productCostCalculation).where(eq(productCostCalculation.id, input.id)).limit(1);
        return result.length > 0 ? result[0] : null;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(productCostCalculation).where(eq(productCostCalculation.id, input.id));
        return { success: true };
      }),
  }),

  // ===== FINANCIAL / BANK BALANCE ROUTER =====
  financial: router({
    getBankBalance: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bankBalanceTable).orderBy(desc(bankBalanceTable.createdAt));
    }),

    createBankBalance: publicProcedure
      .input(z.object({ amount: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(bankBalanceTable).values(input);
        return { success: true, id: result[0].insertId };
      }),
  }),

  // ===== GOALS & KPIs ROUTER =====
  goalsAndKpis: router({
    // Monthly Goals
    getMonthlyGoals: protectedProcedure
      .input(z.object({ month: z.string(), department: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(monthlyGoalsTable.month, input.month)];
        if (input.department) {
          conditions.push(eq(monthlyGoalsTable.department, input.department));
        }
        return db
          .select()
          .from(monthlyGoalsTable)
          .where(and(...conditions))
          .orderBy(desc(monthlyGoalsTable.createdAt));
      }),

    createMonthlyGoal: adminProcedure
      .input(
        z.object({
          month: z.string(),
          department: z.string(),
          goalType: z.enum(["production", "sales", "quality", "efficiency", "safety", "custom"]),
          goalName: z.string(),
          targetValue: z.number(),
          unit: z.string(),
          weight: z.number().optional(),
          description: z.string().optional(),
          createdBy: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(monthlyGoalsTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateMonthlyGoal: adminProcedure
      .input(
        z.object({
          id: z.number(),
          targetValue: z.number().optional(),
          status: z.enum(["active", "completed", "cancelled"]).optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(monthlyGoalsTable).set(updates).where(eq(monthlyGoalsTable.id, id));
        return { success: true };
      }),

    deleteMonthlyGoal: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(monthlyGoalsTable).where(eq(monthlyGoalsTable.id, input.id));
        return { success: true };
      }),

    // Goal Progress
    getGoalProgress: protectedProcedure
      .input(z.object({ goalId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(goalProgressTable)
          .where(eq(goalProgressTable.goalId, input.goalId))
          .orderBy(desc(goalProgressTable.date));
      }),

    recordGoalProgress: protectedProcedure
      .input(
        z.object({
          goalId: z.number(),
          date: z.string(),
          achievedValue: z.number(),
          percentage: z.number(),
          notes: z.string().optional(),
          recordedBy: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(goalProgressTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    // KPIs
    getKpis: protectedProcedure
      .input(z.object({ month: z.string(), department: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(kpisTable.month, input.month)];
        if (input.department) {
          conditions.push(eq(kpisTable.department, input.department));
        }
        return db
          .select()
          .from(kpisTable)
          .where(and(...conditions))
          .orderBy(desc(kpisTable.createdAt));
      }),

    createKpi: adminProcedure
      .input(
        z.object({
          month: z.string(),
          department: z.string(),
          kpiName: z.string(),
          kpiType: z.enum(["production", "quality", "efficiency", "safety", "financial", "custom"]),
          currentValue: z.number(),
          targetValue: z.number(),
          previousValue: z.number().optional(),
          unit: z.string(),
          status: z.enum(["on_track", "at_risk", "off_track", "exceeded"]).optional(),
          trend: z.enum(["up", "down", "stable"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const kpiData = {
          ...input,
          previousValue: input.previousValue ?? 0,
          status: input.status ?? "on_track",
          trend: input.trend ?? "stable",
          notes: input.notes ?? "",
        };
        const result = await db.insert(kpisTable).values(kpiData);
        return { success: true, id: result[0].insertId };
      }),

    updateKpi: adminProcedure
      .input(
        z.object({
          id: z.number(),
          currentValue: z.number().optional(),
          status: z.enum(["on_track", "at_risk", "off_track", "exceeded"]).optional(),
          trend: z.enum(["up", "down", "stable"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(kpisTable).set(updates).where(eq(kpisTable.id, id));
        return { success: true };
      }),

    deleteKpi: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(kpisTable).where(eq(kpisTable.id, input.id));
        return { success: true };
      }),

    // ===== Admin Management APIs =====
    // Departments Management
    getDepartments: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(departmentsTable);
    }),

    createDepartment: adminProcedure
      .input(z.object({ name: z.string(), nameEn: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(departmentsTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateDepartment: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), isActive: z.number().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(departmentsTable).set(updates).where(eq(departmentsTable.id, id));
        return { success: true };
      }),

    deleteDepartment: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(departmentsTable).where(eq(departmentsTable.id, input.id));
        return { success: true };
      }),

    // Machines Management
    getMachines: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(machinesTable);
    }),

    createMachine: adminProcedure
      .input(z.object({
        machineCode: z.string(),
        machineName: z.string(),
        machineType: z.string().optional(),
        department: z.string(),
        capacity: z.number().optional(),
        installDate: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(machinesTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateMachine: adminProcedure
      .input(z.object({
        id: z.number(),
        machineName: z.string().optional(),
        status: z.enum(["active", "inactive", "maintenance", "retired"]).optional(),
        capacity: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(machinesTable).set(updates).where(eq(machinesTable.id, id));
        return { success: true };
      }),

    deleteMachine: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(machinesTable).where(eq(machinesTable.id, input.id));
        return { success: true };
      }),

    // Production Stages Management
    getProductionStages: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(productionStagesTable);
    }),

    createProductionStage: adminProcedure
      .input(z.object({
        stageName: z.string(),
        stageNameEn: z.string().optional(),
        stageOrder: z.number(),
        department: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(productionStagesTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateProductionStage: adminProcedure
      .input(z.object({
        id: z.number(),
        stageName: z.string().optional(),
        stageOrder: z.number().optional(),
        description: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(productionStagesTable).set(updates).where(eq(productionStagesTable.id, id));
        return { success: true };
      }),

    deleteProductionStage: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(productionStagesTable).where(eq(productionStagesTable.id, input.id));
        return { success: true };
      }),

    // Employee Stage Assignment
    getEmployeeAssignments: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(employeeStageAssignmentTable);
    }),

    assignEmployeeToStage: adminProcedure
      .input(z.object({
        userId: z.number(),
        stageId: z.number(),
        department: z.string(),
        role: z.string().optional(),
        assignedDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(employeeStageAssignmentTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateEmployeeAssignment: adminProcedure
      .input(z.object({
        id: z.number(),
        stageId: z.number().optional(),
        department: z.string().optional(),
        role: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(employeeStageAssignmentTable).set(updates).where(eq(employeeStageAssignmentTable.id, id));
        return { success: true };
      }),

    deleteEmployeeAssignment: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(employeeStageAssignmentTable).where(eq(employeeStageAssignmentTable.id, input.id));
        return { success: true };
      }),

    // Board Representative Data Management
    getBoardRepresentativeData: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(boardRepresentativeDataTable);
    }),

    createBoardData: adminProcedure
      .input(z.object({
        userId: z.number(),
        dataType: z.string(),
        value: z.string(),
        description: z.string().optional(),
        date: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const result = await db.insert(boardRepresentativeDataTable).values(input);
        return { success: true, id: result[0].insertId };
      }),

    updateBoardData: adminProcedure
      .input(z.object({
        id: z.number(),
        value: z.string().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { id, ...updates } = input;
        await db.update(boardRepresentativeDataTable).set(updates).where(eq(boardRepresentativeDataTable.id, id));
        return { success: true };
      }),

    deleteBoardData: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.delete(boardRepresentativeDataTable).where(eq(boardRepresentativeDataTable.id, input.id));
        return { success: true };
      }),

    clearAllBoardData: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      await db.delete(boardRepresentativeDataTable);
      return { success: true };
    }),

    // Audit Log
    getAuditLog: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(auditLogTable).orderBy(desc(auditLogTable.createdAt)).limit(1000);
    }),

    // System Settings
    getSystemSettings: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      return await db.select().from(systemSettingsTable);
    }),

    updateSystemSetting: adminProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const existing = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.settingKey, input.key));
        if (existing.length > 0) {
          await db.update(systemSettingsTable).set({ settingValue: input.value }).where(eq(systemSettingsTable.settingKey, input.key));
        } else {
          await db.insert(systemSettingsTable).values({ settingKey: input.key, settingValue: input.value });
        }
        return { success: true };
      }),
  }),

  // App Version Check
  appVersion: router({
    getLatest: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { version: "1.0.0", buildNumber: 1, downloadUrl: "", releaseNotes: "", forceUpdate: false };
      try {
        const result = await db.execute(`SELECT value FROM app_settings WHERE \`key\` = 'app_version' LIMIT 1`);
        const rows = result as any[];
        if (rows && rows.length > 0) {
          return JSON.parse(rows[0].value);
        }
      } catch (e) {
        // Table might not exist yet
      }
      return {
        version: "1.0.0",
        buildNumber: 1,
        downloadUrl: "",
        releaseNotes: "",
        forceUpdate: false,
      };
    }),
    setLatest: adminProcedure
      .input(z.object({
        version: z.string(),
        buildNumber: z.number(),
        downloadUrl: z.string(),
        releaseNotes: z.string().optional(),
        forceUpdate: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const value = JSON.stringify(input);
        await db.execute(`INSERT INTO app_settings (\`key\`, value) VALUES ('app_version', '${value}') ON CONFLICT (\`key\`) DO UPDATE SET value = '${value}'`);
        return { success: true };
      }),
  }),

  // ========== Meetings ==========
  meetings: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(meetingsTable).orderBy(desc(meetingsTable.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        meetingNumber: z.number(),
        title: z.string(),
        date: z.string(),
        time: z.string().optional(),
        location: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        requestedBy: z.string().optional(),
        attendees: z.any().optional(),
        agenda: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(meetingsTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(meetingsTable).set(input.data).where(eq(meetingsTable.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(meetingsTable).where(eq(meetingsTable.id, input.id));
        return { success: true };
      }),
    getNextNumber: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return 1;
      const result = await db.select({ max: sql`MAX(meetingNumber)` }).from(meetingsTable);
      return ((result[0]?.max as number) || 0) + 1;
    }),
  }),

  // ========== Meeting Outputs ==========
  meetingOutputs: router({
    list: protectedProcedure
      .input(z.object({ meetingId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.meetingId) {
          return db.select().from(meetingOutputsTable).where(eq(meetingOutputsTable.meetingId, input.meetingId));
        }
        return db.select().from(meetingOutputsTable).orderBy(desc(meetingOutputsTable.createdAt));
      }),
    create: protectedProcedure
      .input(z.object({
        meetingId: z.number(),
        description: z.string(),
        assignedTo: z.string().optional(),
        deadline: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(meetingOutputsTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(meetingOutputsTable).set(input.data).where(eq(meetingOutputsTable.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(meetingOutputsTable).where(eq(meetingOutputsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ========== Manufacturing Workers ==========
  manufacturingWorkers: router({
    list: protectedProcedure
      .input(z.object({ stageId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.stageId) {
          return db.select().from(manufacturingWorkersTable).where(eq(manufacturingWorkersTable.stageId, input.stageId)).orderBy(manufacturingWorkersTable.sortOrder);
        }
        return db.select().from(manufacturingWorkersTable).orderBy(manufacturingWorkersTable.stageId, manufacturingWorkersTable.sortOrder);
      }),
    create: protectedProcedure
      .input(z.object({
        stageId: z.string(),
        workerName: z.string(),
        role: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(manufacturingWorkersTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(manufacturingWorkersTable).set(input.data).where(eq(manufacturingWorkersTable.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(manufacturingWorkersTable).where(eq(manufacturingWorkersTable.id, input.id));
        return { success: true };
      }),
    bulkSet: adminProcedure
      .input(z.object({
        stageId: z.string(),
        workers: z.array(z.object({ workerName: z.string(), role: z.string().optional() })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(manufacturingWorkersTable).where(eq(manufacturingWorkersTable.stageId, input.stageId));
        if (input.workers.length > 0) {
          const values = input.workers.map((w, i) => ({ stageId: input.stageId, workerName: w.workerName, role: w.role || null, sortOrder: i }));
          await db.insert(manufacturingWorkersTable).values(values as any);
        }
        return { success: true };
      }),
  }),

  // ========== Financial Reports ==========
  financialReports: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(financialReportsTable).orderBy(desc(financialReportsTable.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
        revenue: z.number().optional(),
        expenses: z.number().optional(),
        netProfit: z.number().optional(),
        category: z.string().optional(),
        details: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(financialReportsTable).values(input as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(financialReportsTable).where(eq(financialReportsTable.id, input.id));
        return { success: true };
      }),
    clearAll: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(financialReportsTable);
      return { success: true };
    }),
  }),

  // ========== Production Costs ==========
  productionCostsLocal: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(localProductionCostsTable).orderBy(desc(localProductionCostsTable.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        date: z.string(),
        category: z.string(),
        description: z.string().optional(),
        amount: z.number().optional(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(localProductionCostsTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(localProductionCostsTable).set(input.data).where(eq(localProductionCostsTable.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(localProductionCostsTable).where(eq(localProductionCostsTable.id, input.id));
        return { success: true };
      }),
    clearAll: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(localProductionCostsTable);
      return { success: true };
    }),
  }),

  // ========== Saved Product Costs ==========
  savedProductCosts: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(savedProductCostsTable).orderBy(desc(savedProductCostsTable.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        productName: z.string(),
        date: z.string(),
        threadData: z.any(),
        totalCost: z.number().optional(),
        notes: z.string().optional(),
        createdBy: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(savedProductCostsTable).values(input as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(savedProductCostsTable).where(eq(savedProductCostsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ========== Government Tenders ==========
  governmentTenders: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(governmentTendersTable).orderBy(desc(governmentTendersTable.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        organization: z.string().optional(),
        deadline: z.string().optional(),
        value: z.number().optional(),
        status: z.string().optional(),
        description: z.string().optional(),
        requirements: z.string().optional(),
        attachments: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(governmentTendersTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(governmentTendersTable).set(input.data).where(eq(governmentTendersTable.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(governmentTendersTable).where(eq(governmentTendersTable.id, input.id));
        return { success: true };
      }),
  }),

  // ========== Waste Thresholds & Alerts ==========
  wasteManagement: router({
    getThresholds: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(wasteThresholdsTable);
    }),
    setThreshold: adminProcedure
      .input(z.object({
        metricKey: z.string(),
        metricName: z.string(),
        threshold: z.number(),
        unit: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const existing = await db.select().from(wasteThresholdsTable).where(eq(wasteThresholdsTable.metricKey, input.metricKey)).limit(1);
        if (existing.length > 0) {
          await db.update(wasteThresholdsTable).set({ threshold: input.threshold, metricName: input.metricName, unit: input.unit }).where(eq(wasteThresholdsTable.metricKey, input.metricKey));
        } else {
          await db.insert(wasteThresholdsTable).values(input as any);
        }
        return { success: true };
      }),
    getAlerts: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.unreadOnly) {
          return db.select().from(wasteAlertsTable).where(eq(wasteAlertsTable.isRead, 0)).orderBy(desc(wasteAlertsTable.createdAt));
        }
        return db.select().from(wasteAlertsTable).orderBy(desc(wasteAlertsTable.createdAt));
      }),
    createAlert: protectedProcedure
      .input(z.object({
        metricKey: z.string(),
        message: z.string(),
        severity: z.string().optional(),
        machineNumber: z.string().optional(),
        value: z.number().optional(),
        threshold: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(wasteAlertsTable).values(input as any);
        return { success: true };
      }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(wasteAlertsTable).set({ isRead: 1 }).where(eq(wasteAlertsTable.id, input.id));
        return { success: true };
      }),
    clearAlerts: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(wasteAlertsTable);
      return { success: true };
    }),
  }),

  // ========== Board Representative Data (Server) ==========
  boardData: router({
    getAll: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(boardRepresentativeDataTable).orderBy(desc(boardRepresentativeDataTable.createdAt));
    }),
    save: protectedProcedure
      .input(z.object({
        userId: z.number(),
        dataType: z.string(),
        value: z.string(),
        description: z.string().optional(),
        date: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(boardRepresentativeDataTable).values(input as any);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), value: z.string().optional(), description: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const { id, ...updateData } = input;
        const filtered = Object.fromEntries(Object.entries(updateData).filter(([_, v]) => v !== undefined));
        if (Object.keys(filtered).length > 0) {
          await db.update(boardRepresentativeDataTable).set(filtered).where(eq(boardRepresentativeDataTable.id, id));
        }
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(boardRepresentativeDataTable).where(eq(boardRepresentativeDataTable.id, input.id));
        return { success: true };
      }),
    clear: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(boardRepresentativeDataTable);
      return { success: true };
    }),
  }),

  // ========== App Settings (Key-Value) ==========
  appSettings: router({
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, input.key)).limit(1);
        return result.length > 0 ? result[0].value : null;
      }),
    set: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, input.key)).limit(1);
        if (existing.length > 0) {
          await db.update(appSettingsTable).set({ value: input.value }).where(eq(appSettingsTable.key, input.key));
        } else {
          await db.insert(appSettingsTable).values({ key: input.key, value: input.value });
        }
        return { success: true };
      }),
    getAll: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(appSettingsTable);
    }),
  }),
});

export type AppRouter = typeof appRouter;
