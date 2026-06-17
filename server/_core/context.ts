import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getDb } from "../db.js";
import { users as usersTable } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Get user from session_id cookie or x-session-id header.
 * This supports the custom auth system (username/password login).
 */
async function getUserFromSession(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    // Try cookie first
    const cookies = req.headers.cookie || "";
    const cookieMatch = cookies.match(/session_id=([^;]+)/);
    const sessionIdFromCookie = cookieMatch ? cookieMatch[1] : undefined;
    
    // Try x-session-id header (for mobile)
    const sessionIdFromHeader = req.headers['x-session-id'] as string | undefined;
    
    const sessionId = sessionIdFromCookie || sessionIdFromHeader;
    if (!sessionId) return null;
    
    const userId = parseInt(sessionId);
    if (isNaN(userId)) return null;
    
    const db = await getDb();
    if (!db) return null;
    
    const result = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch {
    return null;
  }
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  // First try custom session auth (username/password login)
  user = await getUserFromSession(opts.req);
  
  // Fallback to SDK OAuth auth if custom session not found
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
