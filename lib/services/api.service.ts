import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";

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

// ===== Admin / User Management =====
export const adminService = {
  getAllUsers: () => trpcCall("admin.getAllUsers", undefined, "query"),
  toggleUserActive: (userId: number) => trpcCall("admin.toggleUserActive", { userId }),
  changeUserRole: (userId: number, role: "user" | "admin") => trpcCall("admin.changeUserRole", { userId, role }),
  deleteUser: (userId: number) => trpcCall("admin.deleteUser", { userId }),
  resetUserPassword: (userId: number, newPassword: string) => trpcCall("admin.resetUserPassword", { userId, newPassword }),
  updateAllowedSections: (userId: number, allowedSections: string[]) => trpcCall("admin.updateAllowedSections", { userId, allowedSections }),
  updateUserDepartment: (userId: number, department: string) => trpcCall("admin.updateUserDepartment", { userId, department }),
  updatePosition: (userId: number, position: string) => trpcCall("admin.updatePosition", { userId, position }),
  updateToolPermissions: (userId: number, toolPermissions: Record<string, boolean>) => trpcCall("admin.updateToolPermissions", { userId, toolPermissions }),
  getPendingUsers: () => trpcCall("admin.getPendingUsers", undefined, "query"),
};

// ===== Tasks =====
export const taskService = {
  getAll: () => trpcCall("tasks.getAll", undefined, "query"),
  create: (data: any) => trpcCall("tasks.create", data),
  update: (id: number, data: any) => trpcCall("tasks.update", { id, data }),
  delete: (id: number) => trpcCall("tasks.delete", { id }),
};

// ===== Administrative Procedures =====
export const administrativeService = {
  getAll: () => trpcCall("administrative.getAll", undefined, "query"),
  create: (data: any) => trpcCall("administrative.create", data),
  update: (id: number, data: any) => trpcCall("administrative.update", { id, data }),
  delete: (id: number) => trpcCall("administrative.delete", { id }),
};

// ===== Production =====
export const productionService = {
  getAll: () => trpcCall("production.getAll", undefined, "query"),
  create: (data: any) => trpcCall("production.create", data),
  createBatch: (entries: any[]) => trpcCall("production.createBatch", { entries }),
  deleteByDate: (date: string) => trpcCall("production.deleteByDate", { date }),
  update: (id: number, data: any) => trpcCall("production.update", { id, data }),
  delete: (id: number) => trpcCall("production.delete", { id }),
};

// ===== Manufacturing Stages =====
export const manufacturingService = {
  getAll: () => trpcCall("manufacturing.getAll", undefined, "query"),
  create: (data: any) => trpcCall("manufacturing.create", data),
  update: (id: number, data: any) => trpcCall("manufacturing.update", { id, data }),
  delete: (id: number) => trpcCall("manufacturing.delete", { id }),
};

// ===== Sales =====
export const salesService = {
  getAll: () => trpcCall("sales.getAll", undefined, "query"),
  create: (data: any) => trpcCall("sales.create", data),
  update: (id: number, data: any) => trpcCall("sales.update", { id, data }),
  delete: (id: number) => trpcCall("sales.delete", { id }),
};

// ===== Collection =====
export const collectionService = {
  getAll: () => trpcCall("collection.getAll", undefined, "query"),
  create: (data: any) => trpcCall("collection.create", data),
  update: (id: number, data: any) => trpcCall("collection.update", { id, data }),
  delete: (id: number) => trpcCall("collection.delete", { id }),
};

// ===== Expenses =====
export const expensesService = {
  getAll: () => trpcCall("expenses.getAll", undefined, "query"),
  create: (data: any) => trpcCall("expenses.create", data),
  update: (id: number, data: any) => trpcCall("expenses.update", { id, data }),
  delete: (id: number) => trpcCall("expenses.delete", { id }),
};

// ===== Maintenance =====
export const maintenanceService = {
  getMaintained: () => trpcCall("maintenance.getMaintained", undefined, "query"),
  getStopped: () => trpcCall("maintenance.getStopped", undefined, "query"),
  getRecommendations: () => trpcCall("maintenance.getRecommendations", undefined, "query"),
  createMaintained: (data: any) => trpcCall("maintenance.createMaintained", data),
  createStopped: (data: any) => trpcCall("maintenance.createStopped", data),
  createRecommendation: (data: any) => trpcCall("maintenance.createRecommendation", data),
  deleteMaintained: (id: number) => trpcCall("maintenance.deleteMaintained", { id }),
  deleteStopped: (id: number) => trpcCall("maintenance.deleteStopped", { id }),
  deleteRecommendation: (id: number) => trpcCall("maintenance.deleteRecommendation", { id }),
};

// ===== Warehouse =====
export const warehouseService = {
  getRawMaterials: () => trpcCall("warehouse.getRawMaterials", undefined, "query"),
  getConsumption: () => trpcCall("warehouse.getConsumption", undefined, "query"),
  getIncoming: () => trpcCall("warehouse.getIncoming", undefined, "query"),
  createRawMaterial: (data: any) => trpcCall("warehouse.createRawMaterial", data),
  createConsumption: (data: any) => trpcCall("warehouse.createConsumption", data),
  createIncoming: (data: any) => trpcCall("warehouse.createIncoming", data),
  deleteRawMaterial: (id: number) => trpcCall("warehouse.deleteRawMaterial", { id }),
  deleteConsumption: (id: number) => trpcCall("warehouse.deleteConsumption", { id }),
  deleteIncoming: (id: number) => trpcCall("warehouse.deleteIncoming", { id }),
};

// ===== Financial =====
export const financialService = {
  getBankBalance: () => trpcCall("financial.getBankBalance", undefined, "query"),
  createBankBalance: (data: any) => trpcCall("financial.createBankBalance", data),
};

// ===== Auth (for password reset) =====
export const authApiService = {
  resetPassword: (username: string, phone: string, newPassword: string) =>
    trpcCall("auth.resetPassword", { username, phone, newPassword }),
};
