// Data Service - جميع خدمات البيانات للتطبيق
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ManufacturingStageData {
  id?: number;
  stageName: string;
  workerName: string;
  quantityDozen: number;
  quantityPair: number;
}

export interface SalesData {
  id?: number;
  sellerName: string;
  customerName: string;
  customerCategory: string;
  quantityDozen: number;
  quantityPair: number;
  paymentMethod: "cash" | "deferred";
}

export interface CollectionData {
  id?: number;
  collectorName: string;
  customerName: string;
  amount: number;
}

export interface AdministrativeData {
  id?: number;
  employeeName: string;
  employeeNumber: string;
  department: string;
  requestType: string;
  requestDetails: string;
  attachments: string[];
  approvedByBoardRep: boolean;
  boardRepStatus: "pending" | "approved" | "rejected";
  boardRepRejectionReason: string;
  approvedByDirectManager: boolean;
  directManagerStatus: "pending" | "approved" | "rejected";
  directManagerRejectionReason: string;
  approvedByGeneralManager: boolean;
  generalManagerStatus: "pending" | "approved" | "rejected";
  generalManagerRejectionReason: string;
  rejectionReason: string;
  status: "pending" | "approved" | "rejected";
  // Legacy fields for backward compatibility
  approvedByHR?: boolean;
  approvedByManager?: boolean;
}

export interface FinancialData {
  id?: number;
  expenseType: string;
  description: string;
  amount: number;
  approvedByBoardRep: boolean;
}

export interface TaskData {
  id?: number;
  // مصدر التكليف
  assignmentSource: "board_representative" | "general_manager";
  // الموظف المكلف
  assignedEmployee: string;
  // اسم المستخدم المكلف (لربط المهمة بالشخص)
  assignedUsername?: string;
  // وصف المهمة
  taskDescription: string;
  // تاريخ إنشاء المهمة
  createdDate: string;
  // المدة الزمنية
  startDate: string;
  endDate: string;
  // النتائج
  result: "completed" | "not_completed" | "partial" | "extended" | "recommendations" | "pending";
  resultReason?: string; // سبب عدم الإنجاز
  completionPercentage?: number; // نسبة الإنجاز الجزئي
  extensionDate?: string; // تاريخ التمديد الجديد
  recommendations?: string; // التوصيات
  // تقييم الأدمن (يظهر فقط للمكلف)
  adminEvaluation?: string; // لا يقل عن 1500 حرف
  // المكافأة والحسم
  reward?: number;
  rewardReason?: string;
  deduction?: number;
  deductionReason?: string;
  // الإنذار
  hasWarning?: boolean;
  warningText?: string;
  // قرارات مرفقة
  attachedDecisions?: string;
}

export interface AdminUserData {
  id?: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
}

// Manufacturing Stage Service
export const manufacturingStageService = {
  async getAll(): Promise<ManufacturingStageData[]> {
    try {
      const response = await fetch("/api/manufacturing-stages");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (error) {
      console.error("Error fetching manufacturing stages:", error);
      return [];
    }
  },

  async create(data: ManufacturingStageData): Promise<ManufacturingStageData> {
    const response = await fetch("/api/manufacturing-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create");
    return response.json();
  },

  async update(id: number, data: ManufacturingStageData): Promise<ManufacturingStageData> {
    const response = await fetch(`/api/manufacturing-stages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`/api/manufacturing-stages/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete");
  },
};

// Sales Service
export const salesService = {
  async getAll(): Promise<SalesData[]> {
    try {
      const response = await fetch("/api/sales");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (error) {
      console.error("Error fetching sales:", error);
      return [];
    }
  },

  async create(data: SalesData): Promise<SalesData> {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create");
    return response.json();
  },

  async update(id: number, data: SalesData): Promise<SalesData> {
    const response = await fetch(`/api/sales/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`/api/sales/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete");
  },
};

// Collection Service
export const collectionService = {
  async getAll(): Promise<CollectionData[]> {
    try {
      const response = await fetch("/api/collections");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (error) {
      console.error("Error fetching collections:", error);
      return [];
    }
  },

  async create(data: CollectionData): Promise<CollectionData> {
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create");
    return response.json();
  },

  async update(id: number, data: CollectionData): Promise<CollectionData> {
    const response = await fetch(`/api/collections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`/api/collections/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete");
  },
};

// Administrative Service - AsyncStorage based
const ADMINISTRATIVE_KEY = "administrative_entries";

export const administrativeService = {
  async getAll(): Promise<AdministrativeData[]> {
    try {
      const raw = await AsyncStorage.getItem(ADMINISTRATIVE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Error fetching administrative requests:", error);
      return [];
    }
  },

  async create(data: AdministrativeData): Promise<AdministrativeData> {
    const items = await this.getAll();
    const newItem: AdministrativeData = {
      ...data,
      id: Date.now(),
    };
    items.push(newItem);
    await AsyncStorage.setItem(ADMINISTRATIVE_KEY, JSON.stringify(items));
    return newItem;
  },

  async update(id: number, data: AdministrativeData): Promise<AdministrativeData> {
    const items = await this.getAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("Request not found");
    items[index] = { ...data, id };
    await AsyncStorage.setItem(ADMINISTRATIVE_KEY, JSON.stringify(items));
    return items[index];
  },

  async delete(id: number): Promise<void> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.id !== id);
    await AsyncStorage.setItem(ADMINISTRATIVE_KEY, JSON.stringify(filtered));
  },
};

// Financial Service
export const financialService = {
  async getAll(): Promise<FinancialData[]> {
    try {
      const response = await fetch("/api/financial");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (error) {
      console.error("Error fetching financial data:", error);
      return [];
    }
  },

  async create(data: FinancialData): Promise<FinancialData> {
    const response = await fetch("/api/financial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create");
    return response.json();
  },

  async update(id: number, data: FinancialData): Promise<FinancialData> {
    const response = await fetch(`/api/financial/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`/api/financial/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete");
  },
};

// Task Service - AsyncStorage based
const TASKS_KEY = "tasks_entries";

export const taskService = {
  async getAll(): Promise<TaskData[]> {
    try {
      const raw = await AsyncStorage.getItem(TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  },

  async create(data: TaskData): Promise<TaskData> {
    const tasks = await this.getAll();
    const newTask: TaskData = {
      ...data,
      id: Date.now(),
    };
    tasks.push(newTask);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return newTask;
  },

  async update(id: number, data: TaskData): Promise<TaskData> {
    const tasks = await this.getAll();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error("Task not found");
    tasks[index] = { ...data, id };
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return tasks[index];
  },

  async delete(id: number): Promise<void> {
    const tasks = await this.getAll();
    const filtered = tasks.filter((t) => t.id !== id);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(filtered));
  },
};

// Admin Service
export const adminService = {
  async getAllUsers(): Promise<AdminUserData[]> {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  },

  async createUser(data: AdminUserData): Promise<AdminUserData> {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create");
    return response.json();
  },

  async updateUser(id: number, data: AdminUserData): Promise<AdminUserData> {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update");
    return response.json();
  },

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete");
  },
};
