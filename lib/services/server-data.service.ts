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
    if (body !== undefined) {
      const input = encodeURIComponent(JSON.stringify({ json: body }));
      url += `?input=${input}`;
    }
    options = { method: "GET", headers };
  } else {
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

  return data.result?.data?.json;
}

// ===== PRODUCTION COSTS SERVICE =====
export interface CostEntry {
  id?: number;
  date: string;
  threadCost?: number;
  rubberCost?: number;
  spandexCost?: number;
  nylonCost?: number;
  cottonCost?: number;
  bambooCost?: number;
  spanCost?: number;
  laborCost?: number;
  utilitiesCost?: number;
  maintenanceCost?: number;
  otherCost?: number;
  totalCost?: number;
  userId: number;
}

export const costsService = {
  async getAll(): Promise<CostEntry[]> {
    try {
      return await trpcCall("costs.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching costs:", error);
      return [];
    }
  },

  async getByDateRange(startDate: string, endDate: string): Promise<CostEntry[]> {
    try {
      return await trpcCall("costs.getByDateRange", { startDate, endDate }, "query") || [];
    } catch (error) {
      console.error("Error fetching costs by date:", error);
      return [];
    }
  },

  async create(data: CostEntry): Promise<CostEntry> {
    const result = await trpcCall("costs.create", data);
    return { ...data, id: result?.id };
  },

  async update(id: number, data: Partial<CostEntry>): Promise<void> {
    await trpcCall("costs.update", { id, data });
  },

  async delete(id: number): Promise<void> {
    await trpcCall("costs.delete", { id });
  },
};

// ===== ALERTS SERVICE =====
export interface AlertEntry {
  id?: number;
  type: "cost_exceeded" | "low_productivity" | "pending_procedure" | "quality_issue" | "safety_alert";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read?: number;
  userId: number;
  data?: any;
  createdAt?: string;
}

export const alertsService = {
  async getAll(): Promise<AlertEntry[]> {
    try {
      return await trpcCall("alerts.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching alerts:", error);
      return [];
    }
  },

  async getByUser(userId: number): Promise<AlertEntry[]> {
    try {
      return await trpcCall("alerts.getByUser", { userId }, "query") || [];
    } catch (error) {
      console.error("Error fetching user alerts:", error);
      return [];
    }
  },

  async getUnread(userId: number): Promise<AlertEntry[]> {
    try {
      return await trpcCall("alerts.getUnread", { userId }, "query") || [];
    } catch (error) {
      console.error("Error fetching unread alerts:", error);
      return [];
    }
  },

  async create(data: Omit<AlertEntry, "id" | "read" | "createdAt">): Promise<AlertEntry> {
    const result = await trpcCall("alerts.create", data);
    return { ...data, id: result?.id, read: 0 };
  },

  async markAsRead(id: number): Promise<void> {
    await trpcCall("alerts.markAsRead", { id });
  },

  async markAllAsRead(userId: number): Promise<void> {
    await trpcCall("alerts.markAllAsRead", { userId });
  },

  async delete(id: number): Promise<void> {
    await trpcCall("alerts.delete", { id });
  },
};

// ===== BACKUPS SERVICE =====
export interface BackupEntry {
  id?: number;
  backupName: string;
  backupType: "manual" | "automatic" | "scheduled";
  dataSize?: number;
  status?: string;
  backupPath?: string;
  errorMessage?: string;
  userId: number;
  createdAt?: string;
}

export const backupsService = {
  async getAll(): Promise<BackupEntry[]> {
    try {
      return await trpcCall("backups.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching backups:", error);
      return [];
    }
  },

  async create(data: { backupName: string; backupType: "manual" | "automatic" | "scheduled"; userId: number }): Promise<{ id: number; dataSize: number }> {
    const result = await trpcCall("backups.create", data);
    return { id: result?.id, dataSize: result?.dataSize };
  },

  async updateStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    await trpcCall("backups.updateStatus", { id, status, errorMessage });
  },

  async delete(id: number): Promise<void> {
    await trpcCall("backups.delete", { id });
  },
};

// ===== ACTIVITY LOG SERVICE =====
export interface ActivityLogEntry {
  id?: number;
  action: string;
  entityType: string;
  entityId?: number;
  details?: any;
  userId: number;
  createdAt?: string;
}

export const activityLogService = {
  async getAll(limit?: number): Promise<ActivityLogEntry[]> {
    try {
      return await trpcCall("activityLog.getAll", limit ? { limit } : undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching activity log:", error);
      return [];
    }
  },

  async getByUser(userId: number, limit?: number): Promise<ActivityLogEntry[]> {
    try {
      return await trpcCall("activityLog.getByUser", { userId, limit }, "query") || [];
    } catch (error) {
      console.error("Error fetching user activity:", error);
      return [];
    }
  },

  async log(action: string, entityType: string, userId: number, entityId?: number, details?: any): Promise<void> {
    try {
      await trpcCall("activityLog.create", { action, entityType, entityId, details, userId });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  },
};

// ===== REPORTS SERVICE =====
export interface ReportEntry {
  id?: number;
  reportName: string;
  reportType: "production" | "cost" | "sales" | "performance" | "quality" | "maintenance";
  startDate: string;
  endDate: string;
  data?: any;
  generatedBy: number;
  createdAt?: string;
}

export const reportsService = {
  async getAll(): Promise<ReportEntry[]> {
    try {
      return await trpcCall("reports.getAll", undefined, "query") || [];
    } catch (error) {
      console.error("Error fetching reports:", error);
      return [];
    }
  },

  async getByType(reportType: string): Promise<ReportEntry[]> {
    try {
      return await trpcCall("reports.getByType", { reportType }, "query") || [];
    } catch (error) {
      console.error("Error fetching reports by type:", error);
      return [];
    }
  },

  async create(data: Omit<ReportEntry, "id" | "createdAt">): Promise<ReportEntry> {
    const result = await trpcCall("reports.create", data);
    return { ...data, id: result?.id };
  },

  async generateComprehensive(startDate: string, endDate: string, generatedBy: number): Promise<any> {
    const result = await trpcCall("reports.generateComprehensive", { startDate, endDate, generatedBy });
    return result;
  },

  async delete(id: number): Promise<void> {
    await trpcCall("reports.delete", { id });
  },
};

// ===== ADMIN DATA SERVICE =====
export interface DataSummary {
  production: number;
  sales: number;
  expenses: number;
  tasks: number;
  users: number;
  costs: number;
  unreadAlerts: number;
  collection: number;
  manufacturing: number;
}

export const adminDataService = {
  async getSummary(): Promise<DataSummary | null> {
    try {
      return await trpcCall("adminData.getSummary", undefined, "query");
    } catch (error) {
      console.error("Error fetching admin summary:", error);
      return null;
    }
  },

  async updateProduction(id: number, data: any): Promise<void> {
    await trpcCall("adminData.updateProduction", { id, data });
  },

  async updateTask(id: number, data: any): Promise<void> {
    await trpcCall("adminData.updateTask", { id, data });
  },

  async updateSale(id: number, data: any): Promise<void> {
    await trpcCall("adminData.updateSale", { id, data });
  },

  async updateExpense(id: number, data: any): Promise<void> {
    await trpcCall("adminData.updateExpense", { id, data });
  },

  async deleteEntry(table: string, id: number): Promise<void> {
    await trpcCall("adminData.deleteEntry", { table, id });
  },
};
