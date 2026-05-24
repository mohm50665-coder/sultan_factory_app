import React, { useState, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, PieChart, ProgressBar, StatCard } from "@/components/charts";

type ReportSection = "production" | "manufacturing" | "warehouse" | "sales" | "expenses" | "maintenance" | "tasks" | "administrative";

interface SectionConfig {
  key: ReportSection;
  titleAr: string;
  titleEn: string;
  icon: string;
  color: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "production", titleAr: "الإنتاج", titleEn: "Production", icon: "factory", color: "#3b82f6" },
  { key: "manufacturing", titleAr: "مراحل التسليم", titleEn: "Manufacturing", icon: "precision-manufacturing", color: "#8b5cf6" },
  { key: "warehouse", titleAr: "المستودعات", titleEn: "Warehouse", icon: "warehouse", color: "#f59e0b" },
  { key: "sales", titleAr: "المبيعات والتحصيل", titleEn: "Sales & Collection", icon: "shopping-cart", color: "#ec4899" },
  { key: "expenses", titleAr: "المصروفات", titleEn: "Expenses", icon: "payments", color: "#6366f1" },
  { key: "maintenance", titleAr: "الصيانة", titleEn: "Maintenance", icon: "build", color: "#ef4444" },
  { key: "tasks", titleAr: "المهام", titleEn: "Tasks", icon: "checklist", color: "#14b8a6" },
  { key: "administrative", titleAr: "الإجراءات الإدارية", titleEn: "Administrative", icon: "assignment", color: "#06b6d4" },
];

export default function SectionReportsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [activeSection, setActiveSection] = useState<ReportSection>("production");
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    loadReportData(activeSection);
  }, [activeSection]);

  const loadReportData = async (section: ReportSection) => {
    setIsLoading(true);
    try {
      let data: any = {};
      switch (section) {
        case "production":
          data = await loadProductionReport();
          break;
        case "manufacturing":
          data = await loadManufacturingReport();
          break;
        case "warehouse":
          data = await loadWarehouseReport();
          break;
        case "sales":
          data = await loadSalesReport();
          break;
        case "expenses":
          data = await loadExpensesReport();
          break;
        case "maintenance":
          data = await loadMaintenanceReport();
          break;
        case "tasks":
          data = await loadTasksReport();
          break;
        case "administrative":
          data = await loadAdministrativeReport();
          break;
      }
      setReportData(data);
    } catch (error) {
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Production Report
  const loadProductionReport = async () => {
    const raw = await AsyncStorage.getItem("sultan_production_data_v2");
    const entries = raw ? JSON.parse(raw) : [];
    const totalProduction = entries.reduce((s: number, e: any) => s + (e.productionDozen || 0), 0);
    const totalWasteThread = entries.reduce((s: number, e: any) => s + (e.wasteThread || 0), 0);
    const totalWasteSocks = entries.reduce((s: number, e: any) => s + (e.wasteSocks || 0), 0);
    const totalSecondGrade = entries.reduce((s: number, e: any) => s + (e.secondGrade || 0), 0);
    const totalNeedles = entries.reduce((s: number, e: any) => s + (e.wasteNeedles || 0), 0);
    const machineCount = new Set(entries.map((e: any) => e.machineNumber)).size;

    const machineData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const key = `M${e.machineNumber || "?"}`;
      machineData[key] = (machineData[key] || 0) + (e.productionDozen || 0);
    });

    return {
      totalEntries: entries.length,
      totalProduction,
      totalWasteThread,
      totalWasteSocks,
      totalSecondGrade,
      totalNeedles,
      machineCount,
      machineData,
    };
  };

  // Load Manufacturing Report
  const loadManufacturingReport = async () => {
    const stages = ["machines", "rosso", "heart", "ironing", "inspection", "packaging", "anti_slip", "storage"];
    const stageData: Record<string, any[]> = {};
    let totalEntries = 0;

    for (const stage of stages) {
      const raw = await AsyncStorage.getItem(`sultan_manufacturing_${stage}`);
      const entries = raw ? JSON.parse(raw) : [];
      stageData[stage] = entries;
      totalEntries += entries.length;
    }

    const stageStats = stages.map((stage) => {
      const entries = stageData[stage] || [];
      const totalQty = entries.reduce((s: number, e: any) => s + (e.quantity || e.dozenQty || 0), 0);
      return { stage, count: entries.length, totalQty };
    });

    return { totalEntries, stageStats, stageData };
  };

  // Load Warehouse Report
  const loadWarehouseReport = async () => {
    const inRaw = await AsyncStorage.getItem("sultan_warehouse_raw");
    const outRaw = await AsyncStorage.getItem("sultan_warehouse_out");
    const inEntries = inRaw ? JSON.parse(inRaw) : [];
    const outEntries = outRaw ? JSON.parse(outRaw) : [];

    const totalIn = inEntries.reduce((s: number, e: any) => s + (e.quantity || 0), 0);
    const totalOut = outEntries.reduce((s: number, e: any) => s + (e.quantity || 0), 0);
    const balance = totalIn - totalOut;

    return {
      inCount: inEntries.length,
      outCount: outEntries.length,
      totalIn,
      totalOut,
      balance,
    };
  };

  // Load Sales Report
  const loadSalesReport = async () => {
    const salesRaw = await AsyncStorage.getItem("sultan_sales_data");
    const collectRaw = await AsyncStorage.getItem("sultan_collection_data");
    const sales = salesRaw ? JSON.parse(salesRaw) : [];
    const collections = collectRaw ? JSON.parse(collectRaw) : [];

    const totalSalesAmount = sales.reduce((s: number, e: any) => s + (e.amount || e.totalAmount || 0), 0);
    const totalCollected = collections.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const totalSalesQty = sales.reduce((s: number, e: any) => s + (e.quantity || 0), 0);

    return {
      salesCount: sales.length,
      collectionsCount: collections.length,
      totalSalesAmount,
      totalCollected,
      remaining: totalSalesAmount - totalCollected,
      totalSalesQty,
    };
  };

  // Load Expenses Report
  const loadExpensesReport = async () => {
    const raw = await AsyncStorage.getItem("sultan_expenses");
    const entries = raw ? JSON.parse(raw) : [];
    const totalExpenses = entries.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    const categoryData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const cat = e.category || e.description || "أخرى";
      categoryData[cat] = (categoryData[cat] || 0) + (e.amount || 0);
    });

    return {
      totalEntries: entries.length,
      totalExpenses,
      categoryData,
    };
  };

  // Load Maintenance Report
  const loadMaintenanceReport = async () => {
    const periodicRaw = await AsyncStorage.getItem("sultan_maintenance_periodic");
    const emergencyRaw = await AsyncStorage.getItem("sultan_maintenance_emergency");
    const stoppedRaw = await AsyncStorage.getItem("sultan_maintenance_stopped-devices");

    const periodic = periodicRaw ? JSON.parse(periodicRaw) : [];
    const emergency = emergencyRaw ? JSON.parse(emergencyRaw) : [];
    const stopped = stoppedRaw ? JSON.parse(stoppedRaw) : [];

    return {
      periodicCount: periodic.length,
      emergencyCount: emergency.length,
      stoppedCount: stopped.length,
      totalEntries: periodic.length + emergency.length + stopped.length,
    };
  };

  // Load Tasks Report
  const loadTasksReport = async () => {
    const raw = await AsyncStorage.getItem("tasks_entries");
    const entries = raw ? JSON.parse(raw) : [];

    const completed = entries.filter((e: any) => e.status === "completed" || e.completed).length;
    const pending = entries.filter((e: any) => e.status === "pending" || (!e.completed && !e.overdue)).length;
    const overdue = entries.filter((e: any) => e.status === "overdue" || e.overdue).length;

    return {
      totalTasks: entries.length,
      completed,
      pending,
      overdue,
    };
  };

  // Load Administrative Report
  const loadAdministrativeReport = async () => {
    const raw = await AsyncStorage.getItem("sultan_administrative_data");
    const entries = raw ? JSON.parse(raw) : [];

    const approved = entries.filter((e: any) => e.status === "approved").length;
    const pendingApproval = entries.filter((e: any) => e.status === "pending").length;
    const rejected = entries.filter((e: any) => e.status === "rejected").length;

    return {
      totalRequests: entries.length,
      approved,
      pendingApproval,
      rejected,
    };
  };

  const renderProductionReport = () => {
    if (!reportData) return null;
    const { totalProduction, totalWasteThread, totalWasteSocks, totalSecondGrade, totalNeedles, machineCount, machineData, totalEntries } = reportData;

    const barData = Object.entries(machineData || {}).slice(0, 8).map(([label, value]) => ({ label, value: value as number }));
    const pieData = [
      { label: isAr ? "خيوط" : "Thread", value: totalWasteThread || 0, color: "#3b82f6" },
      { label: isAr ? "جوارب" : "Socks", value: totalWasteSocks || 0, color: "#ef4444" },
      { label: isAr ? "إبر" : "Needles", value: totalNeedles || 0, color: "#f59e0b" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الإنتاج" : "Total Production"} value={`${totalProduction}`} subtitle={isAr ? "درزن" : "dozen"} color="#3b82f6" />
          <StatCard title={isAr ? "المكائن النشطة" : "Active Machines"} value={`${machineCount}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "هدر الخيوط" : "Thread Waste"} value={`${totalWasteThread}`} subtitle={isAr ? "جرام" : "g"} color="#ef4444" />
          <StatCard title={isAr ? "النخب الثاني" : "2nd Grade"} value={`${totalSecondGrade}`} subtitle={isAr ? "زوج" : "pairs"} color="#f59e0b" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "عدد الإدخالات" : "Entries"} value={`${totalEntries}`} color="#6366f1" />
          <StatCard title={isAr ? "هدر الإبر" : "Needle Waste"} value={`${totalNeedles}`} subtitle={isAr ? "حبة" : "pcs"} color="#dc2626" />
        </View>
        {barData.length > 0 && <BarChart data={barData} title={isAr ? "الإنتاج حسب المكينة" : "Production by Machine"} />}
        {(totalWasteThread > 0 || totalWasteSocks > 0) && <PieChart data={pieData} title={isAr ? "توزيع الهدر" : "Waste Distribution"} />}
      </View>
    );
  };

  const renderManufacturingReport = () => {
    if (!reportData) return null;
    const { totalEntries, stageStats } = reportData;

    const stageNames: Record<string, { ar: string; en: string }> = {
      machines: { ar: "المكائن", en: "Machines" },
      rosso: { ar: "الروسو", en: "Rosso" },
      heart: { ar: "القلب", en: "Turning" },
      ironing: { ar: "الكاوية", en: "Ironing" },
      inspection: { ar: "الفحص", en: "Inspection" },
      packaging: { ar: "التغليف", en: "Packaging" },
      anti_slip: { ar: "مانع الانزلاق", en: "Anti-Slip" },
      storage: { ar: "التخزين", en: "Storage" },
    };

    const barData = (stageStats || []).map((s: any) => ({
      label: isAr ? stageNames[s.stage]?.ar || s.stage : stageNames[s.stage]?.en || s.stage,
      value: s.count,
    }));

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الإدخالات" : "Total Entries"} value={`${totalEntries}`} color="#8b5cf6" />
          <StatCard title={isAr ? "عدد المراحل" : "Stages"} value="8" color="#14b8a6" />
        </View>
        {barData.length > 0 && <BarChart data={barData} title={isAr ? "الإدخالات حسب المرحلة" : "Entries by Stage"} barColor="#8b5cf6" height={180} />}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>{isAr ? "تفاصيل المراحل" : "Stage Details"}</Text>
          {(stageStats || []).map((s: any, i: number) => (
            <ProgressBar
              key={i}
              label={isAr ? stageNames[s.stage]?.ar || s.stage : stageNames[s.stage]?.en || s.stage}
              value={s.count}
              max={Math.max(...(stageStats || []).map((x: any) => x.count), 1)}
              color={["#8b5cf6", "#3b82f6", "#14b8a6", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#06b6d4"][i % 8]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderWarehouseReport = () => {
    if (!reportData) return null;
    const { inCount, outCount, totalIn, totalOut, balance } = reportData;

    const pieData = [
      { label: isAr ? "داخل" : "In", value: totalIn || 1, color: "#10b981" },
      { label: isAr ? "خارج" : "Out", value: totalOut || 1, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الداخل" : "Total In"} value={`${totalIn}`} color="#10b981" />
          <StatCard title={isAr ? "إجمالي الخارج" : "Total Out"} value={`${totalOut}`} color="#ef4444" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "الرصيد" : "Balance"} value={`${balance}`} color={balance >= 0 ? "#3b82f6" : "#ef4444"} />
          <StatCard title={isAr ? "عمليات الإدخال" : "Operations"} value={`${inCount + outCount}`} color="#6366f1" />
        </View>
        {(totalIn > 0 || totalOut > 0) && <PieChart data={pieData} title={isAr ? "حركة المستودع" : "Warehouse Movement"} />}
      </View>
    );
  };

  const renderSalesReport = () => {
    if (!reportData) return null;
    const { salesCount, collectionsCount, totalSalesAmount, totalCollected, remaining, totalSalesQty } = reportData;

    const pieData = [
      { label: isAr ? "محصّل" : "Collected", value: totalCollected || 1, color: "#10b981" },
      { label: isAr ? "متبقي" : "Remaining", value: remaining > 0 ? remaining : 1, color: "#f59e0b" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المبيعات" : "Total Sales"} value={`${totalSalesAmount}`} subtitle={isAr ? "ريال" : "SAR"} color="#ec4899" />
          <StatCard title={isAr ? "المحصّل" : "Collected"} value={`${totalCollected}`} subtitle={isAr ? "ريال" : "SAR"} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "المتبقي" : "Remaining"} value={`${remaining > 0 ? remaining : 0}`} subtitle={isAr ? "ريال" : "SAR"} color="#f59e0b" />
          <StatCard title={isAr ? "الكمية المباعة" : "Qty Sold"} value={`${totalSalesQty}`} subtitle={isAr ? "درزن" : "dozen"} color="#3b82f6" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "عمليات البيع" : "Sales Ops"} value={`${salesCount}`} color="#6366f1" />
          <StatCard title={isAr ? "عمليات التحصيل" : "Collections"} value={`${collectionsCount}`} color="#14b8a6" />
        </View>
        {(totalCollected > 0 || remaining > 0) && <PieChart data={pieData} title={isAr ? "حالة التحصيل" : "Collection Status"} />}
      </View>
    );
  };

  const renderExpensesReport = () => {
    if (!reportData) return null;
    const { totalEntries, totalExpenses, categoryData } = reportData;

    const categories = Object.entries(categoryData || {}).slice(0, 6);
    const barData = categories.map(([label, value]) => ({ label: label.slice(0, 10), value: value as number }));
    const pieColors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
    const pieData = categories.map(([label, value], i) => ({ label: label.slice(0, 12), value: value as number, color: pieColors[i % 6] }));

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المصروفات" : "Total Expenses"} value={`${totalExpenses}`} subtitle={isAr ? "ريال" : "SAR"} color="#6366f1" />
          <StatCard title={isAr ? "عدد العمليات" : "Operations"} value={`${totalEntries}`} color="#f59e0b" />
        </View>
        {barData.length > 0 && <BarChart data={barData} title={isAr ? "المصروفات حسب البند" : "Expenses by Category"} barColor="#6366f1" />}
        {pieData.length > 0 && <PieChart data={pieData} title={isAr ? "توزيع المصروفات" : "Expenses Distribution"} />}
      </View>
    );
  };

  const renderMaintenanceReport = () => {
    if (!reportData) return null;
    const { periodicCount, emergencyCount, stoppedCount, totalEntries } = reportData;

    const pieData = [
      { label: isAr ? "دورية" : "Periodic", value: periodicCount || 1, color: "#10b981" },
      { label: isAr ? "طوارئ" : "Emergency", value: emergencyCount || 1, color: "#ef4444" },
      { label: isAr ? "متوقفة" : "Stopped", value: stoppedCount || 1, color: "#f59e0b" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي العمليات" : "Total Ops"} value={`${totalEntries}`} color="#ef4444" />
          <StatCard title={isAr ? "صيانة دورية" : "Periodic"} value={`${periodicCount}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "طوارئ" : "Emergency"} value={`${emergencyCount}`} color="#ef4444" />
          <StatCard title={isAr ? "أجهزة متوقفة" : "Stopped"} value={`${stoppedCount}`} color="#f59e0b" />
        </View>
        <PieChart data={pieData} title={isAr ? "توزيع الصيانة" : "Maintenance Distribution"} />
      </View>
    );
  };

  const renderTasksReport = () => {
    if (!reportData) return null;
    const { totalTasks, completed, pending, overdue } = reportData;

    const pieData = [
      { label: isAr ? "مكتملة" : "Completed", value: completed || 1, color: "#10b981" },
      { label: isAr ? "معلقة" : "Pending", value: pending || 1, color: "#f59e0b" },
      { label: isAr ? "متأخرة" : "Overdue", value: overdue || 1, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المهام" : "Total Tasks"} value={`${totalTasks}`} color="#14b8a6" />
          <StatCard title={isAr ? "مكتملة" : "Completed"} value={`${completed}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "معلقة" : "Pending"} value={`${pending}`} color="#f59e0b" />
          <StatCard title={isAr ? "متأخرة" : "Overdue"} value={`${overdue}`} color="#ef4444" />
        </View>
        {totalTasks > 0 && <PieChart data={pieData} title={isAr ? "حالة المهام" : "Tasks Status"} />}
        {totalTasks > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{isAr ? "نسبة الإنجاز" : "Completion Rate"}</Text>
            <ProgressBar label={isAr ? "الإنجاز" : "Progress"} value={completed} max={totalTasks || 1} color="#10b981" />
          </View>
        )}
      </View>
    );
  };

  const renderAdministrativeReport = () => {
    if (!reportData) return null;
    const { totalRequests, approved, pendingApproval, rejected } = reportData;

    const pieData = [
      { label: isAr ? "موافق عليها" : "Approved", value: approved || 1, color: "#10b981" },
      { label: isAr ? "قيد المراجعة" : "Pending", value: pendingApproval || 1, color: "#f59e0b" },
      { label: isAr ? "مرفوضة" : "Rejected", value: rejected || 1, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الطلبات" : "Total Requests"} value={`${totalRequests}`} color="#06b6d4" />
          <StatCard title={isAr ? "موافق عليها" : "Approved"} value={`${approved}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "قيد المراجعة" : "Pending"} value={`${pendingApproval}`} color="#f59e0b" />
          <StatCard title={isAr ? "مرفوضة" : "Rejected"} value={`${rejected}`} color="#ef4444" />
        </View>
        {totalRequests > 0 && <PieChart data={pieData} title={isAr ? "حالة الطلبات" : "Requests Status"} />}
      </View>
    );
  };

  const renderActiveReport = () => {
    switch (activeSection) {
      case "production": return renderProductionReport();
      case "manufacturing": return renderManufacturingReport();
      case "warehouse": return renderWarehouseReport();
      case "sales": return renderSalesReport();
      case "expenses": return renderExpensesReport();
      case "maintenance": return renderMaintenanceReport();
      case "tasks": return renderTasksReport();
      case "administrative": return renderAdministrativeReport();
      default: return null;
    }
  };

  const activeSectionConfig = SECTIONS.find((s) => s.key === activeSection);

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
          <MaterialIcons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAr ? "تقارير الأقسام" : "Section Reports"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Section Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsList}>
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              style={[styles.tab, activeSection === section.key && { backgroundColor: section.color }]}
            >
              <MaterialIcons
                name={section.icon as any}
                size={16}
                color={activeSection === section.key ? "white" : section.color}
              />
              <Text
                style={[styles.tabText, activeSection === section.key && styles.tabTextActive]}
                numberOfLines={1}
              >
                {isAr ? section.titleAr : section.titleEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${activeSectionConfig?.color}15` }]}>
          <MaterialIcons name={activeSectionConfig?.icon as any} size={20} color={activeSectionConfig?.color} />
        </View>
        <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>
          {isAr
            ? `تقرير ${activeSectionConfig?.titleAr}`
            : `${activeSectionConfig?.titleEn} Report`}
        </Text>
      </View>

      {/* Report Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{isAr ? "جارٍ تحميل التقرير..." : "Loading report..."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderActiveReport()}

          {/* Empty State */}
          {reportData && Object.values(reportData).every((v) => v === 0 || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) && (
            <View style={styles.emptyState}>
              <MaterialIcons name="analytics" size={56} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {isAr ? "لا توجد بيانات بعد" : "No data available yet"}
              </Text>
              <Text style={styles.emptySubtext}>
                {isAr ? "ابدأ بإدخال البيانات في هذا القسم لعرض التقرير" : "Start entering data in this section to view the report"}
              </Text>
            </View>
          )}
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
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tabsList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4b5563",
  },
  tabTextActive: {
    color: "white",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
  },
});
