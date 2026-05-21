import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SyncStatus {
  lastSync: Date | null;
  isSyncing: boolean;
  pendingChanges: number;
  syncErrors: string[];
}

interface SyncData {
  key: string;
  data: any;
  timestamp: Date;
  version: number;
}

interface CloudBackup {
  userId: string;
  backupDate: Date;
  data: Record<string, any>;
  version: number;
}

const SYNC_STATUS_KEY = "sync_status";
const PENDING_CHANGES_KEY = "pending_changes";
const CLOUD_BACKUP_KEY = "cloud_backup";

class CloudSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 دقائق

  /**
   * تهيئة خدمة المزامنة السحابية
   */
  async initialize(userId: string): Promise<void> {
    try {
      // تهيئة حالة المزامنة
      const status = await this.getSyncStatus();
      if (!status) {
        await this.setSyncStatus({
          lastSync: null,
          isSyncing: false,
          pendingChanges: 0,
          syncErrors: [],
        });
      }

      // بدء المزامنة الدورية
      this.startAutoSync();
    } catch (error) {
      console.error("Error initializing cloud sync:", error);
    }
  }

  /**
   * بدء المزامنة التلقائية
   */
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.syncData();
    }, this.SYNC_INTERVAL);
  }

  /**
   * إيقاف المزامنة التلقائية
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * مزامنة البيانات مع السحابة
   */
  async syncData(): Promise<boolean> {
    try {
      const status = await this.getSyncStatus();
      if (!status) return false;

      // تجنب المزامنة المتزامنة
      if (status.isSyncing) {
        return false;
      }

      // تحديث حالة المزامنة
      await this.setSyncStatus({
        ...status,
        isSyncing: true,
      });

      // جلب التغييرات المعلقة
      const pendingChanges = await this.getPendingChanges();

      if (pendingChanges.length === 0) {
        await this.setSyncStatus({
          ...status,
          isSyncing: false,
          lastSync: new Date(),
        });
        return true;
      }

      // محاكاة إرسال البيانات إلى السحابة
      // في تطبيق حقيقي، ستكون هناك استدعاءات API فعلية
      await this.uploadToCloud(pendingChanges);

      // مسح التغييرات المعلقة
      await AsyncStorage.removeItem(PENDING_CHANGES_KEY);

      // تحديث حالة المزامنة
      await this.setSyncStatus({
        lastSync: new Date(),
        isSyncing: false,
        pendingChanges: 0,
        syncErrors: [],
      });

      return true;
    } catch (error) {
      console.error("Error syncing data:", error);

      // تسجيل الخطأ
      const status = await this.getSyncStatus();
      if (status) {
        await this.setSyncStatus({
          ...status,
          isSyncing: false,
          syncErrors: [
            ...status.syncErrors,
            `خطأ في المزامنة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
          ],
        });
      }

      return false;
    }
  }

  /**
   * تسجيل تغيير معلق
   */
  async recordChange(
    key: string,
    data: any,
    operation: "create" | "update" | "delete"
  ): Promise<void> {
    try {
      const pendingChanges = await this.getPendingChanges();

      const change: SyncData = {
        key,
        data,
        timestamp: new Date(),
        version: 1,
      };

      // إضافة التغيير إلى قائمة التغييرات المعلقة
      pendingChanges.push(change);

      await AsyncStorage.setItem(
        PENDING_CHANGES_KEY,
        JSON.stringify(pendingChanges)
      );

      // تحديث عدد التغييرات المعلقة
      const status = await this.getSyncStatus();
      if (status) {
        await this.setSyncStatus({
          ...status,
          pendingChanges: pendingChanges.length,
        });
      }
    } catch (error) {
      console.error("Error recording change:", error);
    }
  }

  /**
   * إنشاء نسخة احتياطية سحابية
   */
  async createCloudBackup(userId: string, allData: Record<string, any>): Promise<void> {
    try {
      const backup: CloudBackup = {
        userId,
        backupDate: new Date(),
        data: allData,
        version: 1,
      };

      // حفظ النسخة الاحتياطية محلياً (في تطبيق حقيقي، ستُرسل إلى السحابة)
      await AsyncStorage.setItem(CLOUD_BACKUP_KEY, JSON.stringify(backup));

      console.log("Cloud backup created successfully");
    } catch (error) {
      console.error("Error creating cloud backup:", error);
    }
  }

  /**
   * استعادة النسخة الاحتياطية السحابية
   */
  async restoreCloudBackup(): Promise<CloudBackup | null> {
    try {
      const backupJson = await AsyncStorage.getItem(CLOUD_BACKUP_KEY);
      return backupJson ? JSON.parse(backupJson) : null;
    } catch (error) {
      console.error("Error restoring cloud backup:", error);
      return null;
    }
  }

  /**
   * الحصول على حالة المزامنة
   */
  async getSyncStatus(): Promise<SyncStatus | null> {
    try {
      const statusJson = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      return statusJson ? JSON.parse(statusJson) : null;
    } catch (error) {
      console.error("Error getting sync status:", error);
      return null;
    }
  }

  /**
   * تعيين حالة المزامنة
   */
  private async setSyncStatus(status: SyncStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error("Error setting sync status:", error);
    }
  }

  /**
   * الحصول على التغييرات المعلقة
   */
  private async getPendingChanges(): Promise<SyncData[]> {
    try {
      const changesJson = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
      return changesJson ? JSON.parse(changesJson) : [];
    } catch (error) {
      console.error("Error getting pending changes:", error);
      return [];
    }
  }

  /**
   * رفع البيانات إلى السحابة (محاكاة)
   */
  private async uploadToCloud(changes: SyncData[]): Promise<void> {
    // محاكاة تأخير الشبكة
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // في تطبيق حقيقي، ستكون هناك استدعاءات API فعلية
    console.log(`Uploaded ${changes.length} changes to cloud`);
  }

  /**
   * مسح جميع البيانات المحلية والسحابية
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SYNC_STATUS_KEY);
      await AsyncStorage.removeItem(PENDING_CHANGES_KEY);
      await AsyncStorage.removeItem(CLOUD_BACKUP_KEY);
    } catch (error) {
      console.error("Error clearing all data:", error);
    }
  }

  /**
   * الحصول على حجم البيانات المحلية
   */
  async getLocalDataSize(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error("Error getting local data size:", error);
      return 0;
    }
  }

  /**
   * تحسين استخدام التخزين بحذف البيانات القديمة
   */
  async optimizeStorage(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const allKeys = await AsyncStorage.getAllKeys();

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          try {
            const data = JSON.parse(value);
            if (data.timestamp) {
              const itemDate = new Date(data.timestamp);
              if (itemDate < cutoffDate) {
                await AsyncStorage.removeItem(key);
              }
            }
          } catch {
            // تجاهل الأخطاء في التحليل
          }
        }
      }

      console.log("Storage optimization completed");
    } catch (error) {
      console.error("Error optimizing storage:", error);
    }
  }
}

export const cloudSyncService = new CloudSyncService();
