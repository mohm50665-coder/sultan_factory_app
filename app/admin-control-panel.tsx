import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { adminDataService, DataSummary, activityLogService, ActivityLogEntry, alertsService, AlertEntry } from "@/lib/services/server-data.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/lib/language-context";

interface AdminSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  count: number;
  route?: string;
}

export default function AdminControlPanel() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "alerts" | "data">("overview");
  const [userId, setUserId] = useState<number>(0);

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("sultan_current_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserId(user.id);
      }
      await loadData();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, logData, alertsData] = await Promise.all([
        adminDataService.getSummary(),
        activityLogService.getAll(50),
        alertsService.getAll(),
      ]);
      setSummary(summaryData);
      setActivityLog(logData);
      setAlerts(alertsData);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const sections: AdminSection[] = [
    { id: "production", title: isAr ? "الإنتاج" : "Production", icon: "precision-manufacturing", color: "#3B82F6", count: summary?.production || 0 },
    { id: "sales", title: isAr ? "المبيعات" : "Sales", icon: "point-of-sale", color: "#10B981", count: summary?.sales || 0 },
    { id: "expenses", title: isAr ? "المصروفات" : "Expenses", icon: "account-balance-wallet", color: "#F59E0B", count: summary?.expenses || 0 },
    { id: "tasks", title: isAr ? "المهام" : "Tasks", icon: "assignment", color: "#8B5CF6", count: summary?.tasks || 0 },
    { id: "users", title: isAr ? "المستخدمين" : "Users", icon: "people", color: "#EC4899", count: summary?.users || 0 },
    { id: "costs", title: isAr ? "التكاليف" : "Costs", icon: "calculate", color: "#06B6D4", count: summary?.costs || 0 },
    { id: "collection", title: isAr ? "التحصيل" : "Collection", icon: "payments", color: "#14B8A6", count: summary?.collection || 0 },
    { id: "manufacturing", title: isAr ? "مراحل التصنيع" : "Manufacturing Stages", icon: "factory", color: "#F97316", count: summary?.manufacturing || 0 },
    { id: "alerts", title: isAr ? "التنبيهات غير المقروءة" : "Unread Alerts", icon: "notifications-active", color: "#EF4444", count: summary?.unreadAlerts || 0 },
  ];

  const getActionLabel = (action: string) => {
    const labelsAr: Record<string, string> = {
      create: "إنشاء",
      update: "تعديل",
      delete: "حذف",
      login: "تسجيل دخول",
      logout: "تسجيل خروج",
      export: "تصدير",
      backup: "نسخ احتياطي",
    };
    const labelsEn: Record<string, string> = {
      create: "Create",
      update: "Update",
      delete: "Delete",
      login: "Login",
      logout: "Logout",
      export: "Export",
      backup: "Backup",
    };
    return isAr ? (labelsAr[action] || action) : (labelsEn[action] || action);
  };

  const getEntityLabel = (entityType: string) => {
    const labelsAr: Record<string, string> = {
      production: "إنتاج",
      sales: "مبيعات",
      expenses: "مصروفات",
      tasks: "مهام",
      costs: "تكاليف",
      collection: "تحصيل",
      manufacturing: "تصنيع",
      users: "مستخدمين",
      alerts: "تنبيهات",
      backups: "نسخ احتياطية",
      reports: "تقارير",
    };
    const labelsEn: Record<string, string> = {
      production: "Production",
      sales: "Sales",
      expenses: "Expenses",
      tasks: "Tasks",
      costs: "Costs",
      collection: "Collection",
      manufacturing: "Manufacturing",
      users: "Users",
      alerts: "Alerts",
      backups: "Backups",
      reports: "Reports",
    };
    return isAr ? (labelsAr[entityType] || entityType) : (labelsEn[entityType] || entityType);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "#EF4444";
      case "warning": return "#F59E0B";
      default: return "#3B82F6";
    }
  };

  const handleMarkAlertRead = async (alertId: number) => {
    try {
      await alertsService.markAsRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: 1 } : a));
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في تحديث التنبيه" : "Failed to update alert");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsService.markAllAsRead(userId);
      setAlerts(prev => prev.map(a => ({ ...a, read: 1 })));
      Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تحديد جميع التنبيهات كمقروءة" : "All alerts marked as read");
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في تحديث التنبيهات" : "Failed to update alerts");
    }
  };

  const navigateToSection = (sectionId: string) => {
    switch (sectionId) {
      case "production": router.push("/production" as any); break;
      case "sales": router.push("/sales" as any); break;
      case "expenses": router.push("/expenses" as any); break;
      case "tasks": router.push("/tasks" as any); break;
      case "users": router.push("/admin-dashboard" as any); break;
      case "costs": router.push("/production-costs" as any); break;
      case "collection": router.push("/collection" as any); break;
      case "manufacturing": router.push("/manufacturing-stages" as any); break;
      default: break;
    }
  };

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Summary Cards */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "ملخص البيانات" : "Data Summary"}</Text>
      <View style={styles.grid}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigateToSection(section.id)}
          >
            <View style={[styles.iconCircle, { backgroundColor: section.color + "20" }]}>
              <MaterialIcons name={section.icon as any} size={24} color={section.color} />
            </View>
            <Text style={[styles.cardCount, { color: colors.foreground }]}>{section.count}</Text>
            <Text style={[styles.cardTitle, { color: colors.muted, textAlign: "center" }]}>{section.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, textAlign: isAr ? "right" : "left" }]}>{isAr ? "إجراءات سريعة" : "Quick Actions"}</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#3B82F6" }]}
          onPress={() => router.push("/board-representative-dashboard" as any)}
        >
          <MaterialIcons name="dashboard" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{isAr ? "لوحة مجلس الإدارة" : "Board Dashboard"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#10B981" }]}
          onPress={() => router.push("/cost-comparison-report" as any)}
        >
          <MaterialIcons name="compare-arrows" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{isAr ? "تقارير المقارنة" : "Comparison Reports"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]}
          onPress={() => router.push("/backup-restore" as any)}
        >
          <MaterialIcons name="backup" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{isAr ? "النسخ الاحتياطية" : "Backups"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#F59E0B" }]}
          onPress={() => router.push("/share-reports" as any)}
        >
          <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{isAr ? "تصدير التقارير" : "Export Reports"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActivity = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "سجل الأنشطة" : "Activity Log"}</Text>
      {activityLog.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
          <MaterialIcons name="history" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center" }]}>{isAr ? "لا توجد أنشطة مسجلة بعد" : "No activities recorded yet"}</Text>
          <Text style={[styles.emptySubtext, { color: colors.muted, textAlign: "center" }]}>{isAr ? "ستظهر هنا جميع العمليات التي يقوم بها المستخدمون" : "All user operations will appear here"}</Text>
        </View>
      ) : (
        activityLog.map((log, index) => (
          <View key={log.id || index} style={[styles.logItem, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}>
            <View style={styles.logIcon}>
              <MaterialIcons name="history" size={20} color={colors.primary} />
            </View>
            <View style={[styles.logContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
              <Text style={[styles.logAction, { color: colors.foreground, textAlign: isAr ? "left" : "right" }]}>
                {getActionLabel(log.action)} - {getEntityLabel(log.entityType)}
              </Text>
              {log.details && (
                <Text style={[styles.logDetails, { color: colors.muted, textAlign: isAr ? "left" : "right" }]} numberOfLines={2}>
                  {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                </Text>
              )}
              <Text style={[styles.logTime, { color: colors.muted, textAlign: isAr ? "left" : "right" }]}>
                {log.createdAt ? new Date(log.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : ""}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderAlerts = () => (
    <View style={styles.tabContent}>
      <View style={[styles.alertsHeader, { flexDirection: isAr ? "row" : "row-reverse" }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "التنبيهات" : "Alerts"}</Text>
        {alerts.filter(a => !a.read).length > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={[styles.markAllBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.markAllBtnText}>{isAr ? "تحديد الكل كمقروء" : "Mark all as read"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {alerts.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
          <MaterialIcons name="notifications-off" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center" }]}>{isAr ? "لا توجد تنبيهات" : "No alerts"}</Text>
        </View>
      ) : (
        alerts.map((alert, index) => (
          <TouchableOpacity
            key={alert.id || index}
            style={[
              styles.alertItem,
              { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" },
              !alert.read && { [isAr ? "borderRightWidth" : "borderLeftWidth"]: 4, [isAr ? "borderRightColor" : "borderLeftColor"]: getSeverityColor(alert.severity) },
            ]}
            onPress={() => alert.id && handleMarkAlertRead(alert.id)}
          >
            <View style={[styles.alertIcon, { backgroundColor: getSeverityColor(alert.severity) + "20" }]}>
              <MaterialIcons
                name={alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "info"}
                size={24}
                color={getSeverityColor(alert.severity)}
              />
            </View>
            <View style={[styles.alertContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
              <Text style={[styles.alertTitle, { color: colors.foreground, textAlign: isAr ? "left" : "right" }]}>{alert.title}</Text>
              <Text style={[styles.alertMessage, { color: colors.muted, textAlign: isAr ? "left" : "right" }]} numberOfLines={2}>{alert.message}</Text>
              <Text style={[styles.alertTime, { color: colors.muted, textAlign: isAr ? "left" : "right" }]}>
                {alert.createdAt ? new Date(alert.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : ""}
              </Text>
            </View>
            {!alert.read && (
              <View style={[styles.unreadDot, { backgroundColor: getSeverityColor(alert.severity) }]} />
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderDataManagement = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "إدارة البيانات" : "Data Management"}</Text>
      <Text style={[styles.subtitle, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>
        {isAr ? "يمكنك من هنا الوصول لجميع البيانات وتعديلها أو حذفها" : "From here you can access, edit, or delete all data"}
      </Text>

      {/* Data Management Cards */}
      {[
        { title: isAr ? "إدارة الإنتاج" : "Production Management", icon: "precision-manufacturing", color: "#3B82F6", desc: isAr ? "عرض وتعديل وحذف بيانات الإنتاج" : "View, edit, and delete production data", route: "/production" },
        { title: isAr ? "إدارة المبيعات" : "Sales Management", icon: "point-of-sale", color: "#10B981", desc: isAr ? "عرض وتعديل وحذف بيانات المبيعات" : "View, edit, and delete sales data", route: "/sales" },
        { title: isAr ? "إدارة المصروفات" : "Expenses Management", icon: "account-balance-wallet", color: "#F59E0B", desc: isAr ? "عرض وتعديل وحذف المصروفات" : "View, edit, and delete expenses", route: "/expenses" },
        { title: isAr ? "إدارة المهام" : "Tasks Management", icon: "assignment", color: "#8B5CF6", desc: isAr ? "عرض وتعديل وحذف المهام" : "View, edit, and delete tasks", route: "/tasks" },
        { title: isAr ? "إدارة التكاليف" : "Costs Management", icon: "calculate", color: "#06B6D4", desc: isAr ? "عرض وتعديل وحذف بيانات التكاليف" : "View, edit, and delete costs data", route: "/production-costs" },
        { title: isAr ? "إدارة المستخدمين" : "Users Management", icon: "people", color: "#EC4899", desc: isAr ? "إدارة حسابات المستخدمين والصلاحيات" : "Manage user accounts and permissions", route: "/admin-dashboard" },
        { title: isAr ? "إدارة التحصيل" : "Collection Management", icon: "payments", color: "#14B8A6", desc: isAr ? "عرض وتعديل بيانات التحصيل" : "View and edit collection data", route: "/collection" },
        { title: isAr ? "إدارة المستودعات" : "Warehouse Management", icon: "warehouse", color: "#F97316", desc: isAr ? "عرض وتعديل بيانات المستودعات" : "View and edit warehouse data", route: "/warehouse" },
        { title: isAr ? "إدارة الصيانة" : "Maintenance Management", icon: "build", color: "#6366F1", desc: isAr ? "عرض وتعديل بيانات الصيانة" : "View and edit maintenance data", route: "/maintenance" },
        { title: isAr ? "الإجراءات الإدارية" : "Administrative Procedures", icon: "admin-panel-settings", color: "#DC2626", desc: isAr ? "عرض وتعديل الإجراءات الإدارية" : "View and edit administrative procedures", route: "/administrative" },
      ].map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}
          onPress={() => router.push(item.route as any)}
        >
          <View style={[styles.dataCardIcon, { backgroundColor: item.color + "20" }]}>
            <MaterialIcons name={item.icon as any} size={28} color={item.color} />
          </View>
          <View style={[styles.dataCardContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground, textAlign: isAr ? "left" : "right" }]}>{item.title}</Text>
            <Text style={[styles.dataCardDesc, { color: colors.muted, textAlign: isAr ? "left" : "right" }]}>{item.desc}</Text>
          </View>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={24} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted, textAlign: "center" }]}>{isAr ? "جاري تحميل البيانات..." : "Loading data..."}</Text>
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
        <View style={[styles.header, { flexDirection: isAr ? "row" : "row-reverse" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.headerContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isAr ? "left" : "right" }]}>{isAr ? "لوحة تحكم المدير" : "Admin Control Panel"}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted, textAlign: isAr ? "left" : "right" }]}>{isAr ? "إدارة شاملة لجميع البيانات" : "Comprehensive management of all data"}</Text>
          </View>
          <View style={[styles.adminBadge, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="admin-panel-settings" size={20} color="#fff" />
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}>
          {[
            { id: "overview", label: isAr ? "نظرة عامة" : "Overview", icon: "dashboard" },
            { id: "activity", label: isAr ? "الأنشطة" : "Activity", icon: "history" },
            { id: "alerts", label: isAr ? "التنبيهات" : "Alerts", icon: "notifications" },
            { id: "data", label: isAr ? "البيانات" : "Data", icon: "storage" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && { backgroundColor: colors.primary + "20", borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <MaterialIcons name={tab.icon as any} size={18} color={activeTab === tab.id ? colors.primary : colors.muted} />
              <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.primary : colors.muted, textAlign: "center" }]}>
                {tab.label}
              </Text>
              {tab.id === "alerts" && (summary?.unreadAlerts || 0) > 0 && (
                <View style={[styles.badge, isAr ? { right: 8 } : { left: 8 }]}>
                  <Text style={styles.badgeText}>{summary?.unreadAlerts}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverview()}
        {activeTab === "activity" && renderActivity()}
        {activeTab === "alerts" && renderAlerts()}
        {activeTab === "data" && renderDataManagement()}
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
  adminBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2, position: "relative" },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  badge: { position: "absolute", top: 4, backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  tabContent: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  subtitle: { fontSize: 13, marginBottom: 16, marginTop: -8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: { width: "30%", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, minWidth: 100 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  cardCount: { fontSize: 20, fontWeight: "bold" },
  cardTitle: { fontSize: 11, marginTop: 4, textAlign: "center" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  logItem: { flexDirection: "row", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8, gap: 10 },
  logIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,0.1)" },
  logContent: { flex: 1 },
  logAction: { fontSize: 14, fontWeight: "600" },
  logDetails: { fontSize: 12, marginTop: 2 },
  logTime: { fontSize: 11, marginTop: 4 },
  alertsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  markAllBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  alertItem: { flexDirection: "row", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8, gap: 10 },
  alertIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: "bold" },
  alertMessage: { fontSize: 12, marginTop: 2 },
  alertTime: { fontSize: 11, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, alignSelf: "center" },
  dataCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10, gap: 12 },
  dataCardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dataCardContent: { flex: 1 },
  dataCardTitle: { fontSize: 15, fontWeight: "bold" },
  dataCardDesc: { fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: "center", padding: 40, borderRadius: 12, marginTop: 20 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4, textAlign: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
});
