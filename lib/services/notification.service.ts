import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "task_completed" | "equipment_stopped" | "waste_exceeded" | "alert" | "info";
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

const NOTIFICATIONS_KEY = "notifications";
const NOTIFICATION_SETTINGS_KEY = "notification_settings";

// لا نستدعي expo-notifications على module level لتجنب crash
// يتم تهيئة الإشعارات فقط عند الحاجة وداخل useEffect

interface NotificationSettings {
  taskCompleted: boolean;
  equipmentStopped: boolean;
  wasteExceeded: boolean;
  alerts: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  taskCompleted: true,
  equipmentStopped: true,
  wasteExceeded: true,
  alerts: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

class NotificationService {
  private initialized = false;

  /**
   * تهيئة الإشعارات - يجب استدعاؤها داخل useEffect فقط
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      if (Platform.OS !== "web") {
        // Lazy import لتجنب crash عند تحميل الملف
        const Notifications = await import("expo-notifications");
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.warn("Notification permission not granted");
        }
      }
      this.initialized = true;

      // تهيئة الإعدادات الافتراضية
      const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (!settings) {
        await AsyncStorage.setItem(
          NOTIFICATION_SETTINGS_KEY,
          JSON.stringify(DEFAULT_SETTINGS)
        );
      }
    } catch (error) {
      console.warn("Error initializing notifications:", error);
    }
  }

  /**
   * إرسال إشعار محلي
   */
  async sendNotification(
    title: string,
    body: string,
    type: Notification["type"],
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const settings = await this.getSettings();

      // التحقق من إعدادات الإشعارات
      if (!this.shouldSendNotification(type, settings)) {
        return;
      }

      // إرسال الإشعار عبر expo-notifications فقط على native
      if (Platform.OS !== "web") {
        try {
          const Notifications = await import("expo-notifications");
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: settings.soundEnabled ? "default" : undefined,
              data: data || {},
            },
            trigger: null, // إرسال فوري
          });
        } catch (e) {
          // Silently fail - notifications are optional
        }
      }

      // حفظ الإشعار في السجل
      await this.saveNotification({
        id: Date.now().toString(),
        title,
        body,
        type,
        timestamp: new Date(),
        read: false,
        data,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  /**
   * إشعار انتهاء المهمة
   */
  async notifyTaskCompleted(taskName: string, completedBy: string): Promise<void> {
    await this.sendNotification(
      "تم إكمال المهمة",
      `تم إكمال مهمة "${taskName}" بواسطة ${completedBy}`,
      "task_completed",
      { taskName, completedBy }
    );
  }

  /**
   * إشعار توقف الجهاز
   */
  async notifyEquipmentStopped(
    equipmentName: string,
    reason: string
  ): Promise<void> {
    await this.sendNotification(
      "توقف الجهاز",
      `توقف جهاز "${equipmentName}" - السبب: ${reason}`,
      "equipment_stopped",
      { equipmentName, reason }
    );
  }

  /**
   * إشعار تجاوز الهدر
   */
  async notifyWasteExceeded(
    percentage: number,
    limit: number
  ): Promise<void> {
    await this.sendNotification(
      "تحذير: تجاوز الهدر",
      `معدل الهدر الحالي ${percentage}% تجاوز الحد المسموح به ${limit}%`,
      "waste_exceeded",
      { percentage, limit }
    );
  }

  /**
   * إشعار تنبيه عام
   */
  async notifyAlert(title: string, message: string): Promise<void> {
    await this.sendNotification(title, message, "alert");
  }

  /**
   * إشعار معلومات
   */
  async notifyInfo(title: string, message: string): Promise<void> {
    await this.sendNotification(title, message, "info");
  }

  /**
   * حفظ الإشعار في السجل
   */
  private async saveNotification(notification: Notification): Promise<void> {
    try {
      const notificationsJson = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      const notifications: Notification[] = notificationsJson
        ? JSON.parse(notificationsJson)
        : [];

      notifications.unshift(notification);

      // الاحتفاظ بآخر 100 إشعار فقط
      if (notifications.length > 100) {
        notifications.pop();
      }

      await AsyncStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify(notifications)
      );
    } catch (error) {
      console.error("Error saving notification:", error);
    }
  }

  /**
   * الحصول على جميع الإشعارات
   */
  async getAllNotifications(): Promise<Notification[]> {
    try {
      const notificationsJson = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      return notificationsJson ? JSON.parse(notificationsJson) : [];
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  }

  /**
   * الحصول على الإشعارات غير المقروءة
   */
  async getUnreadNotifications(): Promise<Notification[]> {
    try {
      const notifications = await this.getAllNotifications();
      return notifications.filter((n) => !n.read);
    } catch (error) {
      console.error("Error getting unread notifications:", error);
      return [];
    }
  }

  /**
   * تحديد الإشعار كمقروء
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const notification = notifications.find((n) => n.id === notificationId);

      if (notification) {
        notification.read = true;
        await AsyncStorage.setItem(
          NOTIFICATIONS_KEY,
          JSON.stringify(notifications)
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  /**
   * تحديد جميع الإشعارات كمقروءة
   */
  async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      notifications.forEach((n) => {
        n.read = true;
      });
      await AsyncStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify(notifications)
      );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  /**
   * حذف الإشعار
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const filtered = notifications.filter((n) => n.id !== notificationId);
      await AsyncStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }

  /**
   * حذف جميع الإشعارات
   */
  async deleteAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    } catch (error) {
      console.error("Error deleting all notifications:", error);
    }
  }

  /**
   * الحصول على إعدادات الإشعارات
   */
  async getSettings(): Promise<NotificationSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return settingsJson ? JSON.parse(settingsJson) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Error getting notification settings:", error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * تحديث إعدادات الإشعارات
   */
  async updateSettings(
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(updatedSettings)
      );
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  }

  /**
   * التحقق من ما إذا كان يجب إرسال الإشعار
   */
  private shouldSendNotification(
    type: Notification["type"],
    settings: NotificationSettings
  ): boolean {
    switch (type) {
      case "task_completed":
        return settings.taskCompleted;
      case "equipment_stopped":
        return settings.equipmentStopped;
      case "waste_exceeded":
        return settings.wasteExceeded;
      case "alert":
        return settings.alerts;
      case "info":
        return true;
      default:
        return true;
    }
  }
}

export const notificationService = new NotificationService();
