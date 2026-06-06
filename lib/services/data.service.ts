import { getApiBaseUrl } from "@/constants/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_STORAGE_KEY = "sultan_session_id";

async function trpcCall(endpoint: string, body?: any, method: "query" | "mutation" = "mutation") {
  const baseUrl = getApiBaseUrl();
  const sessionId = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  let url = `${baseUrl}/api/trpc/${endpoint}`;
  let options: RequestInit;

  if (method === "query") {
    // For superjson queries, wrap input in {json: ...}
    if (body !== undefined) {
      const input = encodeURIComponent(JSON.stringify({ json: body }));
      url += `?input=${input}`;
    }
    options = { method: "GET", headers };
  } else {
    // For superjson mutations, wrap body in {json: ...}
    options = {
      method: "POST",
      headers,
      body: JSON.stringify({ json: body }),
    };
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (data.error) {
    const errMsg = data.error?.json?.message || data.error?.message || "حدث خطأ في الخادم";
    throw new Error(errMsg);
  }

  // superjson wraps response in {result: {data: {json: ...}}}
  return data.result?.data?.json;
}

export interface ManufacturingStageData {
  id?: number;
  stageName: string;
  workerName: string;
  quantityDozen: number;
  quantityPair: number;
  productType?: string;
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
  referenceNumber?: string;
  submissionDate?: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  requestType: string;
  requestDetails: string;
  attachments: string[];
  approvedByBoardRep: boolean;
  boardRepStatus: "pending" | "approved" | "rejected";
  boardRepRejectionReason: string;
  boardRepActionDate?: string;
  approvedByDirectManager: boolean;
  directManagerStatus: "pending" | "approved" | "rejected";
  directManagerRejectionReason: string;
  directManagerActionDate?: string;
  approvedByGeneralManager: boolean;
  generalManagerStatus: "pending" | "approved" | "rejected";
  generalManagerRejectionReason: string;
  generalManagerActionDate?: string;
  rejectionReason: string;
  status: "pending" | "approved" | "rejected";
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
  assignmentSource: "board_representative" | "general_manager";
  assignedEmployee: string;
  assignedUsername?: string;
  taskDescription: string;
  createdDate: string;
  startDate: string;
  endDate: string;
  result: "completed" | "not_completed" | "partial" | "extended" | "recommendations" | "pending";
  resultReason?: string;
  completionPercentage?: number;
  extensionDate?: string;
  recommendations?: string;
  adminEvaluation?: string;
  reward?: number;
  rewardReason?: string;
  deduction?: number;
  deductionReason?: string;
  hasWarning?: boolean;
  warningText?: string;
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

// Manufacturing Stage Service - API based
export const manufacturingStageService = {
  async getAll(): Promise<ManufacturingStageData[]> {
    try {
      return await trpcCall("manufacturing.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching manufacturing stages:", error);
      return [];
    }
  },

  async create(data: ManufacturingStageData): Promise<ManufacturingStageData> {
    const result = await trpcCall("manufacturing.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: ManufacturingStageData): Promise<ManufacturingStageData> {
    await trpcCall("manufacturing.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("manufacturing.delete", { id });
  },
};

// Sales Service - API based
export const salesService = {
  async getAll(): Promise<SalesData[]> {
    try {
      return await trpcCall("sales.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching sales:", error);
      return [];
    }
  },

  async create(data: SalesData): Promise<SalesData> {
    const result = await trpcCall("sales.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: SalesData): Promise<SalesData> {
    await trpcCall("sales.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("sales.delete", { id });
  },
};

// Collection Service - API based
export const collectionService = {
  async getAll(): Promise<CollectionData[]> {
    try {
      return await trpcCall("collection.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching collections:", error);
      return [];
    }
  },

  async create(data: CollectionData): Promise<CollectionData> {
    const result = await trpcCall("collection.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: CollectionData): Promise<CollectionData> {
    await trpcCall("collection.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("collection.delete", { id });
  },
};

// Administrative Service - API based
export const administrativeService = {
  async getAll(): Promise<AdministrativeData[]> {
    try {
      return await trpcCall("administrative.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching administrative requests:", error);
      return [];
    }
  },

  async create(data: AdministrativeData): Promise<AdministrativeData> {
    const result = await trpcCall("administrative.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: AdministrativeData): Promise<AdministrativeData> {
    await trpcCall("administrative.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("administrative.delete", { id });
  },
};

// Financial Service - API based
export const financialService = {
  async getAll(): Promise<FinancialData[]> {
    try {
      return await trpcCall("expenses.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching financial data:", error);
      return [];
    }
  },

  async create(data: FinancialData): Promise<FinancialData> {
    const result = await trpcCall("expenses.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: FinancialData): Promise<FinancialData> {
    await trpcCall("expenses.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("expenses.delete", { id });
  },
};

// Task Service - API based
export const taskService = {
  async getAll(): Promise<TaskData[]> {
    try {
      return await trpcCall("tasks.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  },

  async create(data: TaskData): Promise<TaskData> {
    const result = await trpcCall("tasks.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: TaskData): Promise<TaskData> {
    await trpcCall("tasks.update", { id, data });
    return { ...data, id };
  },

  async delete(id: number): Promise<void> {
    await trpcCall("tasks.delete", { id });
  },
};

// Admin Service - API based
export const adminService = {
  async getAllUsers(): Promise<AdminUserData[]> {
    try {
      return await trpcCall("admin.getAllUsers", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  },

  async createUser(data: AdminUserData): Promise<AdminUserData> {
    // Not directly supported via tRPC, use register
    return data;
  },

  async updateUser(id: number, data: AdminUserData): Promise<AdminUserData> {
    // Use admin endpoints
    return { ...data, id };
  },

  async deleteUser(id: number): Promise<void> {
    await trpcCall("admin.deleteUser", { userId: id });
  },
};

// Maintenance Entries Service - API based (generic JSON storage)
export const maintenanceEntriesService = {
  async getBySection(section: string): Promise<any[]> {
    try {
      const result = await trpcCall("maintenanceEntries.getBySection", { section }, "query") || [];
      return Array.isArray(result) ? result.map((r: any) => ({
        ...r,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      })) : [];
    } catch (error) {
      console.error("Error fetching maintenance entries:", error);
      return [];
    }
  },

  async create(section: string, data: any, entryPerson?: string, date?: string, userId?: number): Promise<any> {
    const result = await trpcCall("maintenanceEntries.create", { section, data, entryPerson, date, userId });
    return result;
  },

  async update(id: number, data: any, date?: string): Promise<any> {
    const result = await trpcCall("maintenanceEntries.update", { id, data, date });
    return result;
  },

  async delete(id: number): Promise<void> {
    await trpcCall("maintenanceEntries.delete", { id });
  },
};

// Warehouse Entries Service - API based (generic JSON storage)
export const warehouseEntriesService = {
  async getBySection(section: string): Promise<any[]> {
    try {
      const result = await trpcCall("warehouseEntries.getBySection", { section }, "query") || [];
      return Array.isArray(result) ? result.map((r: any) => ({
        ...r,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      })) : [];
    } catch (error) {
      console.error("Error fetching warehouse entries:", error);
      return [];
    }
  },

  async create(section: string, data: any, date?: string, userId?: number): Promise<any> {
    const result = await trpcCall("warehouseEntries.create", { section, data, date, userId });
    return result;
  },

  async update(id: number, data: any, date?: string): Promise<any> {
    const result = await trpcCall("warehouseEntries.update", { id, data, date });
    return result;
  },

  async delete(id: number): Promise<void> {
    await trpcCall("warehouseEntries.delete", { id });
  },
};
