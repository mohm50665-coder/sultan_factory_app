import React, { useState, useEffect, useCallback } from "react";
import { BackButton } from "@/components/back-button";
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
import { useLanguage } from "@/lib/language-context";

const getActionLabels = (t: any) => ({
  create: { label: t("action_create"), color: "#22c55e", icon: "add-circle" },
  update: { label: t("action_update"), color: "#3b82f6", icon: "edit" },
  delete: { label: t("action_delete"), color: "#ef4444", icon: "delete" },
  login: { label: t("action_login"), color: "#8b5cf6", icon: "login" },
  logout: { label: t("action_logout"), color: "#6b7280", icon: "logout" },
  export: { label: t("action_export"), color: "#f59e0b", icon: "file-download" },
  alert: { label: t("action_alert"), color: "#ec4899", icon: "warning" },
});

const getModuleLabels = (t: any) => ({
  production: t("module_production"),
  sales: t("module_sales"),
  warehouse: t("module_warehouse"),
  maintenance: t("module_maintenance"),
  financial: t("module_financial"),
  users: t("module_users"),
  manufacturing: t("module_manufacturing"),
  administrative: t("module_administrative"),
  tasks: t("module_tasks"),
  auth: t("module_auth"),
});

const getFilterActions = (t: any) => [
  { value: "", label: t("all") },
  { value: "create", label: t("action_create") },
  { value: "update", label: t("action_update") },
  { value: "delete", label: t("action_delete") },
  { value: "login", label: t("action_login") },
  { value: "export", label: t("action_export") },
  { value: "alert", label: t("action_alert") },
];

export default function ActivityLogScreen() {
  const router = useRouter();
  const { t } = useLanguage();
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
      t("confirm_clear"),
      t("are_you_sure"),
      [
        { text: t("cancel_action") },
        {
          text: t("clear_all"),
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
        <BackButton />
        <Text style={styles.headerTitle}>{t("activity_log")}</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <MaterialIcons name="delete-sweep" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#e0f2fe" }]}>
          <Text style={[styles.statNumber, { color: "#0369a1" }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>{t("activity_total")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statNumber, { color: "#15803d" }]}>{stats.today}</Text>
          <Text style={styles.statLabel}>{t("activity_today")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fef3c7" }]}>
          <Text style={[styles.statNumber, { color: "#92400e" }]}>{logs.length}</Text>
          <Text style={styles.statLabel}>{t("activity_shown")}</Text>
        </View>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {getFilterActions(t).map((f) => (
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
            <Text style={styles.emptyText}>{t("no_data")}</Text>
            <Text style={styles.emptySubtext}>{t("no_alerts")}</Text>
          </View>
        ) : (
          logs.map((log) => {
            const ACTION_LABELS = getActionLabels(t);
            const MODULE_LABELS = getModuleLabels(t);
            const actionInfo = ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] || { label: log.action, color: "#6b7280", icon: "info" };
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
                    <Text style={styles.logModule}>{MODULE_LABELS[log.module as keyof typeof MODULE_LABELS] || log.module}</Text>
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
