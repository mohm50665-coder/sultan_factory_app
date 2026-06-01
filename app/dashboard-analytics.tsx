import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";


interface KPI {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  color: string;
  trend?: "up" | "down" | "stable";
  percentage?: number;
}

interface ChartData {
  label: string;
  value: number;
  percentage: number;
}

export default function DashboardAnalyticsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("day");
  const { language } = useLanguage();
  const isAr = language === "ar";

  useEffect(() => {
    loadAnalyticsData();
    const interval = setInterval(loadAnalyticsData, 30000); // تحديث كل 30 ثانية
    return () => clearInterval(interval);
  }, [timeRange, isAr]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);

      // جلب البيانات من التخزين المحلي بالمفاتيح الصحيحة
      const prodRaw = await AsyncStorage.getItem("sultan_production_data_v2");
      const prodEntries = prodRaw ? JSON.parse(prodRaw) : [];
      let totalProduction = 0;
      let totalWaste = 0;
      let totalSecondGrade = 0;
      prodEntries.forEach((entry: any) => {
        if (entry.machines) {
          Object.values(entry.machines).forEach((m: any) => {
            totalProduction += parseInt(m.productionDozen || "0");
            totalWaste += parseInt(m.wasteThreadGrams || "0") + parseInt(m.wasteSocksGrams || "0");
            totalSecondGrade += (parseInt(m.secondGradeDozen || "0") * 12) + parseInt(m.secondGradePairs || "0");
          });
        }
      });

      const salesRaw = await AsyncStorage.getItem("sultan_sales_data");
      const salesEntries = salesRaw ? JSON.parse(salesRaw) : [];
      const totalSales = salesEntries.reduce((s: number, e: any) => s + (parseFloat(e.totalAmount) || 0), 0);

      const maintPeriodicRaw = await AsyncStorage.getItem("sultan_maintenance_periodic");
      const maintEmergencyRaw = await AsyncStorage.getItem("sultan_maintenance_emergency");
      const periodic = maintPeriodicRaw ? JSON.parse(maintPeriodicRaw) : [];
      const emergency = maintEmergencyRaw ? JSON.parse(maintEmergencyRaw) : [];
      const maintenanceCount = periodic.length + emergency.length;

      const wastePercentage = totalProduction > 0 ? ((totalWaste / totalProduction) * 100).toFixed(2) : "0";

      const newKpis: KPI[] = [
        {
          label: isAr ? "إجمالي الإنتاج" : "Total Production",
          value: totalProduction,
          unit: isAr ? "درزن" : "Dozen",
          icon: "factory",
          color: "#0a7ea4",
          trend: "stable",
          percentage: 0,
        },
        {
          label: isAr ? "معدل الهدر" : "Waste Rate",
          value: wastePercentage,
          unit: "%",
          icon: "warning",
          color: "#ef4444",
          trend: "stable",
          percentage: 0,
        },
        {
          label: isAr ? "إجمالي المبيعات" : "Total Sales",
          value: totalSales > 0 ? totalSales.toFixed(0) : "0",
          unit: isAr ? "ريال" : "SAR",
          icon: "shopping-cart",
          color: "#22c55e",
          trend: "stable",
          percentage: 0,
        },
        {
          label: isAr ? "عمليات الصيانة" : "Maintenance Operations",
          value: maintenanceCount,
          unit: isAr ? "عملية" : "Operation",
          icon: "build",
          color: "#f59e0b",
          trend: "stable",
          percentage: 0,
        },
      ];

      setKpis(newKpis);

      // تحضير بيانات الرسم البياني من البيانات الفعلية
      const total = totalProduction + totalWaste + totalSecondGrade;
      const productionBySection = total > 0 ? [
        { label: isAr ? "الإنتاج" : "Production", value: totalProduction, percentage: Math.round((totalProduction / total) * 100) },
        { label: isAr ? "الهدر" : "Waste", value: totalWaste, percentage: Math.round((totalWaste / total) * 100) },
        { label: isAr ? "النخب الثاني" : "Second Grade", value: totalSecondGrade, percentage: Math.round((totalSecondGrade / total) * 100) },
      ] : [];

      setChartData(productionBySection);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderKPICard = (kpi: KPI) => (
    <View
      key={kpi.label}
      className="bg-surface rounded-lg p-4 mb-4 border border-border"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-muted text-sm mb-2">{kpi.label}</Text>
          <View className="flex-row items-baseline">
            <Text className="text-foreground font-bold text-2xl">
              {kpi.value}
            </Text>
            {kpi.unit && (
              <Text className="text-muted text-sm ml-2">{kpi.unit}</Text>
            )}
          </View>
          {kpi.percentage !== undefined && kpi.percentage > 0 && (
            <View className="flex-row items-center mt-2">
              <MaterialIcons
                name={
                  kpi.trend === "up"
                    ? "trending-up"
                    : kpi.trend === "down"
                      ? "trending-down"
                      : "trending-flat"
                }
                size={16}
                color={
                  kpi.trend === "up"
                    ? "#22c55e"
                    : kpi.trend === "down"
                      ? "#ef4444"
                      : "#f59e0b"
                }
              />
              <Text
                className={`text-xs ml-1 ${
                  kpi.trend === "up"
                    ? "text-success"
                    : kpi.trend === "down"
                      ? "text-error"
                      : "text-warning"
                }`}
              >
                {isAr ? `${kpi.percentage}% مقارنة بالأمس` : `${kpi.percentage}% compared to yesterday`}
              </Text>
            </View>
          )}
        </View>
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{ backgroundColor: kpi.color + "20" }}
        >
          <MaterialIcons name={kpi.icon as any} size={24} color={kpi.color} />
        </View>
      </View>
    </View>
  );

  const renderProgressBar = (data: ChartData) => (
    <View key={data.label} className="mb-4">
      <View className="flex-row justify-between mb-2">
        <Text className="text-foreground text-sm font-semibold">
          {data.label}
        </Text>
        <Text className="text-muted text-xs">{data.percentage}%</Text>
      </View>
      <View className="h-2 bg-border rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${data.percentage}%` }}
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1">
        {/* رأس الصفحة */}
        <View className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 flex-row items-center">
          <BackButton />
          <View className="flex-1">
            <Text className="text-white font-bold text-xl">{isAr ? "لوحة المعلومات" : "Dashboard"}</Text>
            <Text className="text-white/80 text-sm mt-1">
              {isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}
            </Text>
          </View>
          <AdminBadgeIcon />
          <TouchableOpacity
            onPress={loadAnalyticsData}
            className="bg-white/20 rounded-full p-2"
          >
            <MaterialIcons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
        <AdminCard />

        {/* اختيار نطاق الوقت */}
        <View className="px-6 py-4 flex-row gap-2">
          {(["day", "week", "month"] as const).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setTimeRange(range)}
              className={`flex-1 rounded-lg py-2 px-3 items-center justify-center border ${
                timeRange === range
                  ? "bg-primary border-primary"
                  : "bg-surface border-border"
              }`}
            >
              <Text
                className={`font-semibold text-sm ${
                  timeRange === range ? "text-white" : "text-foreground"
                }`}
              >
                {range === "day"
                  ? (isAr ? "يوم" : "Day")
                  : range === "week"
                    ? (isAr ? "أسبوع" : "Week")
                    : (isAr ? "شهر" : "Month")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="px-6 pb-6">
          {isLoading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-muted text-sm mt-4">{isAr ? "جاري تحميل البيانات..." : "Loading data..."}</Text>
            </View>
          ) : (
            <>
              {/* مؤشرات الأداء الرئيسية */}
              <View className="mb-6">
                <Text className="text-foreground font-bold text-base mb-4">
                  {isAr ? "مؤشرات الأداء" : "Performance Indicators"}
                </Text>
                {kpis.map(renderKPICard)}
              </View>

              {/* الرسم البياني */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-foreground font-bold text-base mb-4">
                  {isAr ? "توزيع الإنتاج" : "Production Distribution"}
                </Text>
                {chartData.map(renderProgressBar)}
              </View>

              {/* معلومات إضافية */}
              <View className="bg-blue/10 rounded-lg p-4 mt-6 border border-border">
                <View className="flex-row items-start">
                  <MaterialIcons name="info" size={20} color={colors.primary} />
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-semibold text-sm mb-1">
                      {isAr ? "معلومات مهمة" : "Important Information"}
                    </Text>
                    <Text className="text-muted text-xs leading-5">
                      {isAr ? "تتحدث لوحة المعلومات في الوقت الفعلي. يتم تحديث البيانات تلقائياً كل 30 ثانية. يمكنك الضغط على زر التحديث للحصول على أحدث البيانات فوراً." : "The dashboard updates in real-time. Data is automatically updated every 30 seconds. You can press the refresh button to get the latest data immediately."}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
