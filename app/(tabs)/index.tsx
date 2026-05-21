import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
    label: "مراحل التصنيع",
    icon: "precision-manufacturing",
    color: "#8b5cf6",
    route: "/manufacturing",
    description: "المكائن - الروسو - القلب - الكاوية - الفحص - التغليف - التخزين",
  },
  {
    id: "sales",
    label: "المبيعات",
    icon: "shopping-cart",
    color: "#ec4899",
    route: "/sales",
    description: "تسجيل المبيعات والعملاء",
  },
  {
    id: "collection",
    label: "التحصيل",
    icon: "attach-money",
    color: "#10b981",
    route: "/collection",
    description: "تحصيل المبالغ المستحقة",
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
    id: "administrative",
    label: "الإجراءات الإدارية",
    icon: "assignment",
    color: "#06b6d4",
    route: "/administrative",
    description: "الطلبات والإجراءات الإدارية",
  },
  {
    id: "financial",
    label: "الشؤون المالية",
    icon: "account-balance",
    color: "#6366f1",
    route: "/financial",
    description: "رصيد البنك - الصرف النقدي - المشتريات",
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

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-6">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoading}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, padding: 8 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="logout" size={20} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/profile" as any)}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, padding: 8 }}
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
          onPress={() => router.push("/admin-dashboard" as any)}
          className="mx-4 mt-4 bg-surface border border-warning rounded-xl p-3 flex-row items-center justify-between"
        >
          <MaterialIcons name="chevron-left" size={20} color="#f59e0b" />
          <View className="flex-row items-center gap-2">
            <Text className="text-warning font-semibold text-sm">لوحة تحكم ADMIN</Text>
            <MaterialIcons name="admin-panel-settings" size={20} color="#f59e0b" />
          </View>
        </TouchableOpacity>
      )}

      {/* شبكة الأيقونات */}
      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap justify-between">
          {DASHBOARD_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(item.route as any)}
              className="w-[48%] mb-4"
              activeOpacity={0.7}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border min-h-[130px]">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center mb-3"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <MaterialIcons name={item.icon as any} size={26} color={item.color} />
                </View>
                <Text className="text-foreground font-bold text-sm text-right">{item.label}</Text>
                <Text className="text-muted text-xs mt-1 text-right leading-4">{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* أدوات إضافية */}
        <Text className="text-foreground font-bold text-base text-right mt-4 mb-3">أدوات إضافية</Text>
        <View className="flex-row flex-wrap justify-between mb-6">
          <TouchableOpacity
            onPress={() => router.push("/reports" as any)}
            className="w-[31%] mb-3"
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="bar-chart" size={24} color="#059669" />
              <Text className="text-foreground text-xs font-semibold mt-2">التقارير</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/notifications-center" as any)}
            className="w-[31%] mb-3"
            activeOpacity={0.7}
          >
            <View className="bg-surface rounded-xl p-3 border border-border items-center">
              <MaterialIcons name="notifications" size={24} color="#d97706" />
              <Text className="text-foreground text-xs font-semibold mt-2">الإشعارات</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/export-data" as any)}
            className="w-[31%] mb-3"
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
