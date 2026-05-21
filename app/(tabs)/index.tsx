import React, { useState, useEffect } from "react";
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
import { useAuth } from "@/hooks/use-auth";
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
    description: "إدارة الإنتاج والكميات",
  },
  {
    id: "manufacturing",
    label: "مراحل التصنيع",
    icon: "precision-manufacturing",
    color: "#8b5cf6",
    route: "/manufacturing",
    description: "تتبع مراحل التصنيع",
  },
  {
    id: "sales",
    label: "المبيعات",
    icon: "shopping-cart",
    color: "#ec4899",
    route: "/sales",
    description: "تسجيل المبيعات",
  },
  {
    id: "collection",
    label: "التحصيل",
    icon: "attach-money",
    color: "#10b981",
    route: "/collection",
    description: "تحصيل المبالغ",
  },
  {
    id: "warehouse",
    label: "المستودعات",
    icon: "warehouse",
    color: "#f59e0b",
    route: "/warehouse",
    description: "إدارة المستودعات",
  },
  {
    id: "maintenance",
    label: "الصيانة",
    icon: "build",
    color: "#ef4444",
    route: "/maintenance",
    description: "تسجيل الصيانة",
  },
  {
    id: "administrative",
    label: "الإجراءات الإدارية",
    icon: "assignment",
    color: "#06b6d4",
    route: "/administrative",
    description: "الطلبات الإدارية",
  },
  {
    id: "financial",
    label: "الشؤون المالية",
    icon: "account-balance",
    color: "#6366f1",
    route: "/financial",
    description: "إدارة النفقات",
  },
  {
    id: "tasks",
    label: "المهام",
    icon: "checklist",
    color: "#14b8a6",
    route: "/tasks",
    description: "إدارة المهام",
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
        { text: "إلغاء", onPress: () => {} },
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

  const handleAdminDashboard = () => {
    if (user?.role === "admin") {
      router.push("/admin-dashboard");
    } else {
      Alert.alert("خطأ", "ليس لديك صلاحية للوصول إلى لوحة التحكم");
    }
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6">
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-white text-sm opacity-80">أهلاً بك</Text>
            <Text className="text-white font-bold text-xl mt-1">{user?.name || "المستخدم"}</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoading}
            className="bg-white/20 rounded-lg p-2"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="logout" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-white/80 text-xs">
          الدور: {user?.role === "admin" ? "مدير النظام" : "موظف"}
        </Text>
      </View>

      {/* زر لوحة تحكم ADMIN */}
      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={handleAdminDashboard}
          className="mx-4 mt-4 bg-warning/10 border border-warning rounded-lg p-3 flex-row items-center"
        >
          <MaterialIcons name="admin-panel-settings" size={20} color={colors.warning} />
          <Text className="text-warning font-semibold text-sm ml-3">لوحة تحكم ADMIN</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.warning} className="ml-auto" />
        </TouchableOpacity>
      )}

      {/* شبكة الأيقونات */}
      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap justify-between">
          {DASHBOARD_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(item.route)}
              className="w-[48%] mb-4"
            >
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-border overflow-hidden">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center mb-3"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text className="text-foreground font-bold text-sm leading-4">{item.label}</Text>
                <Text className="text-muted text-xs mt-2 leading-3">{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* معلومات إضافية */}
        <View className="bg-blue/10 rounded-lg p-4 mt-6 border border-border mb-6">
          <Text className="text-foreground font-semibold text-sm mb-2">ملاحظة</Text>
          <Text className="text-muted text-xs leading-5">
            يمكنك الوصول إلى جميع أقسام المصنع من خلال الأيقونات أعلاه. اختر القسم المطلوب لإدارة البيانات المتعلقة به.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
