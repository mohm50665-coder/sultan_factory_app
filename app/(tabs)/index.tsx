import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";

interface DashboardItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string;
  description: string;
}

const DASHBOARD_ITEMS: DashboardItem[] = [
  {
    id: "production",
    label: "الإنتاج",
    icon: "factory",
    color: "#3b82f6",
    route: "/production",
    description: "رقم المكينة - الكمية - الهدر - النخب الثاني",
  },
  {
    id: "manufacturing",
    label: "مراحل تسليم الإنتاج",
    icon: "precision-manufacturing",
    color: "#8b5cf6",
    route: "/manufacturing",
    description: "المكائن - الروسو - القلب - الكاوية - الفحص - التغليف - التخزين",
  },
  {
    id: "sales",
    label: "المبيعات والتحصيل",
    icon: "shopping-cart",
    color: "#ec4899",
    route: "/sales",
    description: "تسجيل المبيعات وتحصيل المبالغ",
  },
  {
    id: "warehouse",
    label: "المستودعات",
    icon: "warehouse",
    color: "#f59e0b",
    route: "/warehouse",
    description: "مواد خام - منتج تام - مستلزمات",
  },
  {
    id: "maintenance",
    label: "الصيانة",
    icon: "build",
    color: "#ef4444",
    route: "/maintenance",
    description: "أجهزة مصانة - متوقفة - توصيات",
  },
  {
    id: "financial",
    label: "المصروفات",
    icon: "payments",
    color: "#6366f1",
    route: "/financial",
    description: "التاريخ - مبلغ الصرف - بيان الصرف - التقرير المالي",
  },
  {
    id: "administrative",
    label: "الإجراءات الإدارية",
    icon: "assignment",
    color: "#06b6d4",
    route: "/administrative",
    description: "الطلبات والإجراءات الإدارية",
  },
  {
    id: "tasks",
    label: "المهام",
    icon: "checklist",
    color: "#14b8a6",
    route: "/tasks",
    description: "إدارة المهام والمتابعة",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد من رغبتك في تسجيل الخروج؟",
      [
        { text: "إلغاء" },
        {
          text: "تسجيل الخروج",
          onPress: async () => {
            setIsLoading(true);
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-6">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoading}
              style={styles.headerButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="logout" size={20} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleNavigate("/profile")}
              style={styles.headerButton}
            >
              <MaterialIcons name="person" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View className="items-end">
            <Text className="text-white text-sm opacity-80">أهلاً بك</Text>
            <Text className="text-white font-bold text-xl mt-1">{user?.name || "المستخدم"}</Text>
            <Text className="text-white/70 text-xs mt-1">
              {user?.position || (user?.role === "admin" ? "مدير النظام" : "موظف")}
            </Text>
          </View>
        </View>
      </View>

      {/* زر لوحة تحكم ADMIN */}
      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={() => handleNavigate("/admin-dashboard")}
          style={styles.adminButton}
        >
          <MaterialIcons name="chevron-left" size={20} color="#f59e0b" />
          <View style={styles.adminButtonContent}>
            <Text style={styles.adminButtonText}>لوحة تحكم ADMIN</Text>
            <MaterialIcons name="admin-panel-settings" size={20} color="#f59e0b" />
          </View>
        </TouchableOpacity>
      )}

      {/* شبكة الأيقونات */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {DASHBOARD_ITEMS.map((item) => (
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
                <Text className="text-foreground font-bold text-sm text-right">{item.label}</Text>
                <Text className="text-muted text-xs mt-1 text-right" style={styles.description}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* أدوات إضافية */}
        <Text className="text-foreground font-bold text-base text-right" style={styles.toolsTitle}>أدوات إضافية</Text>
        <View style={styles.toolsGrid}>
          <TouchableOpacity
            onPress={() => handleNavigate("/reports")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text className="text-foreground text-xs font-semibold mt-2">التقارير</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/notifications-center")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="notifications" size={24} color="#d97706" />
              <Text className="text-foreground text-xs font-semibold mt-2">الإشعارات</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleNavigate("/export-data")}
            style={styles.toolItem}
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="file-download" size={24} color="#6366f1" />
              <Text className="text-foreground text-xs font-semibold mt-2">التصدير</Text>
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
});
