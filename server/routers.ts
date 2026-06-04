import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
} from "../drizzle/schema.js";
import { eq, desc, sql } from "drizzle-orm";
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

        await db.insert(usersTable).values({
          openId,
          name: input.name,
          username: input.username,
          email: input.username + "@sultan.local",
          phone: input.phone || null,
          position: input.position || null,
          department: input.department || null,
          password: input.password,
          role: "user",
          isActive: 0,
        });

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
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(usersTable).set({ role: input.role }).where(eq(usersTable.id, input.userId));
        return { success: true };
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
});

export type AppRouter = typeof appRouter;
