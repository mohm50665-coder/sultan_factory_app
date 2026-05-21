import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService, type User } from "./services/auth.service";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, position: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (name: string, email: string, phone: string, position: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // التحقق من المستخدم عند بدء التطبيق
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      // محاولة الحصول على المستخدم من التخزين المحلي
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("فشل في استعادة المستخدم:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authService.login({ email, password });
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem("user", JSON.stringify(result.user));
      }
    } catch (error) {
      console.error("خطأ في تسجيل الدخول:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    position: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const result = await authService.register({
        name,
        email,
        phone,
        position,
        password,
      });
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem("user", JSON.stringify(result.user));
      }
    } catch (error) {
      console.error("خطأ في التسجيل:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = register;

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      await AsyncStorage.removeItem("user");
    } catch (error) {
      console.error("خطأ في تسجيل الخروج:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isSignedIn: !!user,
    login,
    register,
    logout,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth يجب أن يكون مستخدماً داخل AuthProvider");
  }
  return context;
}
