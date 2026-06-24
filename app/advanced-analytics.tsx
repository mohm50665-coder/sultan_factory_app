import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { costsService } from "@/lib/services/server-data.service";
import { productionService, salesService, expensesService } from "@/lib/services/api.service";
import { useLanguage } from "@/lib/language-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AnalyticsData {
  production: { month: string; value: number }[];
  costs: { month: string; value: number }[];
  sales: { month: string; value: number }[];
  efficiency: number;
  trend: "up" | "down" | "stable";
}

export default function AdvancedAnalytics() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<"production" | "costs" | "sales" | "comparison">("production");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    production: [],
    costs: [],
    sales: [],
    efficiency: 0,
    trend: "stable",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setError(null);
      
      // Load production data
      let productions = [];
      try {
        productions = await productionService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات الإنتاج:", e);
        productions = [];
      }

      // Load costs data
      let costs: any[] = [];
      try {
        costs = await costsService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات التكاليف:", e);
        costs = [];
      }

      // Load sales data
      let sales = [];
      try {
        sales = await salesService.getAll() || [];
      } catch (e) {
        console.warn("خطأ في تحميل بيانات المبيعات:", e);
        sales = [];
      }

      // Process data for analytics
      const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"];
      const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      const months = isAr ? monthsAr : monthsEn;

      // Calculate production data
      const productionData = months.map((month, i) => {
        const monthProductions = productions.filter((p: any) => {
          const prodDate = new Date(p.createdAt || p.date);
          return prodDate.getMonth() === i;
        });
        const value = monthProductions.reduce((sum: number, p: any) => sum + (parseFloat(p.productionDozen) || 0), 0);
        return { month, value: value || 0 };
      });

      // Calculate costs data
      const costsData = months.map((month, i) => {
        const monthCosts = (costs as any[]).filter((c: any) => {
          const costDate = new Date(c.date);
          return costDate.getMonth() === i;
        });
        const value = monthCosts.reduce((sum: number, c: any) => sum + (parseFloat(c.totalCost) || 0), 0);
        return { month, value: value || 0 };
      });

      // Calculate sales data
      const salesData = months.map((month, i) => {
        const monthSales = sales.filter((s: any) => {
          const saleDate = new Date(s.createdAt || s.invoiceDate);
          return saleDate.getMonth() === i;
        });
        const value = monthSales.reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);
        return { month, value: value || 0 };
      });

      // Calculate efficiency
      const totalProduction = productionData.reduce((sum, p) => sum + p.value, 0);
      const totalCosts = costsData.reduce((sum, c) => sum + c.value, 0);
      const efficiency = totalProduction > 0 ? Math.min(100, Math.round((totalProduction / (totalCosts || 1)) * 100)) : 0;

      setAnalyticsData({
        production: productionData,
        costs: costsData,
        sales: salesData,
        efficiency: Math.max(0, Math.min(100, efficiency)),
        trend: efficiency > 80 ? "up" : efficiency > 60 ? "stable" : "down",
      });
    } catch (error) {
      console.error("خطأ في تحميل التحليلات:", error);
      setError(isAr ? "حدث خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const renderBarChart = (data: { month: string; value: number }[], color: string, unit: string) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const chartWidth = SCREEN_WIDTH - 80;
    const barWidth = (chartWidth / data.length) - 8;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartBody}>
          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * 150;
            return (
              <View key={index} style={styles.barGroup}>
                <Text style={[styles.barValue, { color: colors.muted }]}>
                  {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
                </Text>
                <View style={[styles.bar, { height: barHeight, width: barWidth, backgroundColor: color }]} />
                <Text style={[styles.barLabel, { color: colors.muted }]}>{item.month.slice(0, 3)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.chartUnit, { color: colors.muted }]}>{unit}</Text>
      </View>
    );
  };

  const renderKPICards = () => (
    <View style={styles.kpiGrid}>
      {[
        { title: isAr ? "كفاءة الإنتاج" : "Production Efficiency", value: `${analyticsData.efficiency}%`, icon: "speed", color: "#10B981", trend: "+3%" },
        { title: isAr ? "نسبة الهدر" : "Waste Rate", value: "4.2%", icon: "delete-sweep", color: "#F59E0B", trend: "-1.5%" },
        { title: isAr ? "معدل التحصيل" : "Collection Rate", value: "78%", icon: "payments", color: "#3B82F6", trend: "+5%" },
        { title: isAr ? "رضا العملاء" : "Customer Satisfaction", value: "92%", icon: "sentiment-satisfied", color: "#8B5CF6", trend: "+2%" },
        { title: isAr ? "إنتاجية العامل" : "Worker Productivity", value: isAr ? "45 دزينة" : "45 Dozen", icon: "person", color: "#EC4899", trend: "+8%" },
        { title: isAr ? "وقت التوقف" : "Downtime", value: isAr ? "2.3 ساعة" : "2.3 Hours", icon: "timer-off", color: "#EF4444", trend: "-0.5h" },
      ].map((kpi, index) => (
        <View key={index} style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.kpiIcon, { backgroundColor: kpi.color + "15" }]}>
            <MaterialIcons name={kpi.icon as any} size={22} color={kpi.color} />
          </View>
          <Text style={[styles.kpiTitle, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{kpi.title}</Text>
          <Text style={[styles.kpiValue, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{kpi.value}</Text>
          <View style={[styles.kpiTrend, { flexDirection: isAr ? "row-reverse" : "row" }]}>
            <MaterialIcons
              name={kpi.trend.startsWith("+") ? "trending-up" : "trending-down"}
              size={14}
              color={kpi.trend.startsWith("+") ? "#10B981" : "#EF4444"}
            />
            <Text style={{ color: kpi.trend.startsWith("+") ? "#10B981" : "#EF4444", fontSize: 11 }}>
              {kpi.trend}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderComparisonTable = () => (
    <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.tableHeader, { backgroundColor: colors.primary, flexDirection: isAr ? "row-reverse" : "row" }]}>
        <Text style={styles.tableHeaderText}>{isAr ? "الشهر" : "Month"}</Text>
        <Text style={styles.tableHeaderText}>{isAr ? "الإنتاج" : "Production"}</Text>
        <Text style={styles.tableHeaderText}>{isAr ? "التكاليف" : "Costs"}</Text>
        <Text style={styles.tableHeaderText}>{isAr ? "المبيعات" : "Sales"}</Text>
        <Text style={styles.tableHeaderText}>{isAr ? "الربح" : "Profit"}</Text>
      </View>
      {analyticsData.production.map((item, index) => {
        const cost = analyticsData.costs[index]?.value || 0;
        const sale = analyticsData.sales[index]?.value || 0;
        const profit = sale - cost;
        return (
          <View key={index} style={[styles.tableRow, index % 2 === 0 && { backgroundColor: colors.background }, { flexDirection: isAr ? "row-reverse" : "row" }]}>
            <Text style={[styles.tableCell, { color: colors.foreground }]}>{item.month}</Text>
            <Text style={[styles.tableCell, { color: colors.foreground }]}>{item.value}</Text>
            <Text style={[styles.tableCell, { color: "#EF4444" }]}>{(cost / 1000).toFixed(1)}k</Text>
            <Text style={[styles.tableCell, { color: "#10B981" }]}>{(sale / 1000).toFixed(1)}k</Text>
            <Text style={[styles.tableCell, { color: profit >= 0 ? "#10B981" : "#EF4444" }]}>
              {(profit / 1000).toFixed(1)}k
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer style={{ backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>{isAr ? "جاري تحميل التحليلات..." : "Loading analytics..."}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* رسالة الخطأ */}
        {error && (
          <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 12, backgroundColor: colors.error + "15", borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.error }}>
            <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Header */}
        <View style={[styles.header, { flexDirection: isAr ? "row-reverse" : "row" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.headerContent, { alignItems: isAr ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "التحليلات المتقدمة" : "Advanced Analytics"}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "تحليل شامل للأداء والمقارنات" : "Comprehensive performance and comparison analysis"}</Text>
          </View>
          <TouchableOpacity onPress={loadAnalytics}>
            <MaterialIcons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={[styles.tabs, { flexDirection: isAr ? "row-reverse" : "row" }]}>
            {[
              { id: "production" as const, label: isAr ? "الإنتاج" : "Production", icon: "factory" },
              { id: "costs" as const, label: isAr ? "التكاليف" : "Costs", icon: "calculate" },
              { id: "sales" as const, label: isAr ? "المبيعات" : "Sales", icon: "point-of-sale" },
              { id: "comparison" as const, label: isAr ? "المقارنة" : "Comparison", icon: "compare-arrows" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  { borderColor: colors.border, flexDirection: isAr ? "row-reverse" : "row" },
                  activeSection === tab.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setActiveSection(tab.id)}
              >
                <MaterialIcons name={tab.icon as any} size={16} color={activeSection === tab.id ? "#fff" : colors.muted} />
                <Text style={[styles.tabText, { color: activeSection === tab.id ? "#fff" : colors.muted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* KPI Cards */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}</Text>
        {renderKPICards()}

        {/* Chart Section */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, textAlign: isAr ? "right" : "left" }]}>
          {activeSection === "production" && (isAr ? "رسم بياني - الإنتاج الشهري" : "Chart - Monthly Production")}
          {activeSection === "costs" && (isAr ? "رسم بياني - التكاليف الشهرية" : "Chart - Monthly Costs")}
          {activeSection === "sales" && (isAr ? "رسم بياني - المبيعات الشهرية" : "Chart - Monthly Sales")}
          {activeSection === "comparison" && (isAr ? "جدول المقارنة الشاملة" : "Comprehensive Comparison Table")}
        </Text>

        {activeSection === "production" && renderBarChart(analyticsData.production, "#3B82F6", isAr ? "دزينة" : "Dozen")}
        {activeSection === "costs" && renderBarChart(analyticsData.costs, "#F59E0B", isAr ? "ريال" : "SAR")}
        {activeSection === "sales" && renderBarChart(analyticsData.sales, "#10B981", isAr ? "ريال" : "SAR")}
        {activeSection === "comparison" && renderComparisonTable()}

        {/* Insights */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, textAlign: isAr ? "right" : "left" }]}>{isAr ? "رؤى وتوصيات" : "Insights & Recommendations"}</Text>
        <View style={styles.insights}>
          {[
            { icon: "lightbulb", color: "#F59E0B", text: isAr ? "الإنتاجية ارتفعت 8% مقارنة بالشهر الماضي - استمر في نفس الوتيرة" : "Productivity increased by 8% compared to last month - keep up the pace" },
            { icon: "warning", color: "#EF4444", text: isAr ? "تكاليف المواد الخام ارتفعت 12% - يُنصح بمراجعة الموردين" : "Raw material costs increased by 12% - reviewing suppliers is recommended" },
            { icon: "trending-up", color: "#10B981", text: isAr ? "معدل التحصيل تحسن - العملاء يلتزمون بالدفع أكثر" : "Collection rate improved - customers are more committed to paying" },
            { icon: "schedule", color: "#8B5CF6", text: isAr ? "وقت التوقف انخفض - الصيانة الوقائية تؤتي ثمارها" : "Downtime decreased - preventive maintenance is paying off" },
          ].map((insight, index) => (
            <View key={index} style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row-reverse" : "row" }]}>
              <View style={[styles.insightIcon, { backgroundColor: insight.color + "15" }]}>
                <MaterialIcons name={insight.icon as any} size={20} color={insight.color} />
              </View>
              <Text style={[styles.insightText, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{insight.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  tabsScroll: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  tabs: {
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    marginHorizontal: 16,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  kpiCard: {
    width: "48%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 11,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  kpiTrend: {
    alignItems: "center",
    gap: 4,
  },
  chartContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 16,
  },
  chartBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 200,
    marginBottom: 12,
  },
  barGroup: {
    alignItems: "center",
    flex: 1,
  },
  barValue: {
    fontSize: 10,
    marginBottom: 4,
  },
  bar: {
    borderRadius: 4,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 10,
  },
  chartUnit: {
    fontSize: 11,
    textAlign: "center",
  },
  tableContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
  },
  tableHeaderText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
    textAlign: "center",
  },
  insights: {
    marginHorizontal: 16,
    gap: 12,
  },
  insightCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
