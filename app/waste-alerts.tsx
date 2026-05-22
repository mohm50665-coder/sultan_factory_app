import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { wasteAlertsService, type WasteAlert, type WasteThreshold } from "@/lib/services/waste-alerts";

const ALERT_TYPE_INFO: Record<string, { label: string; color: string; icon: string }> = {
  waste_percentage: { label: "نسبة هدر عالية", color: "#ef4444", icon: "warning" },
  needles_excess: { label: "هدر إبر مرتفع", color: "#f59e0b", icon: "push-pin" },
  second_grade: { label: "نخب ثاني مرتفع", color: "#8b5cf6", icon: "low-priority" },
};

export default function WasteAlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<WasteAlert[]>([]);
  const [thresholds, setThresholds] = useState<WasteThreshold[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editThreshold, setEditThreshold] = useState({
    maxWastePercentage: "5",
    maxNeedlesPerDay: "10",
    maxSecondGradePercentage: "3",
  });
  const [activeTab, setActiveTab] = useState<"alerts" | "settings">("alerts");

  const loadData = useCallback(async () => {
    const a = await wasteAlertsService.getAlerts();
    setAlerts(a);
    const t = await wasteAlertsService.getThresholds();
    setThresholds(t);
    if (t.length > 0) {
      setEditThreshold({
        maxWastePercentage: t[0].maxWastePercentage.toString(),
        maxNeedlesPerDay: t[0].maxNeedlesPerDay.toString(),
        maxSecondGradePercentage: t[0].maxSecondGradePercentage.toString(),
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAllRead = async () => {
    await wasteAlertsService.markAllAsRead();
    loadData();
  };

  const handleClearAlerts = () => {
    Alert.alert("تأكيد", "هل تريد مسح جميع التنبيهات؟", [
      { text: "إلغاء" },
      {
        text: "مسح",
        style: "destructive",
        onPress: async () => {
          await wasteAlertsService.clearAlerts();
          loadData();
        },
      },
    ]);
  };

  const handleSaveThreshold = async () => {
    const threshold: WasteThreshold = {
      id: thresholds.length > 0 ? thresholds[0].id : "default",
      machineId: "all",
      maxWastePercentage: parseFloat(editThreshold.maxWastePercentage) || 5,
      maxNeedlesPerDay: parseInt(editThreshold.maxNeedlesPerDay) || 10,
      maxSecondGradePercentage: parseFloat(editThreshold.maxSecondGradePercentage) || 3,
      isActive: true,
    };
    await wasteAlertsService.updateThreshold(threshold);
    Alert.alert("نجاح", "تم حفظ إعدادات الحدود بنجاح");
    loadData();
  };

  const handleMarkRead = async (alertId: string) => {
    await wasteAlertsService.markAsRead(alertId);
    loadData();
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تنبيهات الهدر</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerActionBtn}>
              <MaterialIcons name="done-all" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab("alerts")}
          style={[styles.tab, activeTab === "alerts" && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === "alerts" && styles.tabTextActive]}>
            التنبيهات {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("settings")}
          style={[styles.tab, activeTab === "settings" && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === "settings" && styles.tabTextActive]}>
            إعدادات الحدود
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "alerts" ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="check-circle" size={48} color="#22c55e" />
              <Text style={styles.emptyText}>لا توجد تنبيهات</Text>
              <Text style={styles.emptySubtext}>جميع المكائن تعمل ضمن الحدود المسموحة</Text>
            </View>
          ) : (
            <>
              {alerts.map((alert) => {
                const typeInfo = ALERT_TYPE_INFO[alert.alertType] || { label: "تنبيه", color: "#6b7280", icon: "info" };
                return (
                  <TouchableOpacity
                    key={alert.id}
                    onPress={() => handleMarkRead(alert.id)}
                    style={[styles.alertCard, !alert.isRead && styles.alertCardUnread]}
                  >
                    <View style={[styles.alertIcon, { backgroundColor: `${typeInfo.color}15` }]}>
                      <MaterialIcons name={typeInfo.icon as any} size={22} color={typeInfo.color} />
                    </View>
                    <View style={styles.alertContent}>
                      <View style={styles.alertHeader}>
                        <Text style={styles.alertTime}>{formatDate(alert.timestamp)}</Text>
                        <Text style={[styles.alertType, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                      </View>
                      <Text style={styles.alertMessage}>{alert.message}</Text>
                      <View style={styles.alertFooter}>
                        <Text style={styles.alertMachine}>المكينة: {alert.machineId}</Text>
                        <Text style={styles.alertDate}>التاريخ: {alert.date}</Text>
                      </View>
                    </View>
                    {!alert.isRead && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity onPress={handleClearAlerts} style={styles.clearAllBtn}>
                <MaterialIcons name="delete-sweep" size={18} color="#ef4444" />
                <Text style={styles.clearAllText}>مسح جميع التنبيهات</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>حدود الهدر المسموحة</Text>
            <Text style={styles.settingsDesc}>
              سيتم إرسال تنبيه عند تجاوز أي من هذه الحدود أثناء إدخال بيانات الإنتاج
            </Text>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>الحد الأقصى لنسبة الهدر (%)</Text>
              <TextInput
                style={styles.settingInput}
                value={editThreshold.maxWastePercentage}
                onChangeText={(v) => setEditThreshold({ ...editThreshold, maxWastePercentage: v })}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>الحد الأقصى لهدر الإبر (حبة/يوم)</Text>
              <TextInput
                style={styles.settingInput}
                value={editThreshold.maxNeedlesPerDay}
                onChangeText={(v) => setEditThreshold({ ...editThreshold, maxNeedlesPerDay: v })}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>الحد الأقصى لنسبة النخب الثاني (%)</Text>
              <TextInput
                style={styles.settingInput}
                value={editThreshold.maxSecondGradePercentage}
                onChangeText={(v) => setEditThreshold({ ...editThreshold, maxSecondGradePercentage: v })}
                keyboardType="numeric"
                placeholder="3"
              />
            </View>

            <TouchableOpacity onPress={handleSaveThreshold} style={styles.saveBtn}>
              <MaterialIcons name="save" size={20} color="white" />
              <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#0a7ea4" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>كيف تعمل التنبيهات؟</Text>
              <Text style={styles.infoText}>
                عند إدخال بيانات الإنتاج لأي مكينة، يقوم النظام تلقائياً بمقارنة نسب الهدر مع الحدود المحددة. إذا تجاوزت أي قيمة الحد المسموح، يتم إنشاء تنبيه فوري.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0a7ea4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0a7ea4",
  },
  tabText: {
    fontSize: 14,
    color: "#687076",
  },
  tabTextActive: {
    color: "#0a7ea4",
    fontWeight: "bold",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#22c55e",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  alertCardUnread: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertType: {
    fontSize: 11,
    fontWeight: "bold",
  },
  alertTime: {
    fontSize: 10,
    color: "#9ca3af",
  },
  alertMessage: {
    fontSize: 12,
    color: "#11181C",
    textAlign: "right",
    lineHeight: 18,
    marginBottom: 6,
  },
  alertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertMachine: {
    fontSize: 10,
    color: "#0a7ea4",
  },
  alertDate: {
    fontSize: 10,
    color: "#687076",
  },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  clearAllText: {
    color: "#ef4444",
    fontSize: 13,
  },
  settingsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#11181C",
    textAlign: "right",
    marginBottom: 6,
  },
  settingsDesc: {
    fontSize: 12,
    color: "#687076",
    textAlign: "right",
    marginBottom: 20,
    lineHeight: 18,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#11181C",
    textAlign: "right",
    marginBottom: 6,
  },
  settingInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "#f9fafb",
  },
  saveBtn: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
  infoCard: {
    backgroundColor: "#e0f7fa",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0a7ea4",
    textAlign: "right",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 11,
    color: "#687076",
    textAlign: "right",
    lineHeight: 18,
  },
});
