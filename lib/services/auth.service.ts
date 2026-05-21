import { trpc } from "@/lib/trpc";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  role: string;
}

/**
 * خدمة المصادقة والتسجيل
 * تستخدم tRPC للاتصال بالسيرفر
 */
export const authService = {
  /**
   * تسجيل دخول المستخدم
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; user: User }> {
    try {
      const result = await trpc.auth.login.mutate(credentials);
      return result;
    } catch (error) {
      console.error("خطأ في تسجيل الدخول:", error);
      throw new Error("فشل تسجيل الدخول");
    }
  },

  /**
   * تسجيل مستخدم جديد
   */
  async register(credentials: RegisterCredentials): Promise<{ success: boolean; user: User }> {
    try {
      const result = await trpc.auth.register.mutate(credentials);
      return result;
    } catch (error) {
      console.error("خطأ في التسجيل:", error);
      throw new Error("فشل التسجيل");
    }
  },

  /**
   * تسجيل الخروج
   */
  async logout(): Promise<void> {
    try {
      await trpc.auth.logout.mutate();
    } catch (error) {
      console.error("خطأ في تسجيل الخروج:", error);
    }
  },

  /**
   * الحصول على بيانات المستخدم الحالي
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await trpc.auth.me.query();
      return user || null;
    } catch (error) {
      console.error("خطأ في الحصول على بيانات المستخدم:", error);
      return null;
    }
  },

  /**
   * طلب استعادة كلمة المرور
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await trpc.auth.requestPasswordReset.mutate({ email });
    } catch (error) {
      console.error("خطأ في طلب استعادة كلمة المرور:", error);
      throw new Error("فشل الطلب");
    }
  },
};
