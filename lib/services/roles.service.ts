/**
 * نظام الأدوار والصلاحيات المتقدم لمصنع السلطان
 * يشمل 10 أدوار و30+ صلاحية مفصلة
 */

export type UserRole =
  | "admin"
  | "production_manager"
  | "warehouse_manager"
  | "sales_manager"
  | "maintenance_manager"
  | "financial_manager"
  | "hr_officer"
  | "quality_inspector"
  | "operator"
  | "user";

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  description: string;
  nameAr: string;
  nameEn: string;
}

// تعريف الصلاحيات الشاملة
const PERMISSIONS = {
  // صلاحيات الإنتاج
  VIEW_PRODUCTION: {
    id: "view_production",
    name: "عرض الإنتاج",
    description: "عرض بيانات الإنتاج ومراحل التصنيع",
    category: "production",
  },
  ADD_PRODUCTION: {
    id: "add_production",
    name: "إضافة إنتاج",
    description: "إدخال بيانات إنتاج جديدة",
    category: "production",
  },
  EDIT_PRODUCTION: {
    id: "edit_production",
    name: "تعديل الإنتاج",
    description: "تعديل بيانات الإنتاج المدخلة",
    category: "production",
  },
  DELETE_PRODUCTION: {
    id: "delete_production",
    name: "حذف الإنتاج",
    description: "حذف بيانات الإنتاج",
    category: "production",
  },
  EXPORT_PRODUCTION: {
    id: "export_production",
    name: "تصدير الإنتاج",
    description: "تصدير بيانات الإنتاج كتقارير",
    category: "production",
  },

  // صلاحيات مراحل التصنيع
  VIEW_MANUFACTURING: {
    id: "view_manufacturing",
    name: "عرض مراحل التصنيع",
    description: "عرض بيانات مراحل التصنيع المختلفة",
    category: "manufacturing",
  },
  ADD_MANUFACTURING: {
    id: "add_manufacturing",
    name: "إضافة بيانات التصنيع",
    description: "إدخال بيانات مراحل التصنيع",
    category: "manufacturing",
  },
  EDIT_MANUFACTURING: {
    id: "edit_manufacturing",
    name: "تعديل بيانات التصنيع",
    description: "تعديل بيانات مراحل التصنيع",
    category: "manufacturing",
  },

  // صلاحيات المستودع
  VIEW_WAREHOUSE: {
    id: "view_warehouse",
    name: "عرض المستودع",
    description: "عرض بيانات المستودعات",
    category: "warehouse",
  },
  MANAGE_WAREHOUSE_IN: {
    id: "manage_warehouse_in",
    name: "إدارة الوارد",
    description: "إدخال المواد والمنتجات للمستودع",
    category: "warehouse",
  },
  MANAGE_WAREHOUSE_OUT: {
    id: "manage_warehouse_out",
    name: "إدارة الصادر",
    description: "إخراج المواد والمنتجات من المستودع",
    category: "warehouse",
  },
  EDIT_WAREHOUSE: {
    id: "edit_warehouse",
    name: "تعديل المستودع",
    description: "تعديل بيانات المستودع",
    category: "warehouse",
  },
  DELETE_WAREHOUSE: {
    id: "delete_warehouse",
    name: "حذف المستودع",
    description: "حذف بيانات المستودع",
    category: "warehouse",
  },

  // صلاحيات المبيعات والتحصيل
  VIEW_SALES: {
    id: "view_sales",
    name: "عرض المبيعات",
    description: "عرض بيانات المبيعات",
    category: "sales",
  },
  ADD_SALES: {
    id: "add_sales",
    name: "إضافة مبيعات",
    description: "إدخال بيانات مبيعات جديدة",
    category: "sales",
  },
  EDIT_SALES: {
    id: "edit_sales",
    name: "تعديل المبيعات",
    description: "تعديل بيانات المبيعات",
    category: "sales",
  },
  DELETE_SALES: {
    id: "delete_sales",
    name: "حذف المبيعات",
    description: "حذف بيانات المبيعات",
    category: "sales",
  },
  VIEW_COLLECTION: {
    id: "view_collection",
    name: "عرض التحصيل",
    description: "عرض بيانات التحصيل",
    category: "sales",
  },
  ADD_COLLECTION: {
    id: "add_collection",
    name: "إضافة تحصيل",
    description: "إدخال بيانات تحصيل جديدة",
    category: "sales",
  },

  // صلاحيات الصيانة
  VIEW_MAINTENANCE: {
    id: "view_maintenance",
    name: "عرض الصيانة",
    description: "عرض بيانات الصيانة",
    category: "maintenance",
  },
  ADD_MAINTENANCE: {
    id: "add_maintenance",
    name: "إضافة صيانة",
    description: "إدخال طلبات صيانة جديدة",
    category: "maintenance",
  },
  EDIT_MAINTENANCE: {
    id: "edit_maintenance",
    name: "تعديل الصيانة",
    description: "تعديل بيانات الصيانة",
    category: "maintenance",
  },
  DELETE_MAINTENANCE: {
    id: "delete_maintenance",
    name: "حذف الصيانة",
    description: "حذف بيانات الصيانة",
    category: "maintenance",
  },
  MANAGE_SAFETY: {
    id: "manage_safety",
    name: "إدارة السلامة",
    description: "إدارة متطلبات السلامة والصحة المهنية",
    category: "maintenance",
  },

  // صلاحيات المالية
  VIEW_FINANCIAL: {
    id: "view_financial",
    name: "عرض المالية",
    description: "عرض البيانات المالية والمصروفات",
    category: "financial",
  },
  ADD_FINANCIAL: {
    id: "add_financial",
    name: "إضافة مصروفات",
    description: "إدخال مصروفات جديدة",
    category: "financial",
  },
  EDIT_FINANCIAL: {
    id: "edit_financial",
    name: "تعديل المالية",
    description: "تعديل البيانات المالية",
    category: "financial",
  },
  APPROVE_FINANCIAL: {
    id: "approve_financial",
    name: "اعتماد المالية",
    description: "الموافقة على العمليات المالية",
    category: "financial",
  },
  DELETE_FINANCIAL: {
    id: "delete_financial",
    name: "حذف المالية",
    description: "حذف البيانات المالية",
    category: "financial",
  },

  // صلاحيات المهام
  VIEW_TASKS: {
    id: "view_tasks",
    name: "عرض المهام",
    description: "عرض المهام المسندة",
    category: "tasks",
  },
  ADD_TASKS: {
    id: "add_tasks",
    name: "إضافة مهام",
    description: "إنشاء مهام جديدة",
    category: "tasks",
  },
  ASSIGN_TASKS: {
    id: "assign_tasks",
    name: "تعيين المهام",
    description: "تعيين المهام للموظفين",
    category: "tasks",
  },
  MANAGE_TASKS: {
    id: "manage_tasks",
    name: "إدارة المهام",
    description: "إدارة وتعديل وحذف المهام",
    category: "tasks",
  },

  // صلاحيات الموارد البشرية
  VIEW_HR: {
    id: "view_hr",
    name: "عرض الموارد البشرية",
    description: "عرض بيانات الموظفين والإجازات",
    category: "hr",
  },
  MANAGE_HR: {
    id: "manage_hr",
    name: "إدارة الموارد البشرية",
    description: "إدارة بيانات الموظفين والإجازات والحضور",
    category: "hr",
  },
  VIEW_INJURIES: {
    id: "view_injuries",
    name: "عرض الإصابات",
    description: "عرض سجل إصابات العمل",
    category: "hr",
  },
  MANAGE_INJURIES: {
    id: "manage_injuries",
    name: "إدارة الإصابات",
    description: "إدارة سجل إصابات العمل",
    category: "hr",
  },

  // صلاحيات الإدارة والنظام
  MANAGE_USERS: {
    id: "manage_users",
    name: "إدارة المستخدمين",
    description: "إضافة وتعديل وحذف المستخدمين",
    category: "admin",
  },
  MANAGE_ROLES: {
    id: "manage_roles",
    name: "إدارة الأدوار",
    description: "إدارة الأدوار والصلاحيات",
    category: "admin",
  },
  VIEW_REPORTS: {
    id: "view_reports",
    name: "عرض التقارير",
    description: "عرض التقارير والإحصائيات",
    category: "admin",
  },
  EXPORT_REPORTS: {
    id: "export_reports",
    name: "تصدير التقارير",
    description: "تصدير التقارير والبيانات",
    category: "admin",
  },
  VIEW_ACTIVITY_LOG: {
    id: "view_activity_log",
    name: "عرض سجل النشاطات",
    description: "عرض سجل نشاطات المستخدمين",
    category: "admin",
  },
  MANAGE_SETTINGS: {
    id: "manage_settings",
    name: "إدارة الإعدادات",
    description: "تعديل إعدادات النظام",
    category: "admin",
  },
  VIEW_ADMIN_DASHBOARD: {
    id: "view_admin_dashboard",
    name: "لوحة التحكم",
    description: "عرض لوحة تحكم المدير",
    category: "admin",
  },
  MANAGE_WASTE_ALERTS: {
    id: "manage_waste_alerts",
    name: "إدارة تنبيهات الهدر",
    description: "إدارة إعدادات وحدود تنبيهات الهدر",
    category: "admin",
  },
  MANAGE_NOTIFICATIONS: {
    id: "manage_notifications",
    name: "إدارة الإشعارات",
    description: "إرسال وإدارة الإشعارات",
    category: "admin",
  },
};

// تعريف الأدوار والصلاحيات المرتبطة بها
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: "admin",
    nameAr: "مدير النظام",
    nameEn: "System Admin",
    description: "مسؤول النظام - صلاحيات كاملة على جميع الأقسام",
    permissions: Object.values(PERMISSIONS),
  },

  production_manager: {
    role: "production_manager",
    nameAr: "مدير الإنتاج",
    nameEn: "Production Manager",
    description: "إدارة كاملة لقسم الإنتاج ومراحل التصنيع",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.ADD_PRODUCTION,
      PERMISSIONS.EDIT_PRODUCTION,
      PERMISSIONS.DELETE_PRODUCTION,
      PERMISSIONS.EXPORT_PRODUCTION,
      PERMISSIONS.VIEW_MANUFACTURING,
      PERMISSIONS.ADD_MANUFACTURING,
      PERMISSIONS.EDIT_MANUFACTURING,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_TASKS,
      PERMISSIONS.ADD_TASKS,
      PERMISSIONS.ASSIGN_TASKS,
      PERMISSIONS.MANAGE_WASTE_ALERTS,
    ],
  },

  warehouse_manager: {
    role: "warehouse_manager",
    nameAr: "أمين المستودع",
    nameEn: "Warehouse Manager",
    description: "إدارة كاملة للمستودعات (الوارد والصادر)",
    permissions: [
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.MANAGE_WAREHOUSE_IN,
      PERMISSIONS.MANAGE_WAREHOUSE_OUT,
      PERMISSIONS.EDIT_WAREHOUSE,
      PERMISSIONS.DELETE_WAREHOUSE,
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_TASKS,
    ],
  },

  sales_manager: {
    role: "sales_manager",
    nameAr: "مدير المبيعات",
    nameEn: "Sales Manager",
    description: "إدارة المبيعات والتحصيل",
    permissions: [
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.ADD_SALES,
      PERMISSIONS.EDIT_SALES,
      PERMISSIONS.DELETE_SALES,
      PERMISSIONS.VIEW_COLLECTION,
      PERMISSIONS.ADD_COLLECTION,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_REPORTS,
      PERMISSIONS.VIEW_TASKS,
    ],
  },

  maintenance_manager: {
    role: "maintenance_manager",
    nameAr: "مدير الصيانة",
    nameEn: "Maintenance Manager",
    description: "إدارة الصيانة والسلامة المهنية",
    permissions: [
      PERMISSIONS.VIEW_MAINTENANCE,
      PERMISSIONS.ADD_MAINTENANCE,
      PERMISSIONS.EDIT_MAINTENANCE,
      PERMISSIONS.DELETE_MAINTENANCE,
      PERMISSIONS.MANAGE_SAFETY,
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_TASKS,
      PERMISSIONS.ADD_TASKS,
    ],
  },

  financial_manager: {
    role: "financial_manager",
    nameAr: "المدير المالي",
    nameEn: "Financial Manager",
    description: "إدارة المصروفات والشؤون المالية",
    permissions: [
      PERMISSIONS.VIEW_FINANCIAL,
      PERMISSIONS.ADD_FINANCIAL,
      PERMISSIONS.EDIT_FINANCIAL,
      PERMISSIONS.APPROVE_FINANCIAL,
      PERMISSIONS.DELETE_FINANCIAL,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.VIEW_COLLECTION,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_REPORTS,
      PERMISSIONS.VIEW_TASKS,
    ],
  },

  hr_officer: {
    role: "hr_officer",
    nameAr: "مسؤول الموارد البشرية",
    nameEn: "HR Officer",
    description: "إدارة شؤون الموظفين والإجازات والإصابات",
    permissions: [
      PERMISSIONS.VIEW_HR,
      PERMISSIONS.MANAGE_HR,
      PERMISSIONS.VIEW_INJURIES,
      PERMISSIONS.MANAGE_INJURIES,
      PERMISSIONS.MANAGE_SAFETY,
      PERMISSIONS.VIEW_TASKS,
      PERMISSIONS.ADD_TASKS,
      PERMISSIONS.ASSIGN_TASKS,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },

  quality_inspector: {
    role: "quality_inspector",
    nameAr: "مفتش الجودة",
    nameEn: "Quality Inspector",
    description: "فحص الجودة ومراقبة الهدر والنخب الثاني",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_MANUFACTURING,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.MANAGE_WASTE_ALERTS,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_PRODUCTION,
      PERMISSIONS.VIEW_TASKS,
    ],
  },

  operator: {
    role: "operator",
    nameAr: "مشغل",
    nameEn: "Operator",
    description: "إدخال بيانات الإنتاج والتصنيع",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.ADD_PRODUCTION,
      PERMISSIONS.VIEW_MANUFACTURING,
      PERMISSIONS.ADD_MANUFACTURING,
      PERMISSIONS.VIEW_MAINTENANCE,
      PERMISSIONS.ADD_MAINTENANCE,
      PERMISSIONS.VIEW_TASKS,
    ],
  },

  user: {
    role: "user",
    nameAr: "مستخدم عام",
    nameEn: "General User",
    description: "عرض البيانات فقط بدون تعديل",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.VIEW_MAINTENANCE,
      PERMISSIONS.VIEW_TASKS,
    ],
  },
};

// تصنيف الصلاحيات حسب الفئة
export const PERMISSION_CATEGORIES = {
  production: { name: "الإنتاج", nameEn: "Production", icon: "precision-manufacturing" },
  manufacturing: { name: "مراحل التصنيع", nameEn: "Manufacturing", icon: "settings" },
  warehouse: { name: "المستودعات", nameEn: "Warehouse", icon: "warehouse" },
  sales: { name: "المبيعات والتحصيل", nameEn: "Sales & Collection", icon: "point-of-sale" },
  maintenance: { name: "الصيانة", nameEn: "Maintenance", icon: "build" },
  financial: { name: "المالية", nameEn: "Financial", icon: "account-balance" },
  tasks: { name: "المهام", nameEn: "Tasks", icon: "task" },
  hr: { name: "الموارد البشرية", nameEn: "Human Resources", icon: "people" },
  admin: { name: "الإدارة والنظام", nameEn: "Admin & System", icon: "admin-panel-settings" },
};

export class RolesService {
  static getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role]?.permissions || [];
  }

  static hasPermission(role: UserRole, permissionId: string): boolean {
    const permissions = this.getPermissionsForRole(role);
    return permissions.some((p) => p.id === permissionId);
  }

  static getRoleDescription(role: UserRole): string {
    return ROLE_PERMISSIONS[role]?.description || "دور غير معروف";
  }

  static getRoleName(role: UserRole, lang: "ar" | "en" = "ar"): string {
    const roleData = ROLE_PERMISSIONS[role];
    if (!roleData) return role;
    return lang === "ar" ? roleData.nameAr : roleData.nameEn;
  }

  static getAllRoles(): RolePermissions[] {
    return Object.values(ROLE_PERMISSIONS);
  }

  static getAllPermissions(): Permission[] {
    return Object.values(PERMISSIONS);
  }

  static getPermissionsByCategory(category: string): Permission[] {
    return Object.values(PERMISSIONS).filter((p) => p.category === category);
  }

  static getRolesByCategory(category: string): RolePermissions[] {
    return Object.values(ROLE_PERMISSIONS).filter((role) =>
      role.permissions.some((p) => p.category === category)
    );
  }

  static isAdminRole(role: UserRole): boolean {
    return role === "admin";
  }

  static isManagerRole(role: UserRole): boolean {
    return [
      "admin",
      "production_manager",
      "warehouse_manager",
      "sales_manager",
      "maintenance_manager",
      "financial_manager",
      "hr_officer",
    ].includes(role);
  }

  static canAccessSection(role: UserRole, section: string): boolean {
    const sectionPermissionMap: Record<string, string> = {
      production: "view_production",
      manufacturing: "view_manufacturing",
      warehouse: "view_warehouse",
      sales: "view_sales",
      collection: "view_collection",
      maintenance: "view_maintenance",
      financial: "view_financial",
      tasks: "view_tasks",
      hr: "view_hr",
      reports: "view_reports",
      admin_dashboard: "view_admin_dashboard",
      users_management: "manage_users",
      activity_log: "view_activity_log",
      waste_alerts: "manage_waste_alerts",
      export: "export_reports",
    };

    const requiredPermission = sectionPermissionMap[section];
    if (!requiredPermission) return true; // If no permission required, allow access
    return this.hasPermission(role, requiredPermission);
  }

  static getCommonPermissions(role1: UserRole, role2: UserRole): Permission[] {
    const permissions1 = this.getPermissionsForRole(role1);
    const permissions2 = this.getPermissionsForRole(role2);
    return permissions1.filter((p1) => permissions2.some((p2) => p1.id === p2.id));
  }

  static getUniquePermissions(role1: UserRole, role2: UserRole): Permission[] {
    const permissions1 = this.getPermissionsForRole(role1);
    const permissions2 = this.getPermissionsForRole(role2);
    return permissions1.filter((p1) => !permissions2.some((p2) => p1.id === p2.id));
  }
}

export { PERMISSIONS };
export default RolesService;
