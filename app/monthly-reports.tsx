import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { productionService, salesService, expensesService, taskService } from "@/lib/services/api.service";
import { maintenanceEntriesService } from "@/lib/services/data.service";

interface MonthlyData {
  month: string;
  totalProduction: number;
  totalWaste: number;
  wastePercentage: number;
  totalSales: number;
  totalExpenses: number;
  maintenanceCount: number;
  tasksCompleted: number;
  tasksPending: number;
}

export default function MonthlyReportsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    try {
      setError(null);
      
      // Load production data from server
      let prodEntries = [];
      try {
        prodEntries = await productionService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات الإنتاج:", e);
        prodEntries = [];
      }
      
      let totalProduction = 0;
      let totalWaste = 0;
      prodEntries.forEach((item: any) => {
        totalProduction += parseInt(item.productionDozen || "0");
        totalWaste += parseInt(item.wasteThreadGrams || "0") + parseInt(item.wasteSocksGrams || "0");
      });

      // Load sales data from server
      let salesEntries = [];
      try {
        salesEntries = await salesService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات المبيعات:", e);
        salesEntries = [];
      }
      const totalSales = salesEntries.length;

      // Load expenses data from server
      let expEntries = [];
      try {
        expEntries = await expensesService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات المصروفات:", e);
        expEntries = [];
      }
      const totalExpenses = expEntries.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);

      // Load maintenance data from server
      let maintenanceCount = 0;
      try {
        const periodic = await maintenanceEntriesService.getBySection("periodic") || [];
        const emergency = await maintenanceEntriesService.getBySection("emergency") || [];
        maintenanceCount = periodic.length + emergency.length;
      } catch (e) {
        console.warn("خطأ في تحميل بيانات الصيانة:", e);
        maintenanceCount = 0;
      }

      // Load tasks data from server
      let tasksCompleted = 0;
      let tasksPending = 0;
      try {
        const tasksEntries = await taskService.getAll() || [];
        tasksCompleted = tasksEntries.filter((t: any) => t.result === "completed").length;
        tasksPending = tasksEntries.filter((t: any) => !t.result || t.result === "pending").length;
      } catch (e) {
        console.warn("خطأ في تحميل بيانات المهام:", e);
        tasksCompleted = 0;
        tasksPending = 0;
      }

      const wastePercentage = totalProduction > 0 ? (totalWaste / totalProduction) * 100 : 0;

      const now = new Date();
      const monthNames = isAr
        ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
        : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      setMonthlyData({
        month: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
        totalProduction,
        totalWaste,
        wastePercentage,
        totalSales,
        totalExpenses,
        maintenanceCount,
        tasksCompleted,
        tasksPending,
      });
    } catch (error) {
      console.error("خطأ في تحميل البيانات الشهرية:", error);
      setError(isAr ? "حدث خطأ في تحميل البيانات" : "Error loading data");
      setMonthlyData(null);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRealData();
  };

  const StatCard = ({
    label,
    value,
    unit,
    icon,
    color,
  }: {
    label: string;
    value: number | string;
    unit?: string;
    icon: string;
    color: string;
  }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            {value}
          </Text>
          {unit && (
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
              {unit}
            </Text>
          )}
        </View>
      </View>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: `${color}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* رأس الصفحة */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 4,
                textAlign: isAr ? "right" : "left",
              }}
            >
              {isAr ? "التقارير الشهرية" : "Monthly Reports"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                textAlign: isAr ? "right" : "left",
              }}
            >
              {isAr ? "ملخص الأداء الشهري" : "Monthly performance summary"}
            </Text>
          </View>
          <BackButton />
        </View>

        {/* رسالة الخطأ */}
        {error && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.error + "15", borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.error }}>
            <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {isLoading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 60,
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
              {isAr ? "جاري تحميل البيانات..." : "Loading data..."}
            </Text>
          </View>
        ) : !monthlyData ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 60,
            }}
          >
            <View
              style={{
                backgroundColor: colors.primary + "15",
                borderRadius: 40,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <MaterialIcons name="calendar-month" size={48} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              {isAr ? "لا توجد بيانات" : "No data"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                textAlign: "center",
                paddingHorizontal: 40,
                lineHeight: 20,
              }}
            >
              {isAr
                ? "ستظهر التقارير الشهرية هنا بعد إدخال البيانات"
                : "Monthly reports will appear here after data entry"}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {/* شهر التقرير */}
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 12,
                textAlign: isAr ? "right" : "left",
              }}
            >
              {monthlyData.month}
            </Text>

            {/* الإنتاج والهدر */}
            <StatCard
              label={isAr ? "إجمالي الإنتاج" : "Total Production"}
              value={monthlyData.totalProduction}
              unit={isAr ? "درزن" : "Dozen"}
              icon="precision-manufacturing"
              color="#3B82F6"
            />

            <StatCard
              label={isAr ? "نسبة الهدر" : "Waste Percentage"}
              value={monthlyData.wastePercentage.toFixed(2)}
              unit="%"
              icon="warning"
              color="#EF4444"
            />

            {/* المبيعات والمصروفات */}
            <StatCard
              label={isAr ? "عدد المبيعات" : "Sales Count"}
              value={monthlyData.totalSales}
              icon="shopping-cart"
              color="#10B981"
            />

            <StatCard
              label={isAr ? "إجمالي المصروفات" : "Total Expenses"}
              value={monthlyData.totalExpenses.toLocaleString()}
              unit={isAr ? "ريال" : "SAR"}
              icon="receipt-long"
              color="#8B5CF6"
            />

            {/* الصيانة والمهام */}
            <StatCard
              label={isAr ? "عمليات الصيانة" : "Maintenance"}
              value={monthlyData.maintenanceCount}
              icon="build"
              color="#F59E0B"
            />

            <StatCard
              label={isAr ? "المهام المكتملة" : "Completed Tasks"}
              value={monthlyData.tasksCompleted}
              icon="check-circle"
              color="#06B6D4"
            />

            <StatCard
              label={isAr ? "المهام المعلقة" : "Pending Tasks"}
              value={monthlyData.tasksPending}
              icon="schedule"
              color="#EC4899"
            />
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
