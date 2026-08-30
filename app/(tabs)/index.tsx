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
import { productionService, salesService, collectionService } from "@/lib/services/api.service";
import { administrativeService, maintenanceEntriesService } from "@/lib/services/data.service";

// Helper function to check tool permissions
const canAccessTool = (toolId: string, userPermissions: Record<string, boolean> | undefined): boolean => {
  if (!userPermissions) return false;
  return userPermissions[toolId] === true;
};

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
    id: "product_tracking",
    labelAr: "تتبع المنتجات",
    labelEn: "Product Tracking",
    icon: "timeline",
    color: "#8B5A2B",
    route: "/product-tracking",
    descriptionAr: "تتبع المنتج ووقت التسليم والاستلام والمسؤولية",
    descriptionEn: "Track product handovers, timing and accountability",
    section: "manufacturing",
    departments: ["production", "warehouse"],
  },
  {
    id: "daily_summary",
    labelAr: "ملخص اليوم الشامل",
    labelEn: "Comprehensive Daily Summary",
    icon: "summarize",
    color: "#0f766e",
    route: "/daily-summary",
    descriptionAr: "كل ما حدث في المصنع مع التسليم والاستلام بالتفصيل",
    descriptionEn: "Everything recorded today with detailed handovers",
    section: "reports",
    departments: [],
    isShared: true,
  },
  {
    id: "products_catalog",
    labelAr: "دليل المنتجات",
    labelEn: "Products Catalog",
    icon: "inventory-2",
    color: "#0a7ea4",
    route: "/products",
    descriptionAr: "بيانات المنتج والباركود والمكونات والصورة والطباعة",
    descriptionEn: "Product identity, barcode, components, image and printing",
    section: "manufacturing",
    departments: [],
    isShared: true,
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
    id: "board_monthly_report",
    labelAr: "التقرير الشهري لمجلس الإدارة",
    labelEn: "Monthly Board Report",
    icon: "summarize",
    color: "#7C3AED",
    route: "/board-monthly-report",
    descriptionAr: "تقرير شهري شامل قابل للطباعة لمجلس الإدارة",
    descriptionEn: "Comprehensive printable monthly report for the board",
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
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [dailyStats, setDailyStats] = useState<{
    production: number;
    sales: number;
    requests: number;
    collections: number;
    overdue: number;
    totalProduction: number;
    totalSales: number;
    totalRequests: number;
    totalCollections: number;
  } | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState<string[]>([]);
  const [showDailySummary, setShowDailySummary] = useState(false);

  useEffect(() => {
    const loadUnread = async () => {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    };
    loadUnread();
    const unsubscribe = notificationsService.subscribe(loadUnread);
    return unsubscribe;
  }, []);

  // Load pending users count for admin
  useEffect(() => {
    const loadPendingUsers = async () => {
      if (user?.role !== "admin") return;
      try {
        const { adminService } = await import("@/lib/services/api.service");
        const pending = await adminService.getPendingUsers();
        setPendingUsersCount(Array.isArray(pending) ? pending.length : 0);
      } catch (e) {
        console.log("Error loading pending users:", e);
      }
    };
    loadPendingUsers();
  }, [user?.role]);

  // Load daily operational statistics from server data; no placeholder values are used.
  useEffect(() => {
    const sameDay = (value: unknown, today: Date) => {
      if (!value) return false;
      const date = new Date(String(value));
      return !Number.isNaN(date.getTime()) && date.toDateString() === today.toDateString();
    };

    const loadDailyStats = async () => {
      const today = new Date();
      try {
        const results = await Promise.allSettled([
          productionService.getAll(),
          salesService.getAll(),
          collectionService.getAll(),
          administrativeService.getAll(),
          maintenanceEntriesService.getBySection("custom_manufacturing"),
        ]);
        const [productionResult, salesResult, collectionsResult, requestsResult, customRowsResult] = results;
        const production = productionResult.status === "fulfilled" && Array.isArray(productionResult.value) ? productionResult.value : [];
        const sales = salesResult.status === "fulfilled" && Array.isArray(salesResult.value) ? salesResult.value : [];
        const collections = collectionsResult.status === "fulfilled" && Array.isArray(collectionsResult.value) ? collectionsResult.value : [];
        const requests = requestsResult.status === "fulfilled" && Array.isArray(requestsResult.value) ? requestsResult.value : [];
        const customRows = customRowsResult.status === "fulfilled" && Array.isArray(customRowsResult.value) ? customRowsResult.value : [];
        setStatsUnavailable(results.flatMap((result, index) => result.status === "rejected" ? [["production", "sales", "collections", "requests", "custom"][index]] : []));
        const todayProduction = (Array.isArray(production) ? production : []).filter((item: any) =>
          sameDay(item.date || item.createdAt || item.entryDate, today),
        );
        const todaySales = (Array.isArray(sales) ? sales : []).filter((item: any) =>
          sameDay(item.date || item.createdAt || item.saleDate, today),
        );
        const todayCollections = (Array.isArray(collections) ? collections : []).filter((item: any) =>
          sameDay(item.date || item.createdAt || item.collectionDate, today),
        );
        const todayRequests = (Array.isArray(requests) ? requests : []).filter((item: any) =>
          sameDay(item.date || item.createdAt || item.submissionDate, today),
        );
        const overdue = customRows.filter((row: any) => {
          const data = row?.data || row || {};
          if (!data.deliveryDate || data.status === "completed" || data.salesApprovalStatus === "rejected") return false;
          const deadline = new Date(`${data.deliveryDate}T23:59:59`);
          return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
        });
        const collectionTotal = todayCollections.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
        setDailyStats({
          production: todayProduction.length,
          sales: todaySales.length,
          requests: todayRequests.length,
          collections: collectionTotal,
          overdue: overdue.length,
          totalProduction: Array.isArray(production) ? production.length : 0,
          totalSales: Array.isArray(sales) ? sales.length : 0,
          totalRequests: Array.isArray(requests) ? requests.length : 0,
          totalCollections:           collections.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0),
        });
      } catch (error) {
        console.error("Error loading daily statistics:", error);
        setDailyStats(null);
      }
    };

    loadDailyStats();
  }, []);

  // Manufacturing stage departments that map to production
  const MANUFACTURING_STAGES = ["machines", "rosso", "qalb", "kawiya", "inspection", "packing", "antislip", "storage"];

  // Filter dashboard items based on user department + admin sees all
  const userDepartment = user?.department || "";
  const isManufacturingWorker = MANUFACTURING_STAGES.includes(userDepartment);
  // الأيقونات الثابتة المشتركة لجميع المستخدمين: الإجراءات الإدارية، الإشعارات الفورية، المهام
  const SHARED_ITEMS = ["administrative", "server_notifications", "tasks"];
  
  // Load user tool permissions (server first, then local fallback)
  const [userToolPermissions, setUserToolPermissions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const loadToolPermissions = () => {
      try {
        // Use server-stored permissions from user object
        if (user?.toolPermissions && Object.keys(user.toolPermissions).length > 0) {
          setUserToolPermissions(user.toolPermissions);
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
  }, [user?.id, user?.toolPermissions]);

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
    // No specific sections assigned - show all sections by default
    return true;
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.adminButtonText, { color: "#059669" }]}>
                  {isAr ? "لوحة التحكم الشاملة" : "Admin Control Panel"}
                </Text>
                {pendingUsersCount > 0 && (
                  <View style={{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{pendingUsersCount}</Text>
                  </View>
                )}
              </View>
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

      {/* Daily operational statistics: compact trigger on mobile */}
      {dailyStats && (
        <>
          <TouchableOpacity
            onPress={() => setShowDailySummary((visible) => !visible)}
            style={[styles.summaryIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <MaterialIcons name="insights" size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12, flex: 1, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "ملخص اليوم" : "Today's Summary"}
            </Text>
            <MaterialIcons name={showDailySummary ? "expand-less" : "expand-more"} size={19} color={colors.muted} />
          </TouchableOpacity>
          {showDailySummary && (
        <View style={{ marginHorizontal: 10, marginTop: 6, backgroundColor: colors.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>{isAr ? "ملخص اليوم" : "Today's Summary"}</Text>
              <Text style={{ color: colors.muted, fontSize: 9, marginTop: 2 }}>{isAr ? "الأرقام الكبيرة لليوم — والإجمالي أسفلها" : "Today — totals shown below"}</Text>
            </View>
            <MaterialIcons name="today" size={20} color={colors.primary} />
          </View>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {[
              { key: "production", label: isAr ? "الإنتاج" : "Production", value: dailyStats.production, total: dailyStats.totalProduction, icon: "factory", color: "#2563eb" },
              { key: "sales", label: isAr ? "المبيعات" : "Sales", value: dailyStats.sales, total: dailyStats.totalSales, icon: "shopping-cart", color: "#db2777" },
              { key: "requests", label: isAr ? "الطلبات" : "Requests", value: dailyStats.requests, total: dailyStats.totalRequests, icon: "assignment", color: "#7c3aed" },
              { key: "collections", label: isAr ? "التحصيل" : "Collection", value: dailyStats.collections ? `${dailyStats.collections.toLocaleString()} ر.س` : "0", total: dailyStats.totalCollections, icon: "payments", color: "#059669" },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: `${stat.color}12`, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center" }}>
                <MaterialIcons name={stat.icon as any} size={16} color={stat.color} />
                <Text style={{ color: stat.color, fontWeight: "800", fontSize: 13, marginTop: 2, textAlign: "center" }}>{statsUnavailable.includes(stat.key) ? "—" : stat.value}</Text>
                <Text style={{ color: colors.muted, fontSize: 8, marginTop: 1, textAlign: "center" }}>{statsUnavailable.includes(stat.key) ? (isAr ? "غير متاح" : "Unavailable") : (isAr ? `الإجمالي ${stat.total}` : `Total ${stat.total}`)}</Text>
                <Text style={{ color: colors.muted, fontSize: 9, marginTop: 1, textAlign: "center" }}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {dailyStats.overdue > 0 && (
            <TouchableOpacity
              onPress={() => handleNavigate("/custom-manufacturing")}
              style={{ marginTop: 10, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <MaterialIcons name="warning-amber" size={20} color="#dc2626" />
              <Text style={{ flex: 1, color: "#b91c1c", fontSize: 12, fontWeight: "700", textAlign: isRtl ? "right" : "left", marginHorizontal: 8 }}>{isAr ? `يوجد ${dailyStats.overdue} طلب تصنيع متأخر عن موعد التسليم` : `${dailyStats.overdue} custom manufacturing request(s) are overdue`}</Text>
              <MaterialIcons name={isRtl ? "chevron-left" : "chevron-right"} size={18} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
          )}
        </>
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
                  <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border }, styles.card]}>
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
        {user?.toolPermissions && Object.values(user.toolPermissions).some(v => v === true) && (
          <>
            <Text style={[{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }, styles.toolsTitle, { textAlign: isRtl ? "right" : "left" }]}>
              {t("extra_tools")}
            </Text>
            <View style={styles.toolsGrid}>
              {canAccessTool('reports', user?.toolPermissions) && (
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
              )}
              {canAccessTool('notifications_center', user?.toolPermissions) && (
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
              )}
              {canAccessTool('export_data', user?.toolPermissions) && (
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
              )}
              {canAccessTool('activity_log', user?.toolPermissions) && (
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
              )}
              {canAccessTool('production_export', user?.toolPermissions) && (
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
              )}
              {canAccessTool('waste_alerts', user?.toolPermissions) && (
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
              )}
              {canAccessTool('reports_analytics', user?.toolPermissions) && (
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
              )}
              {canAccessTool('section_reports', user?.toolPermissions) && (
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
              )}
              {user?.role === "admin" && canAccessTool('users_management', user?.toolPermissions) && (
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
              {user?.role === "admin" && canAccessTool('employee_performance', user?.toolPermissions) && (
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
              {user?.role === "admin" && canAccessTool('backup_restore', user?.toolPermissions) && (
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
              {canAccessTool('machines_comparison', user?.toolPermissions) && (
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
              )}
              {canAccessTool('share_reports', user?.toolPermissions) && (
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
              )}
            </View>
          </>
        )}
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
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 10,
    padding: 8,
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
  summaryIconButton: {
    marginHorizontal: 10,
    marginTop: 7,
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
  },
  adminButtonText: {
    color: "#f59e0b",
    fontWeight: "600",
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48.5%",
    marginBottom: 8,
  },
  card: {
    minHeight: 96,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  description: {
    lineHeight: 13,
    fontSize: 10,
  },
  toolsTitle: {
    marginTop: 10,
    marginBottom: 8,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  toolItem: {
    width: "31.5%",
    marginBottom: 8,
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
