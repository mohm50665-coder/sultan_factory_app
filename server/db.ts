import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _schemaReady: Promise<void> | null = null;

/**
 * The first migration used by the project created only the original OAuth
 * columns. The current registration flow also needs the username/password
 * and employee-management columns. Add only missing columns at startup so
 * existing data is preserved and old installations self-heal.
 */
async function ensureUsersSchema(db: NonNullable<ReturnType<typeof drizzle>>) {
  const [rows] = await db.execute(sql`
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
  `);

  const existing = new Set(
    (rows as unknown as Array<{ columnName?: string; COLUMN_NAME?: string }>).map(
      (row) => row.columnName ?? row.COLUMN_NAME,
    ),
  );

  const missingColumns: Record<string, string> = {
    username: "VARCHAR(100) NULL",
    phone: "VARCHAR(20) NULL",
    position: "VARCHAR(255) NULL",
    department: "VARCHAR(100) NULL",
    password: "VARCHAR(255) NULL",
    isActive: "INT NOT NULL DEFAULT 0",
    allowedSections: "JSON NULL",
    toolPermissions: "JSON NULL",
  };

  for (const [column, definition] of Object.entries(missingColumns)) {
    if (!existing.has(column)) {
      await db.execute(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${column}\` ${definition}`));
      console.log(`[Database] Added missing users.${column} column`);
    }
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      _schemaReady = ensureUsersSchema(_db).catch((error) => {
        console.error("[Database] Users schema migration failed:", error);
        throw error;
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _schemaReady = null;
    }
  }
  if (_db && _schemaReady) await _schemaReady;
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: Partial<InsertUser> = {
      openId: user.openId,
      name: user.name,
      email: user.email,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as Record<string, unknown>)[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values as InsertUser).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
