import { index, int, json, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/**
 * V2 aggregate storage. `payload` is the immutable-snapshot aggregate projection;
 * normalized append-only rows below are the audit/read model. No V2 table is deleted
 * or rewritten to erase history.
 */
export const custodyBatches = mysqlTable("custodyBatches", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trackingNumber: varchar("trackingNumber", { length: 80 }).notNull().unique(),
  productionId: int("productionId"),
  /** Read-only legacy manufacturingStages identity for one-time opening-balance migration. */
  legacySourceKey: varchar("legacySourceKey", { length: 100 }).unique(),
  version: int("version").notNull().default(1),
  payload: json("payload").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
}, (table) => [index("custodyBatches_productionId_idx").on(table.productionId)]);

/** An actor-scoped idempotency key plus request hash prevents divergent replays. */
export const custodyOperations = mysqlTable("custodyOperations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  operationKey: varchar("operationKey", { length: 128 }).notNull(),
  actorId: int("actorId").notNull(),
  requestHash: varchar("requestHash", { length: 64 }).notNull(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  result: json("result").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [
  unique("custodyOperations_actor_operation_uq").on(table.actorId, table.operationKey),
  index("custodyOperations_batch_idx").on(table.batchId),
]);

/** Append-only event journal. `sequence` makes the history deterministic per aggregate. */
export const custodyEvents = mysqlTable("custodyEvents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  custodyId: varchar("custodyId", { length: 36 }),
  transferId: varchar("transferId", { length: 36 }),
  sessionId: varchar("sessionId", { length: 36 }),
  progressId: varchar("progressId", { length: 36 }),
  disposalId: varchar("disposalId", { length: 36 }),
  sequence: int("sequence").notNull(),
  actorId: int("actorId").notNull(),
  actorName: varchar("actorName", { length: 255 }).notNull(),
  stage: varchar("stage", { length: 40 }),
  action: varchar("action", { length: 80 }).notNull(),
  pairs: int("pairs"),
  reason: text("reason"),
  before: json("before"),
  after: json("after"),
  payload: json("payload"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [
  unique("custodyEvents_batch_sequence_uq").on(table.batchId, table.sequence),
  index("custodyEvents_batch_created_idx").on(table.batchId, table.createdAt),
  index("custodyEvents_custody_idx").on(table.custodyId),
]);

/** One open manual worker session globally; released only by pause/complete. */
export const custodyWorkerLocks = mysqlTable("custodyWorkerLocks", {
  userId: int("userId").primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  custodyId: varchar("custodyId", { length: 36 }).notNull(),
  acquiredAt: timestamp("acquiredAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
}, (table) => [index("custodyWorkerLocks_batch_idx").on(table.batchId)]);

/** Final-storage evidence: exactly one row per received storage custody. */
export const custodyInventory = mysqlTable("custodyInventory", {
  id: varchar("id", { length: 36 }).primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  custodyId: varchar("custodyId", { length: 36 }).notNull().unique(),
  barcode: varchar("barcode", { length: 128 }).notNull(),
  productCode: varchar("productCode", { length: 100 }).notNull(),
  productSize: varchar("productSize", { length: 100 }).notNull(),
  productColor: varchar("productColor", { length: 100 }).notNull(),
  quality: varchar("quality", { length: 20 }).notNull(),
  packagePairs: int("packagePairs").notNull(),
  pairs: int("pairs").notNull(),
  storedBy: int("storedBy").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  // Same barcode is permitted for package updates only when the product/quality identity agrees;
  // service validates this before write. This index makes lookup deterministic without forbidding
  // multiple physical lots in a barcode family.
  index("custodyInventory_barcode_idx").on(table.barcode),
  index("custodyInventory_batch_idx").on(table.batchId),
]);

/** Singleton V2 timing/schedule configuration. Defaults are intentionally not guessed. */
export const custodySettings = mysqlTable("custodySettings", {
  id: int("id").primaryKey(),
  payload: json("payload").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 128 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type CustodyBatchRow = typeof custodyBatches.$inferSelect;
export type CustodyOperationRow = typeof custodyOperations.$inferSelect;
export type CustodyEventRow = typeof custodyEvents.$inferSelect;
export type CustodyWorkerLockRow = typeof custodyWorkerLocks.$inferSelect;
export type CustodyInventoryRow = typeof custodyInventory.$inferSelect;
export type CustodySettingsRow = typeof custodySettings.$inferSelect;
