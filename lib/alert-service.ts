import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Alert {
  id: string;
  type: "cost_exceeded" | "low_productivity" | "pending_procedure" | "quality_issue" | "safety_alert";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  read: boolean;
  data?: Record<string, any>;
}

const ALERTS_STORAGE_KEY = "app_alerts";
const MAX_ALERTS = 100;

class AlertService {
  /**
   * إضافة تنبيه جديد
   */
  async addAlert(
    type: Alert["type"],
    title: string,
    message: string,
    severity: Alert["severity"],
    data?: Record<string, any>
  ): Promise<Alert> {
    try {
      const alerts = await this.getAlerts();

      const newAlert: Alert = {
        id: Date.now().toString(),
        type,
        title,
        message,
        severity,
        timestamp: new Date().toISOString(),
        read: false,
        data,
      };

      // إضافة التنبيه الجديد في البداية
      const updatedAlerts = [newAlert, ...alerts].slice(0, MAX_ALERTS);

      await AsyncStorage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify(updatedAlerts)
      );

      return newAlert;
    } catch (error) {
      console.error("Error adding alert:", error);
      throw error;
    }
  }

  /**
   * الحصول على جميع التنبيهات
   */
  async getAlerts(): Promise<Alert[]> {
    try {
      const data = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting alerts:", error);
      return [];
    }
  }

  /**
   * الحصول على التنبيهات غير المقروءة
   */
  async getUnreadAlerts(): Promise<Alert[]> {
    try {
      const alerts = await this.getAlerts();
      return alerts.filter((alert) => !alert.read);
    } catch (error) {
      console.error("Error getting unread alerts:", error);
      return [];
    }
  }

  /**
   * الحصول على عدد التنبيهات غير المقروءة
   */
  async getUnreadCount(): Promise<number> {
    try {
      const unread = await this.getUnreadAlerts();
      return unread.length;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  /**
   * تحديد التنبيه كمقروء
   */
  async markAsRead(alertId: string): Promise<void> {
    try {
      const alerts = await this.getAlerts();
      const updated = alerts.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      );
      await AsyncStorage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error("Error marking alert as read:", error);
      throw error;
    }
  }

  /**
   * تحديد جميع التنبيهات كمقروءة
   */
  async markAllAsRead(): Promise<void> {
    try {
      const alerts = await this.getAlerts();
      const updated = alerts.map((alert) => ({ ...alert, read: true }));
      await AsyncStorage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error("Error marking all alerts as read:", error);
      throw error;
    }
  }

  /**
   * حذف تنبيه
   */
  async deleteAlert(alertId: string): Promise<void> {
    try {
      const alerts = await this.getAlerts();
      const updated = alerts.filter((alert) => alert.id !== alertId);
      await AsyncStorage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error("Error deleting alert:", error);
      throw error;
    }
  }

  /**
   * حذف جميع التنبيهات
   */
  async clearAllAlerts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ALERTS_STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing alerts:", error);
      throw error;
    }
  }

  /**
   * الحصول على التنبيهات حسب النوع
   */
  async getAlertsByType(type: Alert["type"]): Promise<Alert[]> {
    try {
      const alerts = await this.getAlerts();
      return alerts.filter((alert) => alert.type === type);
    } catch (error) {
      console.error("Error getting alerts by type:", error);
      return [];
    }
  }

  /**
   * الحصول على التنبيهات حسب الخطورة
   */
  async getAlertsBySeverity(severity: Alert["severity"]): Promise<Alert[]> {
    try {
      const alerts = await this.getAlerts();
      return alerts.filter((alert) => alert.severity === severity);
    } catch (error) {
      console.error("Error getting alerts by severity:", error);
      return [];
    }
  }

  /**
   * فحص وإنشاء تنبيهات تلقائية
   */
  async checkAndCreateAlerts(): Promise<void> {
    try {
      // فحص تجاوز التكاليف
      await this.checkCostExceeded();

      // فحص انخفاض الإنتاجية
      await this.checkLowProductivity();

      // فحص الإجراءات المعلقة
      await this.checkPendingProcedures();

      // فحص مشاكل الجودة
      await this.checkQualityIssues();
    } catch (error) {
      console.error("Error checking and creating alerts:", error);
    }
  }

  /**
   * فحص تجاوز التكاليف
   */
  private async checkCostExceeded(): Promise<void> {
    try {
      const costs = await AsyncStorage.getItem("production_costs");
      if (!costs) return;

      const costsList = JSON.parse(costs);
      const today = new Date().toISOString().split("T")[0];
      const todaysCosts = costsList.filter((c: any) => c.date === today);

      if (todaysCosts.length === 0) return;

      const totalCost = todaysCosts.reduce(
        (sum: number, c: any) =>
          sum +
          Object.values(c.rawMaterials).reduce((a: number, b: any) => a + b, 0) +
          c.labor +
          c.utilities +
          c.maintenance +
          c.other,
        0
      );

      const expectedCost = 50000; // الحد المسموح

      if (totalCost > expectedCost) {
        const existingAlert = await this.getAlertsByType("cost_exceeded");
        const todayAlert = existingAlert.find(
          (a) => a.timestamp.split("T")[0] === today
        );

        if (!todayAlert) {
          await this.addAlert(
            "cost_exceeded",
            "تجاوز التكاليف",
            `تكلفة الإنتاج اليومية (${totalCost.toFixed(0)}) تجاوزت الحد المسموح (${expectedCost})`,
            "critical",
            { totalCost, expectedCost, excess: totalCost - expectedCost }
          );
        }
      }
    } catch (error) {
      console.error("Error checking cost exceeded:", error);
    }
  }

  /**
   * فحص انخفاض الإنتاجية
   */
  private async checkLowProductivity(): Promise<void> {
    try {
      const production = await AsyncStorage.getItem("production_entries");
      if (!production) return;

      const productionList = JSON.parse(production);
      const today = new Date().toISOString().split("T")[0];
      const todaysProduction = productionList.filter(
        (p: any) => p.date === today
      );

      if (todaysProduction.length === 0) return;

      const totalProduction = todaysProduction.reduce(
        (sum: number, p: any) => sum + (p.quantity || 0),
        0
      );

      const expectedProduction = 5000; // الحد المتوقع

      if (totalProduction < expectedProduction * 0.9) {
        // أقل من 90% من المتوقع
        const existingAlert = await this.getAlertsByType("low_productivity");
        const todayAlert = existingAlert.find(
          (a) => a.timestamp.split("T")[0] === today
        );

        if (!todayAlert) {
          await this.addAlert(
            "low_productivity",
            "انخفاض الإنتاجية",
            `الإنتاج اليومي (${totalProduction}) أقل من المتوقع (${expectedProduction})`,
            "warning",
            { totalProduction, expectedProduction }
          );
        }
      }
    } catch (error) {
      console.error("Error checking low productivity:", error);
    }
  }

  /**
   * فحص الإجراءات المعلقة
   */
  private async checkPendingProcedures(): Promise<void> {
    try {
      const procedures = await AsyncStorage.getItem("administrative_procedures");
      if (!procedures) return;

      const proceduresList = JSON.parse(procedures);
      const pendingCount = proceduresList.filter(
        (p: any) => p.status === "pending"
      ).length;

      if (pendingCount > 0) {
        const existingAlert = await this.getAlertsByType("pending_procedure");
        if (existingAlert.length === 0) {
          await this.addAlert(
            "pending_procedure",
            "إجراءات إدارية معلقة",
            `هناك ${pendingCount} إجراءات إدارية معلقة تحتاج إلى مراجعة`,
            "warning",
            { pendingCount }
          );
        }
      }
    } catch (error) {
      console.error("Error checking pending procedures:", error);
    }
  }

  /**
   * فحص مشاكل الجودة
   */
  private async checkQualityIssues(): Promise<void> {
    try {
      const production = await AsyncStorage.getItem("production_entries");
      if (!production) return;

      const productionList = JSON.parse(production);
      const today = new Date().toISOString().split("T")[0];
      const todaysProduction = productionList.filter(
        (p: any) => p.date === today
      );

      if (todaysProduction.length === 0) return;

      const totalWaste = todaysProduction.reduce(
        (sum: number, p: any) =>
          sum +
          (p.threadWaste || 0) +
          (p.defectiveWaste || 0) +
          (p.needleWaste || 0),
        0
      );

      const totalProduction = todaysProduction.reduce(
        (sum: number, p: any) => sum + (p.quantity || 0),
        0
      );

      const wastePercentage = (totalWaste / (totalProduction + totalWaste)) * 100;

      if (wastePercentage > 5) {
        // أكثر من 5% هدر
        const existingAlert = await this.getAlertsByType("quality_issue");
        const todayAlert = existingAlert.find(
          (a) => a.timestamp.split("T")[0] === today
        );

        if (!todayAlert) {
          await this.addAlert(
            "quality_issue",
            "مشكلة جودة",
            `نسبة الهدر اليومية (${wastePercentage.toFixed(1)}%) تجاوزت الحد المسموح (5%)`,
            "warning",
            { wastePercentage, totalWaste }
          );
        }
      }
    } catch (error) {
      console.error("Error checking quality issues:", error);
    }
  }
}

export const alertService = new AlertService();
