import React, { useState, useEffect } from "react";
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
import { localStorageService } from "@/lib/services/local-storage";

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

  useEffect(() => {
    loadAnalyticsData();
    const interval = setInterval(loadAnalyticsData, 30000); // تحديث كل 30 ثانية
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);

      // جلب البيانات من التخزين المحلي
      const productionData = await localStorageService.getAllData("production");
      const salesData = await localStorageService.getAllData("sales");
      const maintenanceData = await localStorageService.getAllData(
        "maintenance"
      );

      // حساب المؤشرات
      const totalProduction = productionData.reduce(
        (sum: number, item: any) => sum + (parseInt(item.quantity) || 0),
        0
      );
      const totalWaste = productionData.reduce(
        (sum: number, item: any) => sum + (parseInt(item.waste) || 0),
        0
      );
      const wastePercentage =
        totalProduction > 0
          ? ((totalWaste / totalProduction) * 100).toFixed(2)
          : 0;
      const totalSales = salesData.reduce(
        (sum: number, item: any) => sum + (parseFloat(item.amount) || 0),
        0
      );
      const maintenanceCount = maintenanceData.length;

      const newKpis: KPI[] = [
        {
          label: "إجمالي الإنتاج",
          value: totalProduction,
          unit: "درزن",
          icon: "factory",
          color: "#0a7ea4",
          trend: "up",
          percentage: 12,
        },
        {
          label: "معدل الهدر",
          value: wastePercentage,
          unit: "%",
          icon: "warning",
          color: "#ef4444",
          trend: totalWaste > 0 ? "up" : "stable",
          percentage: totalWaste > 0 ? 5 : 0,
        },
        {
          label: "إجمالي المبيعات",
          value: totalSales.toFixed(2),
          unit: "ريال",
          icon: "shopping-cart",
          color: "#22c55e",
          trend: "up",
          percentage: 8,
        },
        {
          label: "عمليات الصيانة",
          value: maintenanceCount,
          unit: "عملية",
          icon: "build",
          color: "#f59e0b",
          trend: "stable",
          percentage: 0,
        },
      ];

      setKpis(newKpis);

      // تحضير بيانات الرسم البياني
      const productionBySection = [
        { label: "الإنتاج", value: totalProduction, percentage: 60 },
        { label: "الهدر", value: totalWaste, percentage: 15 },
        { label: "النخب الثاني", value: totalProduction * 0.1, percentage: 25 },
      ];

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
                {kpi.percentage}% مقارنة بالأمس
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
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-bold text-xl">لوحة المعلومات</Text>
            <Text className="text-white/80 text-sm mt-1">
              مؤشرات الأداء الرئيسية
            </Text>
          </View>
          <TouchableOpacity
            onPress={loadAnalyticsData}
            className="bg-white/20 rounded-full p-2"
          >
            <MaterialIcons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>

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
                  ? "يوم"
                  : range === "week"
                    ? "أسبوع"
                    : "شهر"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="px-6 pb-6">
          {isLoading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-muted text-sm mt-4">جاري تحميل البيانات...</Text>
            </View>
          ) : (
            <>
              {/* مؤشرات الأداء الرئيسية */}
              <View className="mb-6">
                <Text className="text-foreground font-bold text-base mb-4">
                  مؤشرات الأداء
                </Text>
                {kpis.map(renderKPICard)}
              </View>

              {/* الرسم البياني */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-foreground font-bold text-base mb-4">
                  توزيع الإنتاج
                </Text>
                {chartData.map(renderProgressBar)}
              </View>

              {/* معلومات إضافية */}
              <View className="bg-blue/10 rounded-lg p-4 mt-6 border border-border">
                <View className="flex-row items-start">
                  <MaterialIcons name="info" size={20} color={colors.primary} />
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-semibold text-sm mb-1">
                      معلومات مهمة
                    </Text>
                    <Text className="text-muted text-xs leading-5">
                      تتحدث لوحة المعلومات في الوقت الفعلي. يتم تحديث البيانات
                      تلقائياً كل 30 ثانية. يمكنك الضغط على زر التحديث للحصول على
                      أحدث البيانات فوراً.
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
