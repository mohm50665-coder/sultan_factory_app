import AsyncStorage from "@react-native-async-storage/async-storage";
import { activityLogService } from "./activity-log";

export interface WasteThreshold {
  id: string;
  machineId: string; // "all" for global threshold
  maxWastePercentage: number; // percentage (e.g., 5 means 5%)
  maxNeedlesPerDay: number; // max needles waste per day
  maxSecondGradePercentage: number; // max second grade percentage
  isActive: boolean;
}

export interface WasteAlert {
  id: string;
  machineId: string;
  date: string;
  alertType: "waste_percentage" | "needles_excess" | "second_grade";
  currentValue: number;
  threshold: number;
  message: string;
  isRead: boolean;
  timestamp: string;
}

const THRESHOLDS_KEY = "waste_thresholds";
const ALERTS_KEY = "waste_alerts";

const DEFAULT_THRESHOLDS: WasteThreshold[] = [
  {
    id: "default",
    machineId: "all",
    maxWastePercentage: 5,
    maxNeedlesPerDay: 10,
    maxSecondGradePercentage: 3,
    isActive: true,
  },
];

export const wasteAlertsService = {
  async getThresholds(): Promise<WasteThreshold[]> {
    try {
      const json = await AsyncStorage.getItem(THRESHOLDS_KEY);
      if (!json) {
        await AsyncStorage.setItem(THRESHOLDS_KEY, JSON.stringify(DEFAULT_THRESHOLDS));
        return DEFAULT_THRESHOLDS;
      }
      return JSON.parse(json);
    } catch (error) {
      console.error("Failed to get thresholds:", error);
      return DEFAULT_THRESHOLDS;
    }
  },

  async updateThreshold(threshold: WasteThreshold): Promise<void> {
    try {
      const thresholds = await this.getThresholds();
      const index = thresholds.findIndex((t) => t.id === threshold.id);
      if (index >= 0) {
        thresholds[index] = threshold;
      } else {
        thresholds.push(threshold);
      }
      await AsyncStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
    } catch (error) {
      console.error("Failed to update threshold:", error);
    }
  },

  async getAlerts(onlyUnread?: boolean): Promise<WasteAlert[]> {
    try {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      let alerts: WasteAlert[] = json ? JSON.parse(json) : [];
      if (onlyUnread) {
        alerts = alerts.filter((a) => !a.isRead);
      }
      return alerts;
    } catch (error) {
      console.error("Failed to get alerts:", error);
      return [];
    }
  },

  async markAsRead(alertId: string): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      const alerts: WasteAlert[] = json ? JSON.parse(json) : [];
      const index = alerts.findIndex((a) => a.id === alertId);
      if (index >= 0) {
        alerts[index].isRead = true;
        await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
      }
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      const alerts: WasteAlert[] = json ? JSON.parse(json) : [];
      alerts.forEach((a) => (a.isRead = true));
      await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error("Failed to mark all alerts as read:", error);
    }
  },

  async clearAlerts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ALERTS_KEY);
    } catch (error) {
      console.error("Failed to clear alerts:", error);
    }
  },

  async checkAndGenerateAlerts(productionData: {
    machineId: string;
    date: string;
    productionPairs: number;
    wasteThread: number;
    wasteSocks: number;
    secondGrade: number;
    wasteNeedles: number;
    userName?: string;
  }): Promise<WasteAlert[]> {
    try {
      const thresholds = await this.getThresholds();
      const activeThreshold = thresholds.find(
        (t) => t.isActive && (t.machineId === "all" || t.machineId === productionData.machineId)
      );

      if (!activeThreshold || productionData.productionPairs === 0) return [];

      const newAlerts: WasteAlert[] = [];

      // Check waste percentage (thread + socks waste relative to production)
      const totalWasteGrams = productionData.wasteThread + productionData.wasteSocks;
      // Assuming ~50g per pair average weight for percentage calculation
      const estimatedProductionWeight = productionData.productionPairs * 50;
      const wastePercentage = estimatedProductionWeight > 0
        ? (totalWasteGrams / estimatedProductionWeight) * 100
        : 0;

      if (wastePercentage > activeThreshold.maxWastePercentage) {
        newAlerts.push({
          id: Date.now().toString() + "_waste",
          machineId: productionData.machineId,
          date: productionData.date,
          alertType: "waste_percentage",
          currentValue: parseFloat(wastePercentage.toFixed(2)),
          threshold: activeThreshold.maxWastePercentage,
          message: `تجاوز نسبة الهدر في المكينة ${productionData.machineId}: ${wastePercentage.toFixed(2)}% (الحد المسموح: ${activeThreshold.maxWastePercentage}%)`,
          isRead: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Check needles waste
      if (productionData.wasteNeedles > activeThreshold.maxNeedlesPerDay) {
        newAlerts.push({
          id: Date.now().toString() + "_needles",
          machineId: productionData.machineId,
          date: productionData.date,
          alertType: "needles_excess",
          currentValue: productionData.wasteNeedles,
          threshold: activeThreshold.maxNeedlesPerDay,
          message: `تجاوز هدر الإبر في المكينة ${productionData.machineId}: ${productionData.wasteNeedles} حبة (الحد المسموح: ${activeThreshold.maxNeedlesPerDay})`,
          isRead: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Check second grade percentage
      const secondGradePercentage = (productionData.secondGrade / productionData.productionPairs) * 100;
      if (secondGradePercentage > activeThreshold.maxSecondGradePercentage) {
        newAlerts.push({
          id: Date.now().toString() + "_second",
          machineId: productionData.machineId,
          date: productionData.date,
          alertType: "second_grade",
          currentValue: parseFloat(secondGradePercentage.toFixed(2)),
          threshold: activeThreshold.maxSecondGradePercentage,
          message: `تجاوز نسبة النخب الثاني في المكينة ${productionData.machineId}: ${secondGradePercentage.toFixed(2)}% (الحد المسموح: ${activeThreshold.maxSecondGradePercentage}%)`,
          isRead: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Save new alerts
      if (newAlerts.length > 0) {
        const existingJson = await AsyncStorage.getItem(ALERTS_KEY);
        const existingAlerts: WasteAlert[] = existingJson ? JSON.parse(existingJson) : [];
        const allAlerts = [...newAlerts, ...existingAlerts].slice(0, 200);
        await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(allAlerts));

        // Log alerts
        for (const alert of newAlerts) {
          await activityLogService.addEntry({
            userId: "system",
            userName: productionData.userName || "النظام",
            action: "alert",
            module: "production",
            description: alert.message,
          });
        }
      }

      return newAlerts;
    } catch (error) {
      console.error("Failed to check and generate alerts:", error);
      return [];
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      const alerts: WasteAlert[] = json ? JSON.parse(json) : [];
      return alerts.filter((a) => !a.isRead).length;
    } catch (error) {
      return 0;
    }
  },
};
