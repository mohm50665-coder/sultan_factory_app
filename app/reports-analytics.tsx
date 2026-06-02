import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart, PieChart, ProgressBar, StatCard } from "@/components/charts";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Period = "today" | "week" | "month";

export default function ReportsAnalyticsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [period, setPeriod] = useState<Period>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [productionData, setProductionData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await AsyncStorage.getItem("sultan_production_data_v2");
      if (data) {
        const entries = JSON.parse(data);
        setProductionData(entries);
      }
    } catch (error) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats from production data
  const totalProduction = productionData.reduce((sum, e) => sum + (e.productionDozen || 0), 0);
  const totalWaste = productionData.reduce((sum, e) => sum + (e.wasteThread || 0) + (e.wasteSocks || 0), 0);
  const totalSecondGrade = productionData.reduce((sum, e) => sum + (e.secondGrade || 0), 0);
  const totalNeedles = productionData.reduce((sum, e) => sum + (e.wasteNeedles || 0), 0);
  const machineCount = new Set(productionData.map((e) => e.machineNumber)).size;

  // Bar chart: production per machine
  const machineProduction: Record<string, number> = {};
  productionData.forEach((e) => {
    const key = `M${e.machineNumber || "?"}`;
    machineProduction[key] = (machineProduction[key] || 0) + (e.productionDozen || 0);
  });
  const barData = Object.entries(machineProduction)
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // Pie chart: waste distribution
  const pieData = [
    { label: isAr ? "خيوط" : "Thread", value: productionData.reduce((s, e) => s + (e.wasteThread || 0), 0), color: "#3b82f6" },
    { label: isAr ? "جوارب" : "Socks", value: productionData.reduce((s, e) => s + (e.wasteSocks || 0), 0), color: "#ef4444" },
    { label: isAr ? "إبر" : "Needles", value: totalNeedles, color: "#f59e0b" },
  ];

  // Progress bars: machine efficiency (simulated)
  const machineEfficiency = Object.entries(machineProduction)
    .slice(0, 5)
    .map(([machine, production]) => ({
      label: machine,
      value: production,
      max: Math.max(...Object.values(machineProduction), 1),
    }));

  const PERIODS: Array<{ key: Period; labelAr: string; labelEn: string }> = [
    { key: "today", labelAr: "اليوم", labelEn: "Today" },
    { key: "week", labelAr: "الأسبوع", labelEn: "Week" },
    { key: "month", labelAr: "الشهر", labelEn: "Month" },
  ];

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>
          {isAr ? "التقارير والتحليلات" : "Reports & Analytics"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodContainer}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {isAr ? p.labelAr : p.labelEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatCard
              title={isAr ? "إجمالي الإنتاج" : "Total Production"}
              value={`${totalProduction}`}
              subtitle={isAr ? "درزن" : "dozen"}
              color="#3b82f6"
              trend={totalProduction > 0 ? "up" : "neutral"}
              trendValue={totalProduction > 0 ? (isAr ? "نشط" : "Active") : ""}
            />
            <StatCard
              title={isAr ? "المكائن" : "Machines"}
              value={`${machineCount}`}
              subtitle={isAr ? "مكينة نشطة" : "active"}
              color="#10b981"
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title={isAr ? "إجمالي الهدر" : "Total Waste"}
              value={`${totalWaste}`}
              subtitle={isAr ? "جرام" : "grams"}
              color="#ef4444"
              trend={totalWaste > 0 ? "down" : "neutral"}
              trendValue={totalWaste > 0 ? (isAr ? "يحتاج مراجعة" : "Needs review") : ""}
            />
            <StatCard
              title={isAr ? "النخب الثاني" : "2nd Grade"}
              value={`${totalSecondGrade}`}
              subtitle={isAr ? "زوج" : "pairs"}
              color="#f59e0b"
            />
          </View>

          {/* Bar Chart: Production per Machine */}
          {barData.length > 0 ? (
            <BarChart
              data={barData}
              title={isAr ? "الإنتاج حسب المكينة (درزن)" : "Production per Machine (dozen)"}
              height={160}
              barColor="#3b82f6"
            />
          ) : (
            <View style={styles.emptyChart}>
              <MaterialIcons name="bar-chart" size={40} color="#d1d5db" />
              <Text style={styles.emptyChartText}>
                {isAr ? "لا توجد بيانات إنتاج بعد" : "No production data yet"}
              </Text>
            </View>
          )}

          {/* Pie Chart: Waste Distribution */}
          {totalWaste > 0 && (
            <PieChart
              data={pieData}
              title={isAr ? "توزيع الهدر" : "Waste Distribution"}
              size={100}
            />
          )}

          {/* Progress Bars: Machine Efficiency */}
          {machineEfficiency.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                {isAr ? "أداء المكائن (مقارنة)" : "Machine Performance (Comparison)"}
              </Text>
              {machineEfficiency.map((item, index) => (
                <ProgressBar
                  key={index}
                  label={item.label}
                  value={item.value}
                  max={item.max}
                  color={index === 0 ? "#10b981" : index === 1 ? "#3b82f6" : "#f59e0b"}
                />
              ))}
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <MaterialIcons name="insights" size={24} color="#6366f1" />
            <View style={styles.summaryContent}>
              <Text style={[styles.summaryTitle, { textAlign: isRtl ? "right" : "left" }]}>
                {isAr ? "ملخص الأداء" : "Performance Summary"}
              </Text>
              <Text style={[styles.summaryText, { textAlign: isRtl ? "right" : "left" }]}>
                {productionData.length > 0
                  ? isAr
                    ? `تم تسجيل ${productionData.length} إدخال إنتاج من ${machineCount} مكينة بإجمالي ${totalProduction} درزن`
                    : `${productionData.length} entries from ${machineCount} machines totaling ${totalProduction} dozen`
                  : isAr
                  ? "لم يتم تسجيل بيانات إنتاج بعد. ابدأ بإدخال بيانات الإنتاج اليومية."
                  : "No production data recorded yet. Start entering daily production data."}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  periodContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  periodTabActive: {
    backgroundColor: "#0a7ea4",
  },
  periodText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  periodTextActive: {
    color: "white",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },
  emptyChart: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyChartText: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#f5f3ff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e9e5ff",
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4c1d95",
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
});
