import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 255 }),
  password: varchar("password", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول الإنتاج
export const production = mysqlTable("production", {
  id: int("id").autoincrement().primaryKey(),
  machineNumber: varchar("machineNumber", { length: 50 }).notNull(),
  quantityDozen: int("quantityDozen").default(0),
  quantityPair: int("quantityPair").default(0),
  wasteThreadsGrams: int("wasteThreadsGrams").default(0),
  wasteDefectiveSocksGrams: int("wasteDefectiveSocksGrams").default(0),
  secondGradePair: int("secondGradePair").default(0),
  secondGradeGrams: int("secondGradeGrams").default(0),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Production = typeof production.$inferSelect;
export type InsertProduction = typeof production.$inferInsert;

// جدول مراحل التصنيع
export const manufacturingStages = mysqlTable("manufacturingStages", {
  id: int("id").autoincrement().primaryKey(),
  stageName: varchar("stageName", { length: 100 }).notNull(),
  workerName: varchar("workerName", { length: 255 }).notNull(),
  quantityDozen: int("quantityDozen").default(0),
  quantityPair: int("quantityPair").default(0),
  productType: varchar("productType", { length: 100 }),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManufacturingStage = typeof manufacturingStages.$inferSelect;
export type InsertManufacturingStage = typeof manufacturingStages.$inferInsert;

// جدول المبيعات
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  sellerName: varchar("sellerName", { length: 255 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  quantityDozen: int("quantityDozen").default(0),
  quantityPair: int("quantityPair").default(0),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "credit"]).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// جدول التحصيل
export const collection = mysqlTable("collection", {
  id: int("id").autoincrement().primaryKey(),
  collectorName: varchar("collectorName", { length: 255 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  amount: int("amount").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Collection = typeof collection.$inferSelect;
export type InsertCollection = typeof collection.$inferInsert;

// جدول مستودعات المواد الخام
export const rawMaterials = mysqlTable("rawMaterials", {
  id: int("id").autoincrement().primaryKey(),
  materialName: varchar("materialName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  dataEnteredBy: varchar("dataEnteredBy", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RawMaterial = typeof rawMaterials.$inferSelect;
export type InsertRawMaterial = typeof rawMaterials.$inferInsert;

// جدول مواد الصرف
export const materialConsumption = mysqlTable("materialConsumption", {
  id: int("id").autoincrement().primaryKey(),
  materialType: varchar("materialType", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unit: mysqlEnum("unit", ["kilo", "gram", "piece", "carton"]).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialConsumption = typeof materialConsumption.$inferSelect;
export type InsertMaterialConsumption = typeof materialConsumption.$inferInsert;

// جدول المواد المدخلة
export const incomingMaterials = mysqlTable("incomingMaterials", {
  id: int("id").autoincrement().primaryKey(),
  materialType: varchar("materialType", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unit: mysqlEnum("unit", ["kilo", "gram", "piece", "carton"]).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IncomingMaterial = typeof incomingMaterials.$inferSelect;
export type InsertIncomingMaterial = typeof incomingMaterials.$inferInsert;

// جدول الإجراءات الإدارية
export const administrativeProcedures = mysqlTable("administrativeProcedures", {
  id: int("id").autoincrement().primaryKey(),
  enteredBy: varchar("enteredBy", { length: 255 }).notNull(),
  workDetails: text("workDetails").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdministrativeProcedure = typeof administrativeProcedures.$inferSelect;
export type InsertAdministrativeProcedure = typeof administrativeProcedures.$inferInsert;

// جدول رصيد البنك
export const bankBalance = mysqlTable("bankBalance", {
  id: int("id").autoincrement().primaryKey(),
  amount: int("amount").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BankBalance = typeof bankBalance.$inferSelect;
export type InsertBankBalance = typeof bankBalance.$inferInsert;

// جدول المصاريف
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  amount: int("amount").notNull(),
  expenseDetails: text("expenseDetails").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["bankTransfer", "cash", "cardHaydar", "cardDirector"]).notNull(),
  requiresApproval: int("requiresApproval").default(0),
  approvedBy: varchar("approvedBy", { length: 255 }),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// جدول الأجهزة المصانة
export const maintainedEquipment = mysqlTable("maintainedEquipment", {
  id: int("id").autoincrement().primaryKey(),
  equipmentName: varchar("equipmentName", { length: 255 }).notNull(),
  maintenanceDate: timestamp("maintenanceDate").notNull(),
  maintenanceDetails: text("maintenanceDetails").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintainedEquipment = typeof maintainedEquipment.$inferSelect;
export type InsertMaintainedEquipment = typeof maintainedEquipment.$inferInsert;

// جدول الأجهزة المتوقفة
export const stoppedEquipment = mysqlTable("stoppedEquipment", {
  id: int("id").autoincrement().primaryKey(),
  equipmentName: varchar("equipmentName", { length: 255 }).notNull(),
  stoppageDate: timestamp("stoppageDate").notNull(),
  stoppageReason: text("stoppageReason").notNull(),
  solutionProcedures: text("solutionProcedures").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoppedEquipment = typeof stoppedEquipment.$inferSelect;
export type InsertStoppedEquipment = typeof stoppedEquipment.$inferInsert;

// جدول توصيات الصيانة
export const maintenanceRecommendations = mysqlTable("maintenanceRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  recommendations: text("recommendations").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceRecommendation = typeof maintenanceRecommendations.$inferSelect;
export type InsertMaintenanceRecommendation = typeof maintenanceRecommendations.$inferInsert;

// جدول المهام
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  taskDescription: text("taskDescription").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["pending", "inProgress", "completed"]).default("pending").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// جدول الصلاحيات
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  section: varchar("section", { length: 100 }).notNull(),
  canView: int("canView").default(1),
  canAdd: int("canAdd").default(0),
  canEdit: int("canEdit").default(0),
  canDelete: int("canDelete").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;
