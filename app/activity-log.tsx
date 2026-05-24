import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { activityLogService, type ActivityLogEntry } from "@/lib/services/activity-log";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  create: { label: "إضافة", color: "#22c55e", icon: "add-circle" },
  update: { label: "تعديل", color: "#3b82f6", icon: "edit" },
  delete: { label: "حذف", color: "#ef4444", icon: "delete" },
  login: { label: "دخول", color: "#8b5cf6", icon: "login" },
  logout: { label: "خروج", color: "#6b7280", icon: "logout" },
  export: { label: "تصدير", color: "#f59e0b", icon: "file-download" },
  alert: { label: "تنبيه", color: "#ec4899", icon: "warning" },
};

const MODULE_LABELS: Record<string, string> = {
  production: "الإنتاج",
  sales: "المبيعات",
  warehouse: "المستودعات",
  maintenance: "الصيانة",
  financial: "المصروفات",
  users: "المستخدمين",
  manufacturing: "مراحل التصنيع",
  administrative: "الإجراءات الإدارية",
  tasks: "المهام",
  auth: "المصادقة",
};

const FILTER_ACTIONS = [
  { value: "", label: "الكل" },
  { value: "create", label: "إضافة" },
  { value: "update", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "login", label: "دخول" },
  { value: "export", label: "تصدير" },
  { value: "alert", label: "تنبيه" },
];

export default function ActivityLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [filterAction, setFilterAction] = useState("");
  const [stats, setStats] = useState({ total: 0, today: 0, byModule: {} as Record<string, number>, byAction: {} as Record<string, number> });

  const loadLogs = useCallback(async () => {
    const filters: any = {};
    if (filterAction) filters.action = filterAction;
    const entries = await activityLogService.getEntries(filters);
    setLogs(entries);
    const s = await activityLogService.getStats();
    setStats(s);
  }, [filterAction]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearAll = () => {
    Alert.alert(
      "تأكيد المسح",
      "هل أنت متأكد من مسح جميع سجلات النشاطات؟ لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء" },
        {
          text: "مسح الكل",
          style: "destructive",
          onPress: async () => {
            await activityLogService.clearAll();
            loadLogs();
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل النشاطات</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <MaterialIcons name="delete-sweep" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#e0f2fe" }]}>
          <Text style={[styles.statNumber, { color: "#0369a1" }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statNumber, { color: "#15803d" }]}>{stats.today}</Text>
          <Text style={styles.statLabel}>اليوم</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fef3c7" }]}>
          <Text style={[styles.statNumber, { color: "#92400e" }]}>{logs.length}</Text>
          <Text style={styles.statLabel}>معروض</Text>
        </View>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTER_ACTIONS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilterAction(f.value)}
            style={[
              styles.filterChip,
              filterAction === f.value && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                filterAction === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>لا توجد سجلات نشاطات</Text>
            <Text style={styles.emptySubtext}>ستظهر هنا جميع العمليات التي يقوم بها المستخدمون</Text>
          </View>
        ) : (
          logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "#6b7280", icon: "info" };
            return (
              <View key={log.id} style={styles.logCard}>
                <View style={[styles.logIcon, { backgroundColor: `${actionInfo.color}15` }]}>
                  <MaterialIcons name={actionInfo.icon as any} size={20} color={actionInfo.color} />
                </View>
                <View style={styles.logContent}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logTime}>{formatDate(log.timestamp)}</Text>
                    <Text style={[styles.logAction, { color: actionInfo.color }]}>{actionInfo.label}</Text>
                  </View>
                  <Text style={styles.logDescription}>{log.description}</Text>
                  <View style={styles.logFooter}>
                    <Text style={styles.logModule}>{MODULE_LABELS[log.module] || log.module}</Text>
                    <Text style={styles.logUser}>{log.userName}</Text>
                  </View>
                  {log.details && <Text style={styles.logDetails}>{log.details}</Text>}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  clearBtn: {
    padding: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 11,
    color: "#687076",
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
    maxHeight: 40,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
    backgroundColor: "white",
  },
  filterChipActive: {
    backgroundColor: "#0a7ea4",
    borderColor: "#0a7ea4",
  },
  filterChipText: {
    fontSize: 12,
    color: "#687076",
  },
  filterChipTextActive: {
    color: "white",
    fontWeight: "600",
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
    color: "#6b7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  logCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logAction: {
    fontSize: 12,
    fontWeight: "bold",
  },
  logTime: {
    fontSize: 10,
    color: "#9ca3af",
  },
  logDescription: {
    fontSize: 13,
    color: "#11181C",
    textAlign: "right",
    marginBottom: 4,
  },
  logFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logModule: {
    fontSize: 10,
    color: "#0a7ea4",
    backgroundColor: "#e0f7fa",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logUser: {
    fontSize: 10,
    color: "#687076",
  },
  logDetails: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "right",
  },
});
