import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db.js";
import { users as usersTable } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const COOKIE_NAME = "session_id";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "الاسم مطلوب"),
          email: z.string().email("البريد الإلكتروني غير صحيح"),
          phone: z.string().optional(),
          position: z.string().optional(),
          password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) {
            throw new Error("قاعدة البيانات غير متاحة");
          }

          // التحقق من عدم وجود المستخدم
          const existingUser = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, input.email))
            .limit(1);

          if (existingUser.length > 0) {
            throw new Error("البريد الإلكتروني مستخدم بالفعل");
          }

          // إنشاء openId فريد
          const openId = randomUUID();

          // إنشاء مستخدم جديد
          await db.insert(usersTable).values({
            openId: openId,
            name: input.name,
            email: input.email,
            phone: input.phone || null,
            position: input.position || null,
            password: input.password,
            role: "user",
          });

          // الحصول على المستخدم المنشأ
          const newUserResult = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, input.email))
            .limit(1);

          const newUser = newUserResult[0];

          // إنشاء جلسة
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, newUser.id.toString(), cookieOptions);

          return {
            success: true,
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              phone: newUser.phone,
              position: newUser.position,
              role: newUser.role || "user",
            },
          };
        } catch (error) {
          throw new Error("فشل التسجيل: " + (error as Error).message);
        }
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("البريد الإلكتروني غير صحيح"),
          password: z.string().min(1, "كلمة المرور مطلوبة"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) {
            throw new Error("قاعدة البيانات غير متاحة");
          }

          // البحث عن المستخدم
          const result = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, input.email))
            .limit(1);

          const user = result[0];

          if (!user || user.password !== input.password) {
            throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          }

          // إنشاء جلسة
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, user.id.toString(), cookieOptions);

          return {
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              position: user.position,
              role: user.role || "user",
            },
          };
        } catch (error) {
          throw new Error("فشل تسجيل الدخول: " + (error as Error).message);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
