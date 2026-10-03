export type DepartmentOption = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
};

/** القائمة الرسمية للأقسام؛ تحفظ قاعدة البيانات المعرّف لا النص المعروض. */
export const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: "production", labelAr: "قسم الإنتاج", labelEn: "Production Department", icon: "precision-manufacturing" },
  { id: "machines", labelAr: "مرحلة المكائن", labelEn: "Machines Stage", icon: "precision-manufacturing" },
  { id: "rosso", labelAr: "مرحلة الروسو", labelEn: "Rosso Stage", icon: "loop" },
  { id: "qalb", labelAr: "مرحلة القلب", labelEn: "Turning Stage", icon: "flip" },
  { id: "kawiya", labelAr: "مرحلة الكاوية", labelEn: "Ironing Stage", icon: "local-fire-department" },
  { id: "inspection", labelAr: "مرحلة الفحص", labelEn: "Inspection Stage", icon: "search" },
  { id: "packing", labelAr: "مرحلة التغليف", labelEn: "Packing Stage", icon: "inventory-2" },
  { id: "antislip", labelAr: "مرحلة مانع الانزلاق", labelEn: "Anti-slip Stage", icon: "layers" },
  { id: "storage", labelAr: "مرحلة التخزين", labelEn: "Storage Stage", icon: "warehouse" },
  { id: "administrative", labelAr: "قسم الإجراءات الإدارية والمصروفات", labelEn: "Administrative & Expenses", icon: "admin-panel-settings" },
  { id: "sales", labelAr: "إدارة التسويق والمبيعات", labelEn: "Marketing & Sales Management", icon: "point-of-sale" },
  { id: "maintenance", labelAr: "قسم الصيانة", labelEn: "Maintenance Department", icon: "build" },
  { id: "board_representative", labelAr: "ممثل مجلس الإدارة", labelEn: "Board Representative", icon: "groups" },
  { id: "warehouse", labelAr: "قسم المستودعات", labelEn: "Warehouse Department", icon: "warehouse" },
  { id: "employees", labelAr: "الموظفين", labelEn: "Employees", icon: "people" },
  { id: "government_tenders", labelAr: "المناقصات الحكومية والعسكرية", labelEn: "Government & Military Tenders", icon: "gavel" },
];

export const DEPARTMENT_IDS = new Set(DEPARTMENT_OPTIONS.map((department) => department.id));
