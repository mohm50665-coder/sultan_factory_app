import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import RolesService, { type UserRole } from "@/lib/services/roles.service";
import notificationsService from "@/lib/services/notifications.service";

interface DashboardItem {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  color: string;
  route: string;
  descriptionAr: string;
  descriptionEn: string;
  section: string; // maps to RolesService.canAccessSection
  departments: string[]; // which departments can see this item (empty = all)
  isShared?: boolean; // if true, visible to all departments
}

const DASHBOARD_ITEMS: DashboardItem[] = [
  {
    id: "production",
    labelAr: "الإنتاج",
    labelEn: "Production",
    icon: "factory",
    color: "#3b82f6",
    route: "/production",
    descriptionAr: "رقم المكينة - الكمية - الهدر - النخب الثاني",
    descriptionEn: "Machine No. - Quantity - Waste - Second Grade",
    section: "production",
    departments: ["production"],
  },
  {
    id: "production-totals",
    labelAr: "إجمالي بيانات المكائن",
    labelEn: "Machines Totals",
    icon: "summarize",
    color: "#0d9488",
    route: "/production-totals",
    descriptionAr: "إنتاج تام - نخب ثاني - هدر - خيوط - إبر - نسبة الهدر",
    descriptionEn: "Production - Second Grade - Waste - Yarn - Needles - Waste %",
    section: "production",
    departments: ["production"],
  },
  {
    id: "manufacturing",
    labelAr: "مراحل تسليم الإنتاج",
    labelEn: "Manufacturing Stages",
    icon: "precision-manufacturing",
    color: "#8b5cf6",
    route: "/manufacturing",
    descriptionAr: "المكائن - الروسو - القلب - الكاوية - الفحص - التغليف - التخزين",
    descriptionEn: "Machines - Rosso - Turning - Ironing - Inspection - Packing - Storage",
    section: "manufacturing",
    departments: ["production", "warehouse"],
  },
  {
    id: "sales",
    labelAr: "المبيعات والتحصيل",
    labelEn: "Sales & Collection",
    icon: "shopping-cart",
    color: "#ec4899",
    route: "/sales",
    descriptionAr: "تسجيل المبيعات وتحصيل المبالغ",
    descriptionEn: "Record sales and collect payments",
    section: "sales",
    departments: ["sales"],
  },
  {
    id: "warehouse",
    labelAr: "المستودعات",
    labelEn: "Warehouse",
    icon: "warehouse",
    color: "#f59e0b",
    route: "/warehouse",
    descriptionAr: "مواد خام - منتج تام - مستلزمات",
    descriptionEn: "Raw materials - Finished goods - Supplies",
    section: "warehouse",
    departments: ["warehouse"],
  },
  {
    id: "maintenance",
    labelAr: "الصيانة",
    labelEn: "Maintenance",
    icon: "build",
    color: "#ef4444",
    route: "/maintenance",
    descriptionAr: "أجهزة مصانة - متوقفة - توصيات",
    descriptionEn: "Maintained - Stopped - Recommendations",
    section: "maintenance",
    departments: ["maintenance"],
  },
  {
    id: "financial",
    labelAr: "المصروفات",
    labelEn: "Expenses",
    icon: "payments",
    color: "#6366f1",
    route: "/financial",
    descriptionAr: "التاريخ - مبلغ الصرف - بيان الصرف - التقرير المالي",
    descriptionEn: "Date - Amount - Description - Financial Report",
    section: "financial",
    departments: ["administrative"],
  },
  {
    id: "administrative",
    labelAr: "الإجراءات الإدارية",
    labelEn: "Administrative",
    icon: "assignment",
    color: "#06b6d4",
    route: "/administrative",
    descriptionAr: "الطلبات والإجراءات الإدارية",
    descriptionEn: "Requests and administrative procedures",
    section: "hr",
    departments: ["administrative"],
  },
  {
    id: "tasks",
    labelAr: "المهام",
    labelEn: "Tasks",
    icon: "checklist",
    color: "#14b8a6",
    route: "/tasks",
    descriptionAr: "إدارة المهام والمتابعة",
    descriptionEn: "Task management and follow-up",
    section: "tasks",
    departments: [],
    isShared: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const isAr = language === "ar";
  const userRole = (user?.role || "user") as UserRole;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnread = async () => {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    };
    loadUnread();
    const unsubscribe = notificationsService.subscribe(loadUnread);
    return unsubscribe;
  }, []);

  // Filter dashboard items based on user department + admin sees all
  const userDepartment = user?.department || "";
  const visibleDashboardItems = DASHBOARD_ITEMS.filter((item) => {
    // Admin sees everything
    if (user?.role === "admin") return true;
    // Board representative sees tasks + reports only (not section data entry)
    if (userDepartment === "board_representative") {
      return item.isShared || item.id === "tasks";
    }
    // Shared items (tasks) visible to all
    if (item.isShared) return true;
    // Department-specific items
    if (item.departments.length === 0) return true;
    return item.departments.includes(userDepartment);
  });

  const handleLogout = async () => {
    const confirmMessage = isAr ? "هل أنت متأكد من رغبتك في تسجيل الخروج؟" : "Are you sure you want to logout?";
    
    if (Platform.OS === "web") {
      // على الويب Alert.alert لا يعمل - نستخدم window.confirm
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        setIsLoading(true);
        try {
          await logout();
          router.replace("/login");
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      // على الموبايل نستخدم Alert.alert
      Alert.alert(
        t("logout"),
        confirmMessage,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("logout"),
            style: "destructive",
            onPress: async () => {
              setIsLoading(true);
              try {
                await logout();
                router.replace("/login");
              } catch (e) {
                console.error(e);
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    }
  };

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-primary px-6 py-6">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleLogout}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="logout" size={20} color="white" />
              )}
            </Pressable>
            <TouchableOpacity
              onPress={() => handleNavigate("/profile")}
              style={styles.headerButton}
            >
              <MaterialIcons name="person" size={20} color="white" />
            </TouchableOpacity>
            {/* Language Toggle */}
            <TouchableOpacity
              onPress={toggleLanguage}
              style={styles.langButton}
            >
              <MaterialIcons name="language" size={16} color="white" />
              <Text style={styles.langButtonText}>
                {isAr ? "EN" : "ع"}
              </Text>
            </TouchableOpacity>
            {/* Search */}
            <TouchableOpacity
              onPress={() => handleNavigate("/global-search")}
              style={styles.headerButton}
            >
              <MaterialIcons name="search" size={20} color="white" />
            </TouchableOpacity>
            {/* Notifications */}
            <TouchableOpacity
              onPress={() => handleNavigate("/in-app-notifications")}
              style={styles.headerButton}
            >
              <MaterialIcons name="notifications" size={20} color="white" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Settings */}
            <TouchableOpacity
              onPress={() => handleNavigate("/settings")}
              style={styles.headerButton}
            >
              <MaterialIcons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View className="items-end">
            <Text className="text-white text-sm opacity-80">
              {isAr ? "أهلاً بك" : "Welcome"}
            </Text>
            <Text className="text-white font-bold text-xl mt-1">{user?.name || (isAr ? "المستخدم" : "User")}</Text>
            <Text className="text-white/70 text-xs mt-1">
              {user?.position || (user?.role === "admin" ? t("admin") : (isAr ? "موظف" : "Employee"))}
            </Text>
          </View>
        </View>
      </View>

      {/* Admin Dashboard Button */}
      {user?.role === "admin" && (
        <View>
          <TouchableOpacity
            onPress={() => handleNavigate("/admin-dashboard")}
            style={styles.adminButton}
          >
            <MaterialIcons name="chevron-left" size={20} color="#f59e0b" />
            <View style={styles.adminButtonContent}>
              <Text style={styles.adminButtonText}>
                {isAr ? "لوحة تحكم ADMIN" : "Admin Dashboard"}
              </Text>
              <MaterialIcons name="admin-panel-settings" size={20} color="#f59e0b" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/admin-settings")}
            style={[styles.adminButton, { borderColor: "#7c3aed", marginTop: 8 }]}
          >
            <MaterialIcons name="chevron-left" size={20} color="#7c3aed" />
            <View style={styles.adminButtonContent}>
              <Text style={[styles.adminButtonText, { color: "#7c3aed" }]}>
                {isAr ? "إعدادات المدير" : "Admin Settings"}
              </Text>
              <MaterialIcons name="settings" size={20} color="#7c3aed" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {visibleDashboardItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleNavigate(item.route)}
              style={styles.gridItem}
              activeOpacity={0.7}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border" style={styles.card}>
                <View
                  style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}
                >
                  <MaterialIcons name={item.icon as any} size={26} color={item.color} />
                </View>
                <Text className="text-foreground font-bold text-sm" style={{ textAlign: isRtl ? "right" : "left" }}>
                  {isAr ? item.labelAr : item.labelEn}
                </Text>
                <Text className="text-muted text-xs mt-1" style={[styles.description, { textAlign: isRtl ? "right" : "left" }]}>
                  {isAr ? item.descriptionAr : item.descriptionEn}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extra Tools */}
        <Text className="text-foreground font-bold text-base" style={[styles.toolsTitle, { textAlign: isRtl ? "right" : "left" }]}>
          {t("extra_tools")}
        </Text>
        <View style={styles.toolsGrid}>
          <TouchableOpacity
            onPress={() => handleNavigate("/reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("reports")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/notifications-center")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="notifications" size={24} color="#d97706" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("notifications")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/export-data")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="file-download" size={24} color="#6366f1" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("export")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/activity-log")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="history" size={24} color="#0891b2" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("activity_log")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/production-export")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="print" size={24} color="#16a34a" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("production_export")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/waste-alerts")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="warning-amber" size={24} color="#dc2626" />
              <Text className="text-foreground text-xs font-semibold mt-2">{t("waste_alerts")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/reports-analytics")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "التحليلات" : "Analytics"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/section-reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="summarize" size={24} color="#0891b2" />
              <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "تقارير الأقسام" : "Reports"}</Text>
            </View>
          </TouchableOpacity>
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/users-management")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View className="bg-surface rounded-xl p-3 border border-border items-center">
                <MaterialIcons name="people" size={24} color="#7c3aed" />
                <Text className="text-foreground text-xs font-semibold mt-2">{t("users_management")}</Text>
              </View>
            </TouchableOpacity>
          )}
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/employee-performance")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View className="bg-surface rounded-xl p-3 border border-border items-center">
                <MaterialIcons name="assessment" size={24} color="#059669" />
                <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "أداء الموظفين" : "Performance"}</Text>
              </View>
            </TouchableOpacity>
          )}
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/backup-restore")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View className="bg-surface rounded-xl p-3 border border-border items-center">
                <MaterialIcons name="backup" size={24} color="#6366f1" />
                <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "نسخ احتياطي" : "Backup"}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleNavigate("/machines-comparison")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="precision-manufacturing" size={24} color="#8b5cf6" />
              <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "مقارنة المكائن" : "Machines"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/share-reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="share" size={24} color="#0ea5e9" />
              <Text className="text-foreground text-xs font-semibold mt-2">{isAr ? "مشاركة التقارير" : "Share"}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    padding: 8,
  },
  langButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  langButtonText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  adminButton: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#f5f5f5",
  },
  adminButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminButtonText: {
    color: "#f59e0b",
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48%",
    marginBottom: 16,
  },
  card: {
    minHeight: 130,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  description: {
    lineHeight: 16,
  },
  toolsTitle: {
    marginTop: 16,
    marginBottom: 12,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  toolItem: {
    width: "31%",
    marginBottom: 12,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "bold",
  },
});
