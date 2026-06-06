import { mysqlTable, int, varchar, text, timestamp, json, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 255 }),
  department: varchar("department", { length: 100 }),
  password: varchar("password", { length: 255 }).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: int("isActive").default(0).notNull(),
  allowedSections: json("allowedSections"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول الإنتاج - صف واحد لكل مكينة في كل يوم
export const production = mysqlTable("production", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 20 }).notNull(),
  machineNumber: varchar("machineNumber", { length: 50 }).notNull(),
  productName: varchar("productName", { length: 100 }).default(""),
  shiftNumber: int("shiftNumber").default(1),
  shiftStart: varchar("shiftStart", { length: 10 }).default(""),
  shiftEnd: varchar("shiftEnd", { length: 10 }).default(""),
  productionDozen: int("productionDozen").default(0),
  productionPairs: int("productionPairs").default(0),
  wasteThreadGrams: int("wasteThreadGrams").default(0),
  wasteSocksGrams: int("wasteSocksGrams").default(0),
  secondGradeDozen: int("secondGradeDozen").default(0),
  secondGradePairs: int("secondGradePairs").default(0),
  wasteNeedles: int("wasteNeedles").default(0),
  productionHours: int("productionHours").default(0),
  productionMinutes: int("productionMinutes").default(0),
  yarnRubber: int("yarnRubber").default(0),
  yarnSpandex: int("yarnSpandex").default(0),
  yarnNylon: int("yarnNylon").default(0),
  yarnCotton: int("yarnCotton").default(0),
  yarnBamboo: int("yarnBamboo").default(0),
  yarnSpan: int("yarnSpan").default(0),
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
  productName: varchar("productName", { length: 255 }).default(""),
  date: varchar("date", { length: 20 }).default(""),
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
  customerCategory: varchar("customerCategory", { length: 100 }),
  quantityDozen: int("quantityDozen").default(0),
  quantityPair: int("quantityPair").default(0),
  amount: varchar("amount", { length: 50 }).default("0"),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  invoiceDate: varchar("invoiceDate", { length: 50 }),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "credit", "deferred"]).notNull(),
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
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  receiptDate: varchar("receiptDate", { length: 50 }),
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
  referenceNumber: varchar("referenceNumber", { length: 50 }),
  submissionDate: timestamp("submissionDate"),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  employeeNumber: varchar("employeeNumber", { length: 50 }),
  department: varchar("department", { length: 100 }),
  requestType: varchar("requestType", { length: 100 }).notNull(),
  requestDetails: text("requestDetails").notNull(),
  attachments: json("attachments"),
  boardRepStatus: mysqlEnum("boardRepStatus", ["pending", "approved", "rejected"]).default("pending"),
  boardRepRejectionReason: text("boardRepRejectionReason"),
  boardRepActionDate: timestamp("boardRepActionDate"),
  directManagerStatus: mysqlEnum("directManagerStatus", ["pending", "approved", "rejected"]).default("pending"),
  directManagerRejectionReason: text("directManagerRejectionReason"),
  directManagerActionDate: timestamp("directManagerActionDate"),
  generalManagerStatus: mysqlEnum("generalManagerStatus", ["pending", "approved", "rejected"]).default("pending"),
  generalManagerRejectionReason: text("generalManagerRejectionReason"),
  generalManagerActionDate: timestamp("generalManagerActionDate"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
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
  stopDate: timestamp("stopDate").notNull(),
  stopReason: text("stopReason").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoppedEquipment = typeof stoppedEquipment.$inferSelect;
export type InsertStoppedEquipment = typeof stoppedEquipment.$inferInsert;

// جدول توصيات الصيانة
export const maintenanceRecommendations = mysqlTable("maintenanceRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  recommendation: text("recommendation").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceRecommendation = typeof maintenanceRecommendations.$inferSelect;
export type InsertMaintenanceRecommendation = typeof maintenanceRecommendations.$inferInsert;

// جدول المهام
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  assignmentSource: mysqlEnum("assignmentSource", ["board_representative", "general_manager"]).notNull(),
  assignedEmployee: varchar("assignedEmployee", { length: 255 }).notNull(),
  assignedUsername: varchar("assignedUsername", { length: 100 }),
  taskDescription: text("taskDescription").notNull(),
  createdDate: varchar("createdDate", { length: 50 }),
  startDate: varchar("startDate", { length: 50 }),
  endDate: varchar("endDate", { length: 50 }),
  result: mysqlEnum("result", ["completed", "not_completed", "partial", "extended", "recommendations", "pending"]).default("pending").notNull(),
  resultReason: text("resultReason"),
  completionPercentage: int("completionPercentage"),
  extensionDate: varchar("extensionDate", { length: 50 }),
  recommendations: text("recommendations"),
  adminEvaluation: text("adminEvaluation"),
  reward: int("reward"),
  rewardReason: text("rewardReason"),
  deduction: int("deduction"),
  deductionReason: text("deductionReason"),
  hasWarning: int("hasWarning").default(0),
  warningText: text("warningText"),
  attachedDecisions: text("attachedDecisions"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
