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


// جدول حساب التكاليف
export const productionCosts = mysqlTable("productionCosts", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 20 }).notNull(),
  threadCost: int("threadCost").default(0),
  rubberCost: int("rubberCost").default(0),
  spandexCost: int("spandexCost").default(0),
  nylonCost: int("nylonCost").default(0),
  cottonCost: int("cottonCost").default(0),
  bambooCost: int("bambooCost").default(0),
  spanCost: int("spanCost").default(0),
  laborCost: int("laborCost").default(0),
  utilitiesCost: int("utilitiesCost").default(0),
  maintenanceCost: int("maintenanceCost").default(0),
  otherCost: int("otherCost").default(0),
  totalCost: int("totalCost").default(0),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionCost = typeof productionCosts.$inferSelect;
export type InsertProductionCost = typeof productionCosts.$inferInsert;

// جدول التنبيهات
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["cost_exceeded", "low_productivity", "pending_procedure", "quality_issue", "safety_alert"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull(),
  read: int("read").default(0),
  data: json("data"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

// جدول النسخ الاحتياطية
export const backups = mysqlTable("backups", {
  id: int("id").autoincrement().primaryKey(),
  backupName: varchar("backupName", { length: 255 }).notNull(),
  backupType: mysqlEnum("backupType", ["manual", "automatic", "scheduled"]).notNull(),
  dataSize: int("dataSize").default(0),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending"),
  backupPath: text("backupPath"),
  errorMessage: text("errorMessage"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = typeof backups.$inferInsert;

// جدول سجل الأنشطة
export const activityLog = mysqlTable("activityLog", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 255 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId"),
  details: json("details"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// جدول التقارير
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reportName: varchar("reportName", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", ["production", "cost", "sales", "performance", "quality", "maintenance"]).notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),
  endDate: varchar("endDate", { length: 20 }).notNull(),
  data: json("data"),
  generatedBy: int("generatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// جدول أنواع الخيوط
export const threadTypes = mysqlTable("threadTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // قطن، بامبو، نايلون، إسبان، إسباندكس، مطاط
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ThreadType = typeof threadTypes.$inferSelect;
export type InsertThreadType = typeof threadTypes.$inferInsert;

// جدول ألوان الخيوط
export const threadColors = mysqlTable("threadColors", {
  id: int("id").autoincrement().primaryKey(),
  threadTypeId: int("threadTypeId").notNull(),
  colorName: varchar("colorName", { length: 100 }).notNull(),
  colorCode: varchar("colorCode", { length: 20 }).notNull(), // كود اللون
  hexColor: varchar("hexColor", { length: 7 }), // رمز اللون السادس عشري
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ThreadColor = typeof threadColors.$inferSelect;
export type InsertThreadColor = typeof threadColors.$inferInsert;

// جدول حساب تكاليف المنتج الجديد
export const productCostCalculation = mysqlTable("productCostCalculation", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 20 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productColor: varchar("productColor", { length: 100 }).notNull(),
  
  // بيانات الخيوط
  cottonWeight: int("cottonWeight").default(0), // بالجرام
  cottonColor: varchar("cottonColor", { length: 100 }),
  cottonCode: varchar("cottonCode", { length: 50 }),
  
  bambooWeight: int("bambooWeight").default(0),
  bambooColor: varchar("bambooColor", { length: 100 }),
  bambooCode: varchar("bambooCode", { length: 50 }),
  
  nylonWeight: int("nylonWeight").default(0),
  nylonColor: varchar("nylonColor", { length: 100 }),
  nylonCode: varchar("nylonCode", { length: 50 }),
  
  spanWeight: int("spanWeight").default(0),
  spanColor: varchar("spanColor", { length: 100 }),
  spanCode: varchar("spanCode", { length: 50 }),
  
  spandexWeight: int("spandexWeight").default(0),
  spandexColor: varchar("spandexColor", { length: 100 }),
  spandexCode: varchar("spandexCode", { length: 50 }),
  
  rubberWeight: int("rubberWeight").default(0),
  rubberColor: varchar("rubberColor", { length: 100 }),
  rubberCode: varchar("rubberCode", { length: 50 }),
  
  // تفاصيل إضافية
  totalThreadWeight: int("totalThreadWeight").default(0),
  notes: text("notes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductCostCalculation = typeof productCostCalculation.$inferSelect;
export type InsertProductCostCalculation = typeof productCostCalculation.$inferInsert;

// جدول الأهداف الشهرية
export const monthlyGoals = mysqlTable("monthlyGoals", {
  id: int("id").autoincrement().primaryKey(),
  month: varchar("month", { length: 20 }).notNull(), // YYYY-MM
  department: varchar("department", { length: 255 }).notNull(), // اسم القسم
  goalType: mysqlEnum("goalType", ["production", "sales", "quality", "efficiency", "safety", "custom"]).notNull(),
  goalName: varchar("goalName", { length: 255 }).notNull(), // اسم الهدف (مثلاً: إنتاج 10000 درزن)
  targetValue: int("targetValue").notNull(), // القيمة المستهدفة
  unit: varchar("unit", { length: 50 }).notNull(), // الوحدة (درزن، ريال، ساعة، إلخ)
  weight: int("weight").default(100), // وزن الهدف في حساب الأداء الكلي
  description: text("description"), // وصف تفصيلي للهدف
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active"),
  createdBy: int("createdBy").notNull(), // معرف الأدمن الذي أنشأ الهدف
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type InsertMonthlyGoal = typeof monthlyGoals.$inferInsert;

// جدول تتبع إنجاز الأهداف
export const goalProgress = mysqlTable("goalProgress", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull(), // معرف الهدف
  date: varchar("date", { length: 20 }).notNull(), // التاريخ
  achievedValue: int("achievedValue").notNull(), // القيمة المحققة
  percentage: int("percentage").default(0), // نسبة الإنجاز
  notes: text("notes"), // ملاحظات
  recordedBy: int("recordedBy").notNull(), // معرف المستخدم الذي سجل البيانات
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoalProgress = typeof goalProgress.$inferSelect;
export type InsertGoalProgress = typeof goalProgress.$inferInsert;

// جدول مؤشرات الأداء (KPIs)
export const kpis = mysqlTable("kpis", {
  id: int("id").autoincrement().primaryKey(),
  month: varchar("month", { length: 20 }).notNull(), // YYYY-MM
  department: varchar("department", { length: 255 }).notNull(), // اسم القسم
  kpiName: varchar("kpiName", { length: 255 }).notNull(), // اسم المؤشر (مثلاً: معدل الإنتاجية)
  kpiType: mysqlEnum("kpiType", ["production", "quality", "efficiency", "safety", "financial", "custom"]).notNull(),
  currentValue: int("currentValue").notNull(), // القيمة الحالية
  targetValue: int("targetValue").notNull(), // القيمة المستهدفة
  previousValue: int("previousValue").default(0), // القيمة السابقة (للمقارنة)
  unit: varchar("unit", { length: 50 }).notNull(), // الوحدة
  status: mysqlEnum("status", ["on_track", "at_risk", "off_track", "exceeded"]).default("on_track"),
  trend: mysqlEnum("trend", ["up", "down", "stable"]).default("stable"), // الاتجاه
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KPI = typeof kpis.$inferSelect;
export type InsertKPI = typeof kpis.$inferInsert;


// جدول الأقسام والفروع
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// جدول المكائن
export const machines = mysqlTable("machines", {
  id: int("id").autoincrement().primaryKey(),
  machineCode: varchar("machineCode", { length: 50 }).notNull().unique(),
  machineName: varchar("machineName", { length: 255 }).notNull(),
  machineType: varchar("machineType", { length: 100 }),
  department: varchar("department", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "maintenance", "retired"]).default("active"),
  capacity: int("capacity").default(0), // الطاقة الإنتاجية
  installDate: varchar("installDate", { length: 20 }),
  notes: text("notes"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Machine = typeof machines.$inferSelect;
export type InsertMachine = typeof machines.$inferInsert;

// جدول مراحل التسليم (Manufacturing Stages)
export const productionStages = mysqlTable("productionStages", {
  id: int("id").autoincrement().primaryKey(),
  stageName: varchar("stageName", { length: 255 }).notNull().unique(),
  stageNameEn: varchar("stageNameEn", { length: 255 }),
  stageOrder: int("stageOrder").notNull(), // ترتيب المرحلة
  department: varchar("department", { length: 255 }).notNull(),
  description: text("description"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductionStage = typeof productionStages.$inferSelect;
export type InsertProductionStage = typeof productionStages.$inferInsert;

// جدول تعيين الموظفين للمراحل
export const employeeStageAssignment = mysqlTable("employeeStageAssignment", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // معرف الموظف
  stageId: int("stageId").notNull(), // معرف المرحلة
  department: varchar("department", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }), // دور الموظف في المرحلة
  assignedDate: varchar("assignedDate", { length: 20 }).notNull(),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmployeeStageAssignment = typeof employeeStageAssignment.$inferSelect;
export type InsertEmployeeStageAssignment = typeof employeeStageAssignment.$inferInsert;

// جدول أنواع المنتجات
export const productTypes = mysqlTable("productTypes", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 255 }).notNull().unique(),
  productNameEn: varchar("productNameEn", { length: 255 }),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductType = typeof productTypes.$inferSelect;
export type InsertProductType = typeof productTypes.$inferInsert;

// جدول بيانات ممثل مجلس الإدارة
export const boardRepresentativeData = mysqlTable("boardRepresentativeData", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // معرف ممثل مجلس الإدارة
  dataType: varchar("dataType", { length: 100 }).notNull(), // نوع البيانات
  value: varchar("value", { length: 500 }).notNull(), // القيمة
  description: text("description"),
  date: varchar("date", { length: 20 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BoardRepresentativeData = typeof boardRepresentativeData.$inferSelect;
export type InsertBoardRepresentativeData = typeof boardRepresentativeData.$inferInsert;

// جدول سجل التدقيق (Audit Log)
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // معرف المستخدم الذي قام بالتعديل
  action: varchar("action", { length: 100 }).notNull(), // نوع الإجراء (create, update, delete)
  tableName: varchar("tableName", { length: 100 }).notNull(), // اسم الجدول
  recordId: int("recordId").notNull(), // معرف السجل المتأثر
  oldValue: json("oldValue"), // القيمة القديمة
  newValue: json("newValue"), // القيمة الجديدة
  description: text("description"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// جدول الإعدادات العامة
export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
