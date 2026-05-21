/**
 * نظام الأدوار والصلاحيات المتقدم لمصنع السلطان
 */

export type UserRole =
  | "admin"
  | "production_manager"
  | "warehouse_manager"
  | "sales_manager"
  | "maintenance_manager"
  | "financial_manager"
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
}

// تعريف الصلاحيات
const PERMISSIONS = {
  // صلاحيات الإنتاج
  VIEW_PRODUCTION: {
    id: "view_production",
    name: "عرض الإنتاج",
    description: "عرض بيانات الإنتاج",
    category: "production",
  },
  EDIT_PRODUCTION: {
    id: "edit_production",
    name: "تعديل الإنتاج",
    description: "تعديل بيانات الإنتاج",
    category: "production",
  },
  DELETE_PRODUCTION: {
    id: "delete_production",
    name: "حذف الإنتاج",
    description: "حذف بيانات الإنتاج",
    category: "production",
  },

  // صلاحيات المستودع
  VIEW_WAREHOUSE: {
    id: "view_warehouse",
    name: "عرض المستودع",
    description: "عرض بيانات المستودع",
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

  // صلاحيات المبيعات
  VIEW_SALES: {
    id: "view_sales",
    name: "عرض المبيعات",
    description: "عرض بيانات المبيعات",
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

  // صلاحيات الصيانة
  VIEW_MAINTENANCE: {
    id: "view_maintenance",
    name: "عرض الصيانة",
    description: "عرض بيانات الصيانة",
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

  // صلاحيات المالية
  VIEW_FINANCIAL: {
    id: "view_financial",
    name: "عرض المالية",
    description: "عرض البيانات المالية",
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
    name: "الموافقة على المالية",
    description: "الموافقة على العمليات المالية",
    category: "financial",
  },

  // صلاحيات الإدارة
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
};

// تعريف الأدوار والصلاحيات المرتبطة بها
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: "admin",
    description: "مسؤول النظام - صلاحيات كاملة",
    permissions: Object.values(PERMISSIONS),
  },

  production_manager: {
    role: "production_manager",
    description: "مدير الإنتاج",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.EDIT_PRODUCTION,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_SALES,
    ],
  },

  warehouse_manager: {
    role: "warehouse_manager",
    description: "مدير المستودع",
    permissions: [
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.EDIT_WAREHOUSE,
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },

  sales_manager: {
    role: "sales_manager",
    description: "مدير المبيعات",
    permissions: [
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.EDIT_SALES,
      PERMISSIONS.VIEW_WAREHOUSE,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },

  maintenance_manager: {
    role: "maintenance_manager",
    description: "مدير الصيانة",
    permissions: [
      PERMISSIONS.VIEW_MAINTENANCE,
      PERMISSIONS.EDIT_MAINTENANCE,
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },

  financial_manager: {
    role: "financial_manager",
    description: "المدير المالي",
    permissions: [
      PERMISSIONS.VIEW_FINANCIAL,
      PERMISSIONS.EDIT_FINANCIAL,
      PERMISSIONS.APPROVE_FINANCIAL,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_REPORTS,
    ],
  },

  operator: {
    role: "operator",
    description: "عامل التشغيل",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.EDIT_PRODUCTION,
      PERMISSIONS.VIEW_MAINTENANCE,
    ],
  },

  user: {
    role: "user",
    description: "مستخدم عام",
    permissions: [
      PERMISSIONS.VIEW_PRODUCTION,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.VIEW_WAREHOUSE,
    ],
  },
};

export class RolesService {
  /**
   * الحصول على الصلاحيات المرتبطة بدور معين
   */
  static getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role]?.permissions || [];
  }

  /**
   * التحقق من وجود صلاحية معينة للمستخدم
   */
  static hasPermission(role: UserRole, permissionId: string): boolean {
    const permissions = this.getPermissionsForRole(role);
    return permissions.some((p) => p.id === permissionId);
  }

  /**
   * الحصول على وصف الدور
   */
  static getRoleDescription(role: UserRole): string {
    return ROLE_PERMISSIONS[role]?.description || "دور غير معروف";
  }

  /**
   * الحصول على جميع الأدوار المتاحة
   */
  static getAllRoles(): RolePermissions[] {
    return Object.values(ROLE_PERMISSIONS);
  }

  /**
   * الحصول على الأدوار حسب الفئة
   */
  static getRolesByCategory(category: string): RolePermissions[] {
    return Object.values(ROLE_PERMISSIONS).filter((role) =>
      role.permissions.some((p) => p.category === category)
    );
  }

  /**
   * التحقق من ما إذا كان الدور يحتوي على صلاحيات إدارية
   */
  static isAdminRole(role: UserRole): boolean {
    return role === "admin";
  }

  /**
   * التحقق من ما إذا كان الدور يحتوي على صلاحيات مديرية
   */
  static isManagerRole(role: UserRole): boolean {
    return [
      "admin",
      "production_manager",
      "warehouse_manager",
      "sales_manager",
      "maintenance_manager",
      "financial_manager",
    ].includes(role);
  }

  /**
   * الحصول على الصلاحيات المشتركة بين دورين
   */
  static getCommonPermissions(
    role1: UserRole,
    role2: UserRole
  ): Permission[] {
    const permissions1 = this.getPermissionsForRole(role1);
    const permissions2 = this.getPermissionsForRole(role2);

    return permissions1.filter((p1) =>
      permissions2.some((p2) => p1.id === p2.id)
    );
  }

  /**
   * الحصول على الصلاحيات الفريدة لدور معين مقارنة بدور آخر
   */
  static getUniquePermissions(
    role1: UserRole,
    role2: UserRole
  ): Permission[] {
    const permissions1 = this.getPermissionsForRole(role1);
    const permissions2 = this.getPermissionsForRole(role2);

    return permissions1.filter(
      (p1) => !permissions2.some((p2) => p1.id === p2.id)
    );
  }
}

export default RolesService;
