import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Auth from "@/lib/_core/auth";

const SESSION_STORAGE_KEY = "sultan_session_id";

/**
 * tRPC React client for type-safe API calls.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const headers: Record<string, string> = {};
          
          // Send x-session-id for custom auth (username/password login)
          try {
            const sessionId = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionId) {
              headers["x-session-id"] = sessionId;
            }
          } catch {}
          
          // Also try OAuth token for native platforms
          try {
            const token = await Auth.getSessionToken();
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
          } catch {}
          
          return headers;
        },
        // Custom fetch to include credentials for cookie-based auth (web)
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
