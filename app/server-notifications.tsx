import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { alertsService, AlertEntry } from "@/lib/services/server-data.service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATION_SETTINGS_KEY = "sultan_notification_settings";

interface NotificationSettings {
  costAlerts: boolean;
  productivityAlerts: boolean;
  taskAlerts: boolean;
  qualityAlerts: boolean;
  safetyAlerts: boolean;
  dailyReport: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  costAlerts: true,
  productivityAlerts: true,
  taskAlerts: true,
  qualityAlerts: true,
  safetyAlerts: true,
  dailyReport: true,
};

export default function ServerNotifications() {
  const router = useRouter();
  const colors = useColors();
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [userId, setUserId] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem("sultan_current_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserId(user.id);
      }
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const alertsData = await alertsService.getAll();
      setAlerts(alertsData);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await alertsService.markAsRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: 1 } : a));
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث التنبيه");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsService.markAllAsRead(userId);
      setAlerts(prev => prev.map(a => ({ ...a, read: 1 })));
      Alert.alert("تم", "تم تحديد جميع التنبيهات كمقروءة");
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث التنبيهات");
    }
  };

  const handleDeleteAlert = async (id: number) => {
    Alert.alert("تأكيد", "هل تريد حذف هذا التنبيه؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await alertsService.delete(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
          } catch (error) {
            Alert.alert("خطأ", "فشل في حذف التنبيه");
          }
        },
      },
    ]);
  };

  const handleSettingChange = async (key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "#EF4444";
      case "warning": return "#F59E0B";
      default: return "#3B82F6";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "critical": return "حرج";
      case "warning": return "تحذير";
      default: return "معلومات";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cost_exceeded": return "trending-up";
      case "low_productivity": return "trending-down";
      case "pending_procedure": return "pending-actions";
      case "quality_issue": return "report-problem";
      case "safety_alert": return "health-and-safety";
      default: return "notifications";
    }
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.muted, marginTop: 12 }}>جاري التحميل...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>الإشعارات والتنبيهات</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {unreadCount > 0 ? `${unreadCount} تنبيه غير مقروء` : "لا توجد تنبيهات جديدة"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
            <MaterialIcons name="settings" size={24} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Settings Panel */}
        {showSettings && (
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.settingsTitle, { color: colors.foreground }]}>إعدادات الإشعارات</Text>
            {[
              { key: "costAlerts" as const, label: "تنبيهات التكاليف", desc: "عند تجاوز التكاليف المتوقعة" },
              { key: "productivityAlerts" as const, label: "تنبيهات الإنتاجية", desc: "عند انخفاض الإنتاجية" },
              { key: "taskAlerts" as const, label: "تنبيهات المهام", desc: "عند اقتراب موعد تسليم المهام" },
              { key: "qualityAlerts" as const, label: "تنبيهات الجودة", desc: "عند وجود مشاكل جودة" },
              { key: "safetyAlerts" as const, label: "تنبيهات السلامة", desc: "تنبيهات السلامة المهنية" },
              { key: "dailyReport" as const, label: "التقرير اليومي", desc: "ملخص يومي للأداء" },
            ].map((item) => (
              <View key={item.key} style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.settingDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={(v) => handleSettingChange(item.key, v)}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={settings[item.key] ? colors.primary : "#f4f3f4"}
                />
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {unreadCount > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.markAllBtn, { backgroundColor: colors.primary }]}
              onPress={handleMarkAllRead}
            >
              <MaterialIcons name="done-all" size={18} color="#fff" />
              <Text style={styles.markAllText}>تحديد الكل كمقروء</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="notifications-off" size={56} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.muted }]}>لا توجد تنبيهات</Text>
            <Text style={[styles.emptyDesc, { color: colors.muted }]}>
              ستظهر هنا التنبيهات عند تجاوز التكاليف أو انخفاض الإنتاجية
            </Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              style={[
                styles.alertCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !alert.read && { borderRightWidth: 4, borderRightColor: getSeverityColor(alert.severity) },
              ]}
              onPress={() => alert.id && handleMarkRead(alert.id)}
              onLongPress={() => alert.id && handleDeleteAlert(alert.id)}
            >
              <View style={[styles.alertIconBox, { backgroundColor: getSeverityColor(alert.severity) + "15" }]}>
                <MaterialIcons name={getTypeIcon(alert.type) as any} size={24} color={getSeverityColor(alert.severity)} />
              </View>
              <View style={styles.alertContent}>
                <View style={styles.alertHeader}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={1}>{alert.title}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) + "20" }]}>
                    <Text style={[styles.severityText, { color: getSeverityColor(alert.severity) }]}>
                      {getSeverityLabel(alert.severity)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.alertMessage, { color: colors.muted }]} numberOfLines={2}>{alert.message}</Text>
                <Text style={[styles.alertTime, { color: colors.muted }]}>
                  {alert.createdAt ? new Date(alert.createdAt).toLocaleString("ar-SA") : ""}
                </Text>
              </View>
              {!alert.read && <View style={[styles.unreadDot, { backgroundColor: getSeverityColor(alert.severity) }]} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  backBtn: { padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  settingsPanel: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  settingsTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingDesc: { fontSize: 11, marginTop: 2 },
  actions: { paddingHorizontal: 16, marginBottom: 12 },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" },
  markAllText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyState: { alignItems: "center", marginHorizontal: 16, padding: 40, borderRadius: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginTop: 12 },
  emptyDesc: { fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20 },
  alertCard: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  alertIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertContent: { flex: 1 },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTitle: { fontSize: 14, fontWeight: "bold", flex: 1 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  severityText: { fontSize: 10, fontWeight: "bold" },
  alertMessage: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  alertTime: { fontSize: 11, marginTop: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, alignSelf: "center" },
});
