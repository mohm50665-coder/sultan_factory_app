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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    id: "production_costs",
    labelAr: "حساب التكاليف",
    labelEn: "Cost Calculation",
    icon: "calculate",
    color: "#10b981",
    route: "/production-costs",
    descriptionAr: "حساب تكاليف الإنتاج والمواد الخام",
    descriptionEn: "Calculate production and raw material costs",
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
    departments: [],
    isShared: true,
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
  {
    id: "cost_comparison",
    labelAr: "تقرير مقارنة التكاليف",
    labelEn: "Cost Comparison Report",
    icon: "trending-down",
    color: "#f97316",
    route: "/cost-comparison-report",
    descriptionAr: "مقارنة التكاليف المتوقعة والفعلية",
    descriptionEn: "Compare expected vs actual costs",
    section: "reports",
    departments: ["production", "board_representative"],
  },
  {
    id: "board_representative_old",
    labelAr: "لوحة تحكم ممثل مجلس الإدارة",
    labelEn: "Board Representative Dashboard",
    icon: "dashboard",
    color: "#8b5cf6",
    route: "/board-representative",
    descriptionAr: "عرض التقارير ومؤشرات الأداء",
    descriptionEn: "View reports and performance metrics",
    section: "reports",
    departments: ["board_representative"],
  },
  {
    id: "advanced_analytics",
    labelAr: "التحليلات المتقدمة",
    labelEn: "Advanced Analytics",
    icon: "insights",
    color: "#0891b2",
    route: "/advanced-analytics",
    descriptionAr: "رسوم بيانية تفاعلية ومقارنات الأداء",
    descriptionEn: "Interactive charts and performance comparisons",
    section: "reports",
    departments: ["board_representative", "production"],
  },
  {
    id: "export_reports",
    labelAr: "تصدير التقارير PDF",
    labelEn: "Export Reports PDF",
    icon: "picture-as-pdf",
    color: "#dc2626",
    route: "/export-reports",
    descriptionAr: "تصدير التقارير بصيغة PDF للطباعة والأرشفة",
    descriptionEn: "Export reports as PDF for printing and archiving",
    section: "reports",
    departments: ["board_representative"],
  },
  {
    id: "server_notifications",
    labelAr: "الإشعارات الفورية",
    labelEn: "Real-time Notifications",
    icon: "notifications-active",
    color: "#ea580c",
    route: "/server-notifications",
    descriptionAr: "تنبيهات فورية عند تجاوز التكاليف أو انخفاض الإنتاجية",
    descriptionEn: "Real-time alerts for cost overruns and low productivity",
    section: "notifications",
    departments: [],
    isShared: true,
  },
  {
    id: "government_tenders",
    labelAr: "المناقصات الحكومية والعسكرية",
    labelEn: "Government & Military Tenders",
    icon: "gavel",
    color: "#1E3A5F",
    route: "/government-tenders",
    descriptionAr: "إدارة المناقصات والاجتماعات ومخرجاتها",
    descriptionEn: "Manage tenders, meetings and their outputs",
    section: "tenders",
    departments: ["government_tenders"],
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();

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

  // Manufacturing stage departments that map to production
  const MANUFACTURING_STAGES = ["machines", "rosso", "qalb", "kawiya", "inspection", "packing", "antislip", "storage"];

  // Filter dashboard items based on user department + admin sees all
  const userDepartment = user?.department || "";
  const isManufacturingWorker = MANUFACTURING_STAGES.includes(userDepartment);
  // الأيقونات الثابتة المشتركة لجميع المستخدمين: الإجراءات الإدارية، الإشعارات الفورية، المهام
  const SHARED_ITEMS = ["administrative", "server_notifications", "tasks"];
  
  // Load user tool permissions
  const [userToolPermissions, setUserToolPermissions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const loadToolPermissions = async () => {
      try {
        const permissionsKey = `tool_permissions_${user?.id}`;
        const permissions = await AsyncStorage.getItem(permissionsKey);
        if (permissions) {
          setUserToolPermissions(JSON.parse(permissions));
        } else {
          // Default: all tools visible
          const defaultPermissions: Record<string, boolean> = {};
          const toolIds = ['advanced_analytics', 'export_reports', 'cost_comparison', 'product_cost_calculator', 'activity_log', 'global_search', 'data_backup', 'user_management'];
          toolIds.forEach(id => {
            defaultPermissions[id] = true;
          });
          setUserToolPermissions(defaultPermissions);
        }
      } catch (error) {
        console.error('Error loading tool permissions:', error);
      }
    };
    loadToolPermissions();
  }, [user?.id]);

  const visibleDashboardItems = DASHBOARD_ITEMS.filter((item) => {
    // Admin sees everything
    if (user?.role === "admin") return true;
    
    // Check tool permissions for additional tools
    const toolIds = ['advanced_analytics', 'export_reports', 'cost_comparison', 'product_cost_calculator', 'activity_log', 'global_search', 'data_backup', 'user_management'];
    if (toolIds.includes(item.id) && !userToolPermissions[item.id]) {
      return false;
    }
    
    // الأيقونات الثابتة المشتركة تظهر للجميع دائماً
    if (SHARED_ITEMS.includes(item.id)) return true;
    // If admin assigned specific sections to this user, use those
    if (user?.allowedSections && user.allowedSections.length > 0) {
      return user.allowedSections.includes(item.id);
    }
    // Manufacturing stage workers: see manufacturing section + shared
    if (isManufacturingWorker) {
      return item.id === "manufacturing" || item.isShared;
    }
    // Employees department: only shared items
    if (userDepartment === "employees") {
      return item.isShared;
    }
    // Board representative sees shared items + reports
    if (userDepartment === "board_representative") {
      return item.isShared || item.section === "reports";
    }
    // Government tenders department
    if (userDepartment === "government_tenders") {
      return item.id === "government_tenders" || item.isShared;
    }
    // Shared items visible to all
    if (item.isShared) return true;
    // Department-specific items
    if (item.departments.length === 0) return true;
    return item.departments.includes(userDepartment);
  });

    const handleLogout = async () => {
    const confirmMessage = isAr ? "هل أنت متأكد من رغبتك في تسجيل الخروج؟" : "Are you sure you want to logout?";
    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        await logout();
        router.replace("/login");
      }
    } else {
      Alert.alert(
        t("logout"),
        confirmMessage,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("logout"),
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/login");
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
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialIcons name="logout" size={20} color="white" />
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
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#ffffff', fontSize: 14, opacity: 0.8 }}>
              {isAr ? "أهلاً بك" : "Welcome"}
            </Text>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20, marginTop: 4 }}>{user?.name || (isAr ? "المستخدم" : "User")}</Text>
            <Text style={{ fontSize: 12, marginTop: 4 }}>
              {user?.position || (user?.role === "admin" ? t("admin") : (isAr ? "موظف" : "Employee"))}
            </Text>
          </View>
        </View>
      </View>

      {/* Admin Dashboard Button */}
      {user?.role === "admin" && (
        <View>
          <TouchableOpacity
            onPress={() => handleNavigate("/comprehensive-admin-panel")}
            style={styles.adminButton}
          >
            <MaterialIcons name="chevron-left" size={20} color="#059669" />
            <View style={styles.adminButtonContent}>
              <Text style={[styles.adminButtonText, { color: "#059669" }]}>
                {isAr ? "لوحة التحكم الشاملة" : "Admin Control Panel"}
              </Text>
              <MaterialIcons name="admin-panel-settings" size={20} color="#059669" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/admin-goals-kpis")}
            style={[styles.adminButton, { borderColor: "#06b6d4", marginTop: 8 }]}
          >
            <MaterialIcons name="chevron-left" size={20} color="#06b6d4" />
            <View style={styles.adminButtonContent}>
              <Text style={[styles.adminButtonText, { color: "#06b6d4" }]}>
                {isAr ? "الأهداف ومؤشرات الأداء" : "Goals & KPIs"}
              </Text>
              <MaterialIcons name="trending-up" size={20} color="#06b6d4" />
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
              <View style={[{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }, styles.card]}>
                <View
                  style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}
                >
                  <MaterialIcons name={item.icon as any} size={26} color={item.color} />
                </View>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, textAlign: isRtl ? "right" : "left" }}>
                  {isAr ? item.labelAr : item.labelEn}
                </Text>
                <Text style={[{ color: colors.muted, fontSize: 12, marginTop: 4 }, styles.description, { textAlign: isRtl ? "right" : "left" }]}>
                  {isAr ? item.descriptionAr : item.descriptionEn}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extra Tools */}
        <Text style={[{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }, styles.toolsTitle, { textAlign: isRtl ? "right" : "left" }]}>
          {t("extra_tools")}
        </Text>
        <View style={styles.toolsGrid}>
          <TouchableOpacity
            onPress={() => handleNavigate("/reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("reports")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/notifications-center")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="notifications" size={24} color="#d97706" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("notifications")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/export-data")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="file-download" size={24} color="#6366f1" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("export")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/activity-log-viewer")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="history" size={24} color="#0891b2" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "سجل التعديلات" : "Activity Log"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/production-export")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="print" size={24} color="#16a34a" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("production_export")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/waste-alerts")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="warning-amber" size={24} color="#dc2626" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("waste_alerts")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/reports-analytics")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "التحليلات" : "Analytics"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/section-reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="summarize" size={24} color="#0891b2" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "تقارير الأقسام" : "Reports"}</Text>
            </View>
          </TouchableOpacity>
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/users-management")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <MaterialIcons name="people" size={24} color="#7c3aed" />
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{t("users_management")}</Text>
              </View>
            </TouchableOpacity>
          )}
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/employee-performance")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <MaterialIcons name="assessment" size={24} color="#059669" />
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "أداء الموظفين" : "Performance"}</Text>
              </View>
            </TouchableOpacity>
          )}
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => handleNavigate("/backup-restore")}
              style={styles.toolItem}
              activeOpacity={0.7}
            >
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <MaterialIcons name="backup" size={24} color="#6366f1" />
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "نسخ احتياطي" : "Backup"}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleNavigate("/machines-comparison")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="precision-manufacturing" size={24} color="#8b5cf6" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "مقارنة المكائن" : "Machines"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/share-reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <MaterialIcons name="share" size={24} color="#0ea5e9" />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{isAr ? "مشاركة التقارير" : "Share"}</Text>
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
