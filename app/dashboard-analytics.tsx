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
      style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 8 }}>{kpi.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 24 }}>
              {kpi.value}
            </Text>
            {kpi.unit && (
              <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 8 }}>{kpi.unit}</Text>
            )}
          </View>
          {kpi.percentage !== undefined && kpi.percentage > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
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
                style={{ fontSize: 12, marginLeft: 4 }}
              >
                {isAr ? `${kpi.percentage}% مقارنة بالأمس` : `${kpi.percentage}% compared to yesterday`}
              </Text>
            </View>
          )}
        </View>
        <View
          style={{ width: 48, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: kpi.color + "20" }}
        >
          <MaterialIcons name={kpi.icon as any} size={24} color={kpi.color} />
        </View>
      </View>
    </View>
  );

  const renderProgressBar = (data: ChartData) => (
    <View key={data.label} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
          {data.label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{data.percentage}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 9999, overflow: 'hidden' }}>
        <View
          style={[{ height: '100%', backgroundColor: colors.primary, borderRadius: 9999 }, { width: `${data.percentage}%` }]}
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, flexDirection: 'row', alignItems: 'center' }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "لوحة المعلومات" : "Dashboard"}</Text>
            <Text style={{ fontSize: 14, marginTop: 4 }}>
              {isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}
            </Text>
          </View>
          <AdminBadgeIcon />
          <TouchableOpacity
            onPress={loadAnalyticsData}
            style={{ borderRadius: 9999, padding: 8 }}
          >
            <MaterialIcons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
        <AdminCard />

        {/* اختيار نطاق الوقت */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', gap: 8 }}>
          {(["day", "week", "month"] as const).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setTimeRange(range)}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }}
            >
              <Text
                style={{ fontWeight: '600', fontSize: 14 }}
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

        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 16 }}>{isAr ? "جاري تحميل البيانات..." : "Loading data..."}</Text>
            </View>
          ) : (
            <>
              {/* مؤشرات الأداء الرئيسية */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
                  {isAr ? "مؤشرات الأداء" : "Performance Indicators"}
                </Text>
                {kpis.map(renderKPICard)}
              </View>

              {/* الرسم البياني */}
              <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
                  {isAr ? "توزيع الإنتاج" : "Production Distribution"}
                </Text>
                {chartData.map(renderProgressBar)}
              </View>

              {/* معلومات إضافية */}
              <View style={{ borderRadius: 8, padding: 16, marginTop: 24, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <MaterialIcons name="info" size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                      {isAr ? "معلومات مهمة" : "Important Information"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
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
