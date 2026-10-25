import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiBaseUrl } from "@/constants/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearLocalSession,
  getLocalSessionId,
  persistLocalSessionForUser,
  USER_STORAGE_KEY,
} from "@/lib/local-session";

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  role: "user" | "admin" | "manager" | "supervisor";
  isActive: number;
  allowedSections?: string[] | null;
  toolPermissions?: Record<string, boolean> | null;
  createdAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, phone: string, position: string, department: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (name: string, username: string, email: string, phone: string, position: string, department: string, password: string) => Promise<void>;
  updateProfile: (data: { name?: string; username?: string; phone?: string; position?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function apiCall(endpoint: string, body: any, method: "query" | "mutation" = "mutation") {
  const baseUrl = getApiBaseUrl();
  const sessionId = await getLocalSessionId();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  let url = `${baseUrl}/api/trpc/${endpoint}`;
  let options: RequestInit;

  if (method === "query") {
    // For superjson queries, wrap input in {json: ...}
    if (body !== undefined) {
      const input = encodeURIComponent(JSON.stringify({ json: body }));
      url += `?input=${input}`;
    }
    options = { method: "GET", headers };
  } else {
    // For superjson mutations, wrap body in {json: ...}
    options = {
      method: "POST",
      headers,
      body: JSON.stringify({ json: body }),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    // Web serves the app and API from different subdomains. Keep the cookie
    // issued by auth.login; x-session-id remains the mobile fallback.
    response = await fetch(url, { ...options, credentials: "include", signal: controller.signal });
  } catch (requestError) {
    if (requestError instanceof DOMException && requestError.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال بالخادم. تحقق من الاتصال بالإنترنت وحاول مرة أخرى.");
    }
    throw new Error("تعذر الاتصال بالخادم. حاول مرة أخرى.");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();
  
  if (data.error) {
    const rawMessage = data.error?.json?.message || data.error?.message || "حدث خطأ";
    const hasSensitiveDatabaseDetails = /failed query|insert into|select .* from|update .* set|delete from|mysql|sql/i.test(rawMessage);
    const errMsg = hasSensitiveDatabaseDetails
      ? "تعذر تنفيذ العملية حالياً. يرجى المحاولة مرة أخرى أو التواصل مع المدير."
      : rawMessage;
    throw new Error(errMsg);
  }
  
  // superjson wraps response in {result: {data: {json: ...}}}
  return data.result?.data?.json;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Incremented whenever the local session is replaced or cleared. A delayed
  // auth.me response from an earlier session must never restore a logged-out
  // account, especially on the web where requests can complete out of order.
  const sessionGeneration = React.useRef(0);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        // Older application versions saved only the profile. Restore the
        // missing session key before report screens start their API requests.
        await persistLocalSessionForUser(parsed);
      }
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
      const result = await apiCall("auth.login", { username, password });
      if (result?.user) {
        sessionGeneration.current += 1;
        setUser(result.user);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
        await persistLocalSessionForUser(result.user);
      }
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
    email: string,
    phone: string,
    position: string,
    department: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiCall("auth.register", { name, username, email, phone, position, department, password });
      // لا يتم تسجيل الدخول تلقائياً - الحساب يحتاج تفعيل من الأدمن
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
    // Invalidate already running refreshUser calls before clearing state.
    sessionGeneration.current += 1;
    setUser(null);
    try {
      // This also expires the HTTP-only session cookie used by the web app.
      // The local cleanup in finally remains authoritative for mobile and for
      // offline/logout requests whose server call cannot complete.
      await apiCall("auth.logout", undefined);
    } catch (err) {
      // Logging out locally must still succeed when the server is unreachable.
      console.warn("Server session could not be cleared during logout:", err);
    } finally {
      await clearLocalSession();
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: { name?: string; username?: string; phone?: string; position?: string }) => {
    // For now, update locally
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const refreshUser = async () => {
    const generationAtRequest = sessionGeneration.current;
    try {
      const result = await apiCall("auth.me", undefined, "query");
      if (result && generationAtRequest === sessionGeneration.current) {
        setUser(result);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result));
      }
    } catch (e) {
      if (generationAtRequest !== sessionGeneration.current) return;
      // Fallback to stored data
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
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
    refreshUser,
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
