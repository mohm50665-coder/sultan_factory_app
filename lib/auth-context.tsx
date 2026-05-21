import React, { createContext, useContext, useEffect, useState } from "react";
import { simpleAuthService, type User } from "./services/simple-auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, position: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (name: string, email: string, phone: string, position: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await simpleAuthService.login(email, password);
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
    email: string,
    phone: string,
    position: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await simpleAuthService.register({
        name,
        email,
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

  const value: AuthContextType = {
    user,
    isLoading,
    isSignedIn: !!user,
    login,
    register,
    logout,
    signUp,
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
