import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: "create" | "update" | "delete" | "login" | "logout" | "export" | "alert";
  module: string; // production, sales, warehouse, maintenance, financial, users, etc.
  description: string;
  details?: string;
  timestamp: string;
}

const ACTIVITY_LOG_KEY = "activity_log";
const MAX_LOG_ENTRIES = 500;

export const activityLogService = {
  async addEntry(entry: Omit<ActivityLogEntry, "id" | "timestamp">): Promise<void> {
    try {
      const logsJson = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
      const logs: ActivityLogEntry[] = logsJson ? JSON.parse(logsJson) : [];

      const newEntry: ActivityLogEntry = {
        ...entry,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
      };

      logs.unshift(newEntry);

      // Keep only the latest MAX_LOG_ENTRIES
      if (logs.length > MAX_LOG_ENTRIES) {
        logs.splice(MAX_LOG_ENTRIES);
      }

      await AsyncStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error("Failed to add activity log entry:", error);
    }
  },

  async getEntries(filters?: {
    module?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ActivityLogEntry[]> {
    try {
      const logsJson = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
      let logs: ActivityLogEntry[] = logsJson ? JSON.parse(logsJson) : [];

      if (filters) {
        if (filters.module) {
          logs = logs.filter((l) => l.module === filters.module);
        }
        if (filters.action) {
          logs = logs.filter((l) => l.action === filters.action);
        }
        if (filters.userId) {
          logs = logs.filter((l) => l.userId === filters.userId);
        }
        if (filters.startDate) {
          logs = logs.filter((l) => l.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          logs = logs.filter((l) => l.timestamp <= filters.endDate!);
        }
      }

      return logs;
    } catch (error) {
      console.error("Failed to get activity log entries:", error);
      return [];
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACTIVITY_LOG_KEY);
    } catch (error) {
      console.error("Failed to clear activity log:", error);
    }
  },

  async getStats(): Promise<{
    total: number;
    today: number;
    byModule: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    try {
      const logsJson = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
      const logs: ActivityLogEntry[] = logsJson ? JSON.parse(logsJson) : [];

      const today = new Date().toISOString().split("T")[0];
      const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));

      const byModule: Record<string, number> = {};
      const byAction: Record<string, number> = {};

      logs.forEach((l) => {
        byModule[l.module] = (byModule[l.module] || 0) + 1;
        byAction[l.action] = (byAction[l.action] || 0) + 1;
      });

      return {
        total: logs.length,
        today: todayLogs.length,
        byModule,
        byAction,
      };
    } catch (error) {
      console.error("Failed to get activity log stats:", error);
      return { total: 0, today: 0, byModule: {}, byAction: {} };
    }
  },
};
