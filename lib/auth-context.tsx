import React, { createContext, useContext, useState, useEffect } from "react";
import { simpleAuthService, type User } from "./services/simple-auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, phone: string, position: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (name: string, username: string, phone: string, position: string, password: string) => Promise<void>;
  updateProfile: (data: { name?: string; username?: string; phone?: string; position?: string }) => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const currentUser = await simpleAuthService.getCurrentUser();
      setUser(currentUser);
    } catch (e) {
      console.error("Failed to restore user:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await simpleAuthService.login(username, password);
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تسجيل الدخول";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    username: string,
    phone: string,
    position: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await simpleAuthService.register({
        name,
        username,
        phone,
        position,
        password,
      });
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل التسجيل";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = register;

  const logout = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await simpleAuthService.logout();
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تسجيل الخروج";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: { name?: string; username?: string; phone?: string; position?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await simpleAuthService.updateProfile(data);
      setUser(updatedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحديث البيانات";
      setError(message);
      throw err;
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
    updateProfile,
    error,
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
