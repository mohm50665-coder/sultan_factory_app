import { trpc } from "@/lib/trpc";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone: string;
  position: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  role: "user" | "admin";
}

/**
 * خدمة المصادقة والتسجيل
 */
export const authService = {
  /**
   * تسجيل دخول المستخدم
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error("فشل تسجيل الدخول");
      }

      return response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * تسجيل مستخدم جديد
   */
  async register(credentials: RegisterCredentials): Promise<{ user: User; token: string }> {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error("فشل التسجيل");
      }

      return response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * تسجيل الخروج
   */
  async logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("خطأ في تسجيل الخروج:", error);
    }
  },

  /**
   * الحصول على بيانات المستخدم الحالي
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      return null;
    }
  },

  /**
   * طلب استعادة كلمة المرور
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("فشل الطلب");
      }
    } catch (error) {
      throw error;
    }
  },
};
