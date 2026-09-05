/**
 * نظام الإشعارات الداخلية (In-App Notifications)
 * يدعم أنواع متعددة من الإشعارات مع عداد غير المقروءة
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationType = "production" | "waste" | "task" | "maintenance" | "system" | "admin" | "performance";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

const NOTIFICATIONS_KEY = "app_notifications";

class NotificationsService {
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async getAll(): Promise<AppNotification[]> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (!data) return [];
      const notifications: AppNotification[] = JSON.parse(data);
      return notifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async getUnreadCount(): Promise<number> {
    const all = await this.getAll();
    return all.filter((n) => !n.isRead).length;
  }

  async add(notification: Omit<AppNotification, "id" | "isRead" | "createdAt">): Promise<void> {
    const all = await this.getAll();
    const newNotification: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    all.unshift(newNotification);
    // Keep max 100 notifications
    const trimmed = all.slice(0, 100);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
    this.notify();
  }

  async markAsRead(id: string): Promise<void> {
    const all = await this.getAll();
    const updated = all.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  async markAllAsRead(): Promise<void> {
    const all = await this.getAll();
    const updated = all.map((n) => ({ ...n, isRead: true }));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter((n) => n.id !== id);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
    this.notify();
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
    this.notify();
  }

  async getByType(type: NotificationType): Promise<AppNotification[]> {
    const all = await this.getAll();
    return all.filter((n) => n.type === type);
  }

  // Helper to create common notifications
  async notifyProductionEntry(machineName: string, quantity: number, lang: "ar" | "en" = "ar") {
    await this.add({
      type: "production",
      title: lang === "ar" ? "إدخال إنتاج جديد" : "New Production Entry",
      message:
        lang === "ar"
          ? `تم إدخال ${quantity} درزن من ${machineName}`
          : `${quantity} dozen entered from ${machineName}`,
    });
  }

  async notifyWasteAlert(machineName: string, percentage: number, lang: "ar" | "en" = "ar") {
    await this.add({
      type: "waste",
      title: lang === "ar" ? "تنبيه هدر مرتفع" : "High Waste Alert",
      message:
        lang === "ar"
          ? `نسبة الهدر في ${machineName} بلغت ${percentage.toFixed(1)}%`
          : `Waste rate in ${machineName} reached ${percentage.toFixed(1)}%`,
    });
  }

  async notifyTaskAssigned(taskTitle: string, lang: "ar" | "en" = "ar") {
    await this.add({
      type: "task",
      title: lang === "ar" ? "مهمة جديدة" : "New Task Assigned",
      message:
        lang === "ar" ? `تم تعيين مهمة: ${taskTitle}` : `Task assigned: ${taskTitle}`,
    });
  }

  async notifyMaintenanceRequired(machineName: string, lang: "ar" | "en" = "ar") {
    await this.add({
      type: "maintenance",
      title: lang === "ar" ? "صيانة مطلوبة" : "Maintenance Required",
      message:
        lang === "ar"
          ? `${machineName} تحتاج إلى صيانة`
          : `${machineName} requires maintenance`,
    });
  }

  async notifyAdminAction(action: string, lang: "ar" | "en" = "ar") {
    await this.add({
      type: "admin",
      title: lang === "ar" ? "إجراء إداري" : "Admin Action",
      message: action,
    });
  }
}

export const notificationsService = new NotificationsService();
export default notificationsService;
