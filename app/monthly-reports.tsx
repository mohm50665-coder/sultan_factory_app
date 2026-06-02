import { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    setIsLoading(true);
    try {
      // Load production data
      const prodRaw = await AsyncStorage.getItem("sultan_production_data_v2");
      const prodEntries = prodRaw ? JSON.parse(prodRaw) : [];
      let totalProduction = 0;
      let totalWaste = 0;
      prodEntries.forEach((entry: any) => {
        if (entry.machines) {
          Object.values(entry.machines).forEach((m: any) => {
            totalProduction += parseInt(m.productionDozen || "0");
            totalWaste += parseInt(m.wasteThreadGrams || "0") + parseInt(m.wasteSocksGrams || "0");
          });
        }
      });

      // Load sales data
      const salesRaw = await AsyncStorage.getItem("sultan_sales_data");
      const salesEntries = salesRaw ? JSON.parse(salesRaw) : [];
      const totalSales = salesEntries.length;

      // Load expenses data
      const expRaw = await AsyncStorage.getItem("sultan_expenses");
      const expEntries = expRaw ? JSON.parse(expRaw) : [];
      const totalExpenses = expEntries.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);

      // Load maintenance data
      const maintPeriodicRaw = await AsyncStorage.getItem("sultan_maintenance_periodic");
      const maintEmergencyRaw = await AsyncStorage.getItem("sultan_maintenance_emergency");
      const periodic = maintPeriodicRaw ? JSON.parse(maintPeriodicRaw) : [];
      const emergency = maintEmergencyRaw ? JSON.parse(maintEmergencyRaw) : [];
      const maintenanceCount = periodic.length + emergency.length;

      // Load tasks data
      const tasksRaw = await AsyncStorage.getItem("tasks_entries");
      const tasksEntries = tasksRaw ? JSON.parse(tasksRaw) : [];
      const tasksCompleted = tasksEntries.filter((t: any) => t.result === "completed").length;
      const tasksPending = tasksEntries.filter((t: any) => !t.result || t.result === "pending").length;

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
      setMonthlyData(null);
    } finally {
      setIsLoading(false);
    }
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

  const hasData = monthlyData && (
    monthlyData.totalProduction > 0 ||
    monthlyData.totalSales > 0 ||
    monthlyData.totalExpenses > 0 ||
    monthlyData.maintenanceCount > 0 ||
    monthlyData.tasksCompleted > 0 ||
    monthlyData.tasksPending > 0
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 }}>
        <BackButton />
        <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
          {isAr ? "التقارير الشهرية" : "Monthly Reports"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>
            {isAr ? "جارٍ تحميل البيانات..." : "Loading data..."}
          </Text>
        </View>
      ) : !hasData ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <MaterialIcons name="analytics" size={64} color="#d1d5db" />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginTop: 16, textAlign: "center" }}>
            {isAr ? "لا توجد بيانات بعد" : "No data available yet"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
            {isAr ? "ابدأ بإدخال البيانات في أقسام التطبيق المختلفة لعرض التقرير الشهري" : "Start entering data in the app sections to view monthly reports"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
          {/* عنوان الشهر */}
          <View style={{ backgroundColor: `${colors.primary}15`, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "bold" }}>
              {monthlyData!.month}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {isAr ? "ملخص الأداء الشهري" : "Monthly Performance Summary"}
            </Text>
          </View>

          {/* الإنتاج */}
          {monthlyData!.totalProduction > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
                {isAr ? "الإنتاج" : "Production"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي الإنتاج" : "Total Production"}
                value={monthlyData!.totalProduction.toLocaleString()}
                unit={isAr ? "درزن" : "dozen"}
                icon="factory"
                color={colors.primary}
              />
              <StatCard
                label={isAr ? "إجمالي الهدر" : "Total Waste"}
                value={monthlyData!.totalWaste.toLocaleString()}
                unit={isAr ? "جرام" : "g"}
                icon="warning"
                color="#FF9800"
              />
              <StatCard
                label={isAr ? "نسبة الهدر" : "Waste %"}
                value={monthlyData!.wastePercentage.toFixed(1)}
                unit="%"
                icon="pie-chart"
                color="#ef4444"
              />
            </>
          )}

          {/* المبيعات */}
          {monthlyData!.totalSales > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المبيعات" : "Sales"}
              </Text>
              <StatCard
                label={isAr ? "عمليات البيع" : "Sales Operations"}
                value={monthlyData!.totalSales}
                icon="shopping-cart"
                color="#10b981"
              />
            </>
          )}

          {/* المصروفات */}
          {monthlyData!.totalExpenses > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المصروفات" : "Expenses"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي المصروفات" : "Total Expenses"}
                value={monthlyData!.totalExpenses.toLocaleString()}
                unit={isAr ? "ريال" : "SAR"}
                icon="payments"
                color="#6366f1"
              />
            </>
          )}

          {/* الصيانة */}
          {monthlyData!.maintenanceCount > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "الصيانة" : "Maintenance"}
              </Text>
              <StatCard
                label={isAr ? "عمليات الصيانة" : "Maintenance Ops"}
                value={monthlyData!.maintenanceCount}
                icon="build"
                color="#ef4444"
              />
            </>
          )}

          {/* المهام */}
          {(monthlyData!.tasksCompleted > 0 || monthlyData!.tasksPending > 0) && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المهام" : "Tasks"}
              </Text>
              <StatCard
                label={isAr ? "مهام مكتملة" : "Completed Tasks"}
                value={monthlyData!.tasksCompleted}
                icon="check-circle"
                color="#10b981"
              />
              <StatCard
                label={isAr ? "مهام معلقة" : "Pending Tasks"}
                value={monthlyData!.tasksPending}
                icon="pending"
                color="#f59e0b"
              />
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
