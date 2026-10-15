import { index, int, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * V2 sample-request aggregate. The JSON payload is an append-only event
 * journal and immutable product-specification snapshot; legacy sampleRequests
 * remain deliberately untouched.
 */
export const custodySampleOrders = mysqlTable("custodySampleOrders", {
  id: int("id").autoincrement().primaryKey(),
  referenceCode: varchar("referenceCode", { length: 48 }).notNull().unique(),
  requesterId: int("requesterId").notNull(),
  payload: json("payload").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("intake"),
  batchId: varchar("batchId", { length: 36 }),
  version: int("version").notNull().default(1),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index("custodySampleOrders_requester_idx").on(table.requesterId),
  index("custodySampleOrders_status_idx").on(table.status),
  index("custodySampleOrders_batch_idx").on(table.batchId),
]);

export type CustodySampleOrderRow = typeof custodySampleOrders.$inferSelect;
export type InsertCustodySampleOrder = typeof custodySampleOrders.$inferInsert;
