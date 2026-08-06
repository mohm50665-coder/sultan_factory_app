import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";

export interface BackupData {
  version: string;
  createdAt: string;
  createdBy: string;
  data: Record<string, any>;
}

const BACKUP_KEYS = [
  "sultan_production_entries",
  "sultan_manufacturing_stages",
  "sultan_warehouse_raw",
  "sultan_warehouse_finished",
  "sultan_warehouse_out",
  "sultan_sales_entries",
  "sultan_collection_entries",
  "sultan_financial_entries",
  "sultan_maintenance_entries",
  "sultan_tasks_entries",
  "sultan_administrative_entries",
  "users",
  "activity_log",
  "notifications_data",
  "waste_alert_settings",
  "app_settings",
];

class BackupService {
  async createBackup(username: string): Promise<BackupData> {
    const data: Record<string, any> = {};

    for (const key of BACKUP_KEYS) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          data[key] = JSON.parse(value);
        }
      } catch (e) {
        // Skip invalid keys
      }
    }

    const backup: BackupData = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      createdBy: username,
      data,
    };

    return backup;
  }

  async restoreBackup(backup: BackupData): Promise<{ restored: number; errors: number }> {
    let restored = 0;
    let errors = 0;

    for (const [key, value] of Object.entries(backup.data)) {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
        restored++;
      } catch (e) {
        errors++;
      }
    }

    return { restored, errors };
  }

  async exportBackup(username: string): Promise<string> {
    const backup = await this.createBackup(username);
    const json = JSON.stringify(backup, null, 2);

    if (Platform.OS === "web") {
      // Web: download as file
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sultan_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return "downloaded";
    } else {
      // Native: share via system share
      await Share.share({
        message: json,
        title: `sultan_backup_${new Date().toISOString().split("T")[0]}.json`,
      });
      return "shared";
    }
  }

  async getBackupStats(): Promise<{ totalKeys: number; totalSize: string; lastBackup: string | null }> {
    let totalSize = 0;
    let totalKeys = 0;

    for (const key of BACKUP_KEYS) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalKeys++;
          totalSize += value.length;
        }
      } catch (e) {}
    }

    const lastBackup = await AsyncStorage.getItem("last_backup_date");

    return {
      totalKeys,
      totalSize: totalSize > 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${totalSize} bytes`,
      lastBackup,
    };
  }

  async saveLastBackupDate(): Promise<void> {
    await AsyncStorage.setItem("last_backup_date", new Date().toISOString());
  }
}

export const backupService = new BackupService();
